"""
API views for mobile app integration with Revpay Connect eTIMS backend.
Provides REST endpoints for authentication, invoices, devices, and dashboard data.
"""
from rest_framework import status, generics, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.db import models
from django.db.models import Count, Sum, Avg, Q, Max
from django.utils import timezone
from datetime import timedelta, datetime
from decimal import Decimal
import logging

from .models import (
    Company, Device, Invoice, InvoiceItem, ItemMaster, 
    ComplianceReport, ApiLog, RetryQueue
)
from .serializers import (
    CompanySerializer, DeviceSerializer, InvoiceSerializer, 
    InvoiceItemSerializer, ItemMasterSerializer, ComplianceReportSerializer
)
from .tasks import retry_sales_invoice, sync_device_status
from .services.code_management_service import CodeManagementService
from .services.reports_service import ReportsService

logger = logging.getLogger(__name__)


class CustomTokenObtainPairView(TokenObtainPairView):
    """Custom JWT token view that includes user and company data"""
    
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        
        if response.status_code == 200:
            # Get user and company data
            email = request.data.get('username') or request.data.get('email')
            user = User.objects.filter(email=email).first()
            
            if user:
                try:
                    company = Company.objects.get(contact_email=user.email)
                    
                    # Get user's full name
                    full_name = f"{user.first_name} {user.last_name}".strip()
                    if not full_name:
                        full_name = company.contact_person or user.email.split('@')[0]
                    
                    response.data['user'] = {
                        'id': str(user.id),
                        'email': user.email,
                        'full_name': full_name,
                        'first_name': user.first_name,
                        'last_name': user.last_name,
                        'is_active': user.is_active,
                        'date_joined': user.date_joined.isoformat(),
                        'businessName': company.company_name,
                        'kraPin': company.tin,
                        'phone': company.contact_phone,
                        'company': CompanySerializer(company).data
                    }
                    response.data['tokens'] = {
                        'access': response.data.pop('access'),
                        'refresh': response.data.pop('refresh')
                    }
                except Company.DoesNotExist:
                    pass
        
        return response


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def register_business(request):
    """
    Complete business registration endpoint
    Registers user, company, device, and subscription in one call
    """
    try:
        data = request.data
        
        # Validate required fields
        required_fields = [
            'full_name', 'email', 'password',
            'company_name', 'tin', 'contact_phone', 'business_address',
            'device_serial_number', 'device_type', 'plan_id'
        ]
        
        for field in required_fields:
            if not data.get(field):
                return Response(
                    {'error': f'{field} is required'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Check if user already exists
        if User.objects.filter(email=data['email']).exists():
            return Response(
                {'error': 'User with this email already exists'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if company with TIN already exists
        if Company.objects.filter(tin=data['tin']).exists():
            return Response(
                {'error': 'Company with this TIN already exists'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create user
        user = User.objects.create_user(
            username=data['email'],
            email=data['email'],
            password=data['password'],
            first_name=data['full_name'].split()[0] if data['full_name'] else '',
            last_name=' '.join(data['full_name'].split()[1:]) if len(data['full_name'].split()) > 1 else ''
        )
        
        # Create company
        company = Company.objects.create(
            company_name=data['company_name'],
            tin=data['tin'],
            contact_person=data.get('contact_person', data['full_name']),
            contact_email=data['email'],
            contact_phone=data['contact_phone'],
            business_address=data['business_address'],
            status='pending',  # Will be activated after KRA registration
            is_sandbox=False,
            subscription_status='trial',  # Set default subscription status
            subscription_plan='free'  # Set default subscription plan
        )
        
        # Create device
        device = Device.objects.create(
            company=company,
            tin=company.tin,  # Set device TIN from company
            bhf_id='00',  # Default branch ID
            serial_number=data['device_serial_number'],
            device_name=f"{data['company_name']} - {data['device_type'].upper()}",
            device_type=data['device_type'],
            integration_type='pos',
            status='pending',  # Will be activated after KRA registration
            is_certified=False
        )
        
        # Automatically activate device with KRA
        try:
            from .services.kra_client import KRAClient
            from .services.kra_mock_service import KRAMockService
            from django.conf import settings
            
            # Register TIN with mock service if using mock
            if getattr(settings, 'KRA_USE_MOCK', True):
                KRAMockService.register_tin(company.tin)
                logger.info(f"Registered TIN {company.tin} with KRA mock service")
            
            # Initialize KRA client and activate device
            kra_client = KRAClient()
            result = kra_client.init_device(
                tin=company.tin,
                bhf_id=device.bhf_id or '00',
                serial_number=device.serial_number,
                device_name=f"{company.company_name} - {device.device_type.upper()}"
            )
            
            if result.get('success'):
                # Update device with CMC key and mark as active
                device.cmc_key = result.get('cmc_key', '')
                device.status = 'active'
                device.is_certified = True
                device.last_sync = timezone.now()
                device.save()
                
                # Update company status to active
                company.status = 'active'
                company.save()
                
                logger.info(f"Device {device.serial_number} activated successfully during registration")
            else:
                logger.warning(f"Device activation failed during registration: {result.get('error')}")
        except Exception as e:
            logger.error(f"Error activating device during registration: {str(e)}")
            # Don't fail registration if activation fails - user can activate later
        
        # Create subscription
        from .models import SubscriptionPlan, Subscription
        try:
            # Try to get the plan by ID first, fallback to free plan
            try:
                plan = SubscriptionPlan.objects.get(id=data['plan_id'])
            except (SubscriptionPlan.DoesNotExist, ValueError):
                # If plan_id is invalid or not found, get free plan by type
                plan = SubscriptionPlan.objects.filter(plan_type='free', is_active=True).first()
                if not plan:
                    # If no free plan, get any active plan
                    plan = SubscriptionPlan.objects.filter(is_active=True).first()
                if not plan:
                    raise Exception("No subscription plans available. Please run: python manage.py seed_plans")
            
            # Create subscription
            subscription = Subscription.objects.create(
                company=company,
                plan=plan,
                status='active' if plan.price == 0 else 'pending',  # Free plans are active immediately
                auto_renew=True,
                current_period_start=timezone.now(),
                current_period_end=timezone.now() + timedelta(days=30)
            )
            
            logger.info(f"Created subscription for company {company.company_name}: {subscription.id}")
        except Exception as e:
            logger.error(f"Failed to create subscription: {e}")
            # Don't fail registration if subscription creation fails
            pass
        
        # TODO: Submit to KRA for device registration
        # This would be done asynchronously via Celery task
        # from .tasks import register_device_with_kra
        # register_device_with_kra.delay(device.id)
        
        return Response({
            'message': 'Business registered successfully',
            'user': {
                'id': str(user.id),
                'email': user.email,
                'full_name': data['full_name']
            },
            'company': {
                'id': str(company.id),
                'name': company.company_name,
                'tin': company.tin,
                'status': company.status
            },
            'device': {
                'id': str(device.id),
                'serial_number': device.serial_number,
                'type': device.device_type,
                'status': device.status
            }
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        logger.error(f"Business registration error: {str(e)}")
        return Response(
            {'error': str(e)}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def register_user(request):
    """Register a new user and company"""
    try:
        data = request.data
        
        # Validate required fields
        required_fields = [
            'company_name', 'tin', 'contact_person', 'contact_email', 
            'contact_phone', 'business_address', 'password'
        ]
        
        for field in required_fields:
            if not data.get(field):
                return Response(
                    {'error': f'{field} is required'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Check if user already exists
        if User.objects.filter(email=data['contact_email']).exists():
            return Response(
                {'error': 'User with this email already exists'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if company with TIN already exists
        if Company.objects.filter(tin=data['tin']).exists():
            return Response(
                {'error': 'Company with this TIN already exists'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create user
        user = User.objects.create_user(
            username=data['contact_email'],
            email=data['contact_email'],
            password=data['password'],
            first_name=data['contact_person']
        )
        
        # Create company
        company = Company.objects.create(
            company_name=data['company_name'],
            tin=data['tin'],
            contact_person=data['contact_person'],
            contact_email=data['contact_email'],
            contact_phone=data['contact_phone'],
            business_address=data['business_address'],
            business_type=data.get('business_type', ''),
            status='active',  # Auto-activate company
            is_sandbox=True,  # Start in sandbox mode
            subscription_status='trial',  # Set default subscription status
            subscription_plan='free'  # Set default subscription plan
        )
        
        # Auto-create default device for the company
        import uuid
        from datetime import datetime
        
        device_serial = f"REV-{company.tin}-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        device = Device.objects.create(
            company=company,
            device_type='oscu',  # Use OSCU for real-time processing
            integration_type='mobile_app',
            tin=company.tin,
            bhf_id='000',  # Default branch
            serial_number=device_serial,
            device_name=f"{company.company_name} - POS Device",
            status='pending',
            pos_version='1.0'
        )
        
        # Create default subscription (30-day free trial)
        from .models import SubscriptionPlan, Subscription
        try:
            # Get or create free trial plan
            free_plan, created = SubscriptionPlan.objects.get_or_create(
                plan_type='free',
                defaults={
                    'name': 'Free Trial',
                    'description': '30-day free trial with 100 invoices',
                    'price': Decimal('0.00'),
                    'currency': 'KES',
                    'billing_cycle': 'monthly',
                    'invoice_limit_per_month': 100,
                    'device_limit': 1,
                    'user_limit': 1,
                    'trial_days': 30,
                    'features': {
                        'real_time_kra': True,
                        'mobile_app': True,
                        'basic_reports': True,
                        'email_support': True
                    }
                }
            )
            
            # Create subscription
            trial_start = timezone.now()
            trial_end = trial_start + timedelta(days=30)
            
            subscription = Subscription.objects.create(
                company=company,
                plan=free_plan,
                status='trial',
                current_period_start=trial_start,
                current_period_end=trial_end,
                is_trial=True,
                trial_start=trial_start,
                trial_end=trial_end,
                payment_method='mpesa'
            )
            
            logger.info(f"Created free trial subscription for {company.company_name}")
            
        except Exception as e:
            logger.error(f"Failed to create subscription: {e}")
        
        # Initialize device with KRA immediately and validate
        from .services.kra_client import KRAClient
        try:
            kra_client = KRAClient()
            init_result = kra_client.init_device(
                tin=company.tin,
                bhf_id='000',
                serial_number=device_serial,
                device_name=device.device_name
            )
            
            if init_result.get('success'):
                # Store CMC key and activate device
                device.cmc_key = init_result.get('cmc_key')
                device.status = 'active'
                device.is_certified = True
                device.certification_date = timezone.now()
                device.last_sync = timezone.now()
                device.save()
                
                logger.info(f"Device {device_serial} successfully registered with KRA")
            else:
                # Keep device as pending with error message
                device.status = 'failed'
                device.save()
                logger.error(f"Device registration failed: {init_result}")
                
        except Exception as e:
            device.status = 'failed'
            device.save()
            logger.error(f"Device initialization error: {e}")
        
        # Generate tokens
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'success': True,
            'data': {
                'tokens': {
                    'access': str(refresh.access_token),
                    'refresh': str(refresh)
                },
                'user': {
                    'id': str(user.id),
                    'email': user.email,
                    'is_active': user.is_active,
                    'date_joined': user.date_joined.isoformat(),
                    'businessName': company.company_name,  # Mobile app expects this
                    'kraPin': company.tin,  # Mobile app expects this
                    'phone': company.contact_phone,  # Mobile app expects this
                    'company': CompanySerializer(company).data
                },
                'device': {
                    'id': str(device.id),
                    'serial_number': device.serial_number,
                    'status': device.status,
                    'device_type': device.device_type,
                    'is_certified': device.is_certified,
                    'has_cmc_key': bool(device.cmc_key),
                    'real_time_ready': device.device_type == 'oscu' and device.status == 'active' and bool(device.cmc_key),
                    'message': 'Device registered and ready for real-time invoicing' if device.status == 'active' else 'Device registration in progress'
                }
            },
            'message': 'Registration successful! Your business is now KRA-compliant and ready for invoicing.'
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        return Response(
            {'error': str(e)}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def logout_user(request):
    """Logout user by blacklisting refresh token"""
    try:
        refresh_token = request.data.get('refresh')
        if refresh_token:
            token = RefreshToken(refresh_token)
            token.blacklist()
        
        return Response({'message': 'Successfully logged out'})
    except Exception as e:
        return Response(
            {'error': str(e)}, 
            status=status.HTTP_400_BAD_REQUEST
        )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def dashboard_stats(request):
    """Get dashboard statistics for the authenticated user's company"""
    try:
        # Get user's company
        user_company = Company.objects.get(contact_email=request.user.email)
        
        # Get date range (last 30 days)
        end_date = timezone.now()
        start_date = end_date - timedelta(days=30)
        
        # Get invoice statistics
        invoices = Invoice.objects.filter(company=user_company)
        recent_invoices = invoices.filter(created_at__gte=start_date)
        
        total_invoices = invoices.count()
        successful_invoices = invoices.filter(status='confirmed').count()
        failed_invoices = invoices.filter(status='failed').count()
        pending_invoices = invoices.filter(status__in=['pending', 'sent', 'retry']).count()
        
        # Calculate success rate
        success_rate = (successful_invoices / total_invoices * 100) if total_invoices > 0 else 0
        
        # Financial statistics
        financial_data = invoices.filter(status='confirmed').aggregate(
            total_revenue=Sum('total_amount'),
            total_tax=Sum('tax_amount')
        )
        
        # Device statistics
        devices = Device.objects.filter(company=user_company)
        active_devices = devices.filter(status='active').count()
        
        # Determine integration mode
        device_types = devices.values_list('device_type', flat=True).distinct()
        if len(device_types) > 1:
            integration_mode = 'mixed'
        elif 'vscu' in device_types:
            integration_mode = 'vscu'
        elif 'oscu' in device_types:
            integration_mode = 'oscu'
        else:
            integration_mode = 'none'
        
        # Last sync time
        from django.db.models import Max
        last_sync = devices.filter(last_sync__isnull=False).aggregate(
            latest=Max('last_sync')
        )['latest']
        
        # Format response to match both mobile app expectations and backend format
        return Response({
            'success': True,  # Add success field for consistency
            'stats': {
                # Backend format (snake_case)
                'total_invoices': total_invoices,
                'successful_invoices': successful_invoices,
                'failed_invoices': failed_invoices,
                'pending_invoices': pending_invoices,
                'total_revenue': str(financial_data['total_revenue'] or 0),
                'total_tax': str(financial_data['total_tax'] or 0),
                'success_rate': round(success_rate, 2),
                'active_devices': active_devices,
                'integration_mode': integration_mode,
                'last_sync': last_sync.isoformat() if last_sync else None,
                
                # Mobile app format (camelCase and alternative names)
                'totalInvoices': total_invoices,
                'syncedCount': successful_invoices,
                'failedCount': failed_invoices,
                'pendingCount': pending_invoices,
                'monthlyRevenue': float(financial_data['total_revenue'] or 0),
                'successRate': round(success_rate, 2),
                'currentMode': integration_mode.upper() if integration_mode != 'none' else 'OSCU',
                'lastSyncTime': last_sync.isoformat() if last_sync else None,
            },
            # Also include at root level for backward compatibility
            'total_invoices': total_invoices,
            'successful_invoices': successful_invoices,
            'failed_invoices': failed_invoices,
            'pending_invoices': pending_invoices,
            'total_revenue': str(financial_data['total_revenue'] or 0),
            'total_tax': str(financial_data['total_tax'] or 0),
            'success_rate': round(success_rate, 2),
            'active_devices': active_devices,
            'integration_mode': integration_mode,
            'last_sync': last_sync.isoformat() if last_sync else None,
            
            # Additional metadata
            'company': {
                'id': str(user_company.id),
                'name': user_company.company_name,
                'tin': user_company.tin,
                'status': user_company.status,
                'is_sandbox': user_company.is_sandbox
            },
            'devices_summary': {
                'total': devices.count(),
                'active': active_devices,
                'inactive': devices.filter(status='inactive').count(),
                'pending': devices.filter(status='pending').count(),
                'failed': devices.filter(status='failed').count()
            }
        })
        
    except Company.DoesNotExist:
        return Response(
            {
                'success': False,
                'message': 'Company not found',
                'error': 'Company not found'
            }, 
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response(
            {
                'success': False,
                'message': str(e),
                'error': str(e)
            }, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


class CompanyProfileView(APIView):
    """Company profile management"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        try:
            company = Company.objects.get(contact_email=request.user.email)
            user = request.user
            
            # Get user's full name
            full_name = f"{user.first_name} {user.last_name}".strip()
            if not full_name:
                full_name = company.contact_person or user.email.split('@')[0]
            
            return Response({
                'success': True,
                'data': {
                    'user': {
                        'id': str(user.id),
                        'email': user.email,
                        'full_name': full_name,
                        'first_name': user.first_name,
                        'last_name': user.last_name,
                    },
                    'company': CompanySerializer(company).data,
                    'businessName': company.company_name,
                    'kraPin': company.tin,
                    'phone': company.contact_phone,
                    'posDetails': company.business_address,
                }
            })
        except Company.DoesNotExist:
            return Response(
                {'success': False, 'error': 'Company not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
    
    def patch(self, request):
        try:
            company = Company.objects.get(contact_email=request.user.email)
            user = request.user
            
            # Update user information if provided
            if 'full_name' in request.data:
                name_parts = request.data['full_name'].strip().split(' ', 1)
                user.first_name = name_parts[0]
                user.last_name = name_parts[1] if len(name_parts) > 1 else ''
                user.save()
            
            # Update company information
            if 'businessName' in request.data:
                company.company_name = request.data['businessName']
            if 'phone' in request.data:
                company.contact_phone = request.data['phone']
            if 'posDetails' in request.data:
                company.business_address = request.data['posDetails']
            if 'kraPin' in request.data:
                company.tin = request.data['kraPin']
            
            company.save()
            
            # Return updated profile
            full_name = f"{user.first_name} {user.last_name}".strip()
            if not full_name:
                full_name = company.contact_person or user.email.split('@')[0]
            
            return Response({
                'success': True,
                'message': 'Profile updated successfully',
                'data': {
                    'user': {
                        'id': str(user.id),
                        'email': user.email,
                        'full_name': full_name,
                        'first_name': user.first_name,
                        'last_name': user.last_name,
                    },
                    'company': CompanySerializer(company).data,
                    'businessName': company.company_name,
                    'kraPin': company.tin,
                    'phone': company.contact_phone,
                    'posDetails': company.business_address,
                }
            })
        except Company.DoesNotExist:
            return Response(
                {'success': False, 'error': 'Company not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )


class DeviceListCreateView(generics.ListCreateAPIView):
    """List and create devices"""
    serializer_class = DeviceSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        try:
            company = Company.objects.get(contact_email=self.request.user.email)
            return Device.objects.filter(company=company)
        except Company.DoesNotExist:
            return Device.objects.none()
    
    def list(self, request, *args, **kwargs):
        """Override list to provide mobile-friendly response format"""
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        
        # Format response for mobile app compatibility
        devices_data = []
        for device_data in serializer.data:
            device = Device.objects.get(id=device_data['id'])
            devices_data.append({
                'id': device_data['id'],
                'serial_number': device_data.get('serial_number', ''),
                'device_name': device_data.get('device_name', ''),
                'device_type': device_data.get('device_type', device.device_type if hasattr(device, 'device_type') else 'oscu'),
                'integration_type': device_data.get('integration_type', device.integration_type if hasattr(device, 'integration_type') else 'api'),
                'status': device_data.get('status', 'inactive'),
                'is_certified': device_data.get('is_certified', False),
                'last_sync': device_data.get('last_sync'),
                'created_at': device_data.get('created_at'),
                'tin': device_data.get('tin', device.tin if hasattr(device, 'tin') else ''),
                'bhf_id': device_data.get('bhf_id', device.bhf_id if hasattr(device, 'bhf_id') else ''),
                'pos_version': device_data.get('pos_version', '1.0'),
                'has_cmc_key': bool(getattr(device, 'cmc_key', None)),
                'certification_status': 'certified' if device.is_certified else 'pending',
                'real_time_ready': device.device_type == 'oscu' and device.status == 'active' and bool(getattr(device, 'cmc_key', None)),
                'batch_ready': device.device_type == 'vscu' and device.status == 'active'
            })
        
        return Response({
            'success': True,
            'data': devices_data,
            'results': devices_data,  # Mobile app expects this field
            'count': len(devices_data)
        })
    
    def create(self, request, *args, **kwargs):
        """Override create to provide mobile-friendly response"""
        try:
            response = super().create(request, *args, **kwargs)
            
            if response.status_code == 201:
                device = Device.objects.get(id=response.data['id'])
                
                return Response({
                    'success': True,
                    'data': {
                        'id': str(device.id),
                        'serial_number': device.serial_number,
                        'device_name': device.device_name,
                        'device_type': device.device_type,
                        'status': device.status,
                        'is_certified': device.is_certified,
                        'has_cmc_key': bool(device.cmc_key),
                        'message': 'Device created successfully'
                    },
                    'message': 'Device created and registered with KRA successfully'
                }, status=status.HTTP_201_CREATED)
            else:
                return Response({
                    'success': False,
                    'message': 'Failed to create device',
                    'errors': response.data
                }, status=response.status_code)
                
        except Exception as e:
            return Response({
                'success': False,
                'message': str(e),
                'errors': {'detail': str(e)}
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def perform_create(self, serializer):
        company = Company.objects.get(contact_email=self.request.user.email)
        
        # Auto-generate device serial if not provided
        if not serializer.validated_data.get('serial_number'):
            from datetime import datetime
            device_serial = f"REV-{company.tin}-{datetime.now().strftime('%Y%m%d%H%M%S')}"
            serializer.validated_data['serial_number'] = device_serial
        
        # Set default values
        serializer.validated_data.update({
            'company': company,
            'tin': company.tin,
            'bhf_id': serializer.validated_data.get('bhf_id', '000'),
            'device_type': serializer.validated_data.get('device_type', 'oscu'),
            'integration_type': serializer.validated_data.get('integration_type', 'mobile_app'),
            'status': 'pending'
        })
        
        device = serializer.save()
        
        # Initialize device with KRA immediately for OSCU
        if device.device_type == 'oscu':
            try:
                from .services.kra_client import KRAClient
                from django.conf import settings
                
                # Register TIN with mock service first (if using mock)
                if getattr(settings, 'KRA_USE_MOCK', True):
                    from .services.kra_mock_service import KRAMockService
                    KRAMockService.register_tin(device.tin)
                    logger.info(f"Registered TIN {device.tin} with KRA mock service during device creation")
                
                kra_client = KRAClient()
                init_result = kra_client.init_device(
                    tin=device.tin,
                    bhf_id=device.bhf_id,
                    serial_number=device.serial_number,
                    device_name=device.device_name
                )
                
                if init_result.get('success'):
                    device.cmc_key = init_result.get('cmc_key')
                    device.status = 'active'
                    device.is_certified = True
                    device.certification_date = timezone.now()
                    device.last_sync = timezone.now()
                    device.save()
                    logger.info(f"Device {device.serial_number} successfully registered with KRA")
                else:
                    device.status = 'failed'
                    device.save()
                    logger.error(f"Device registration failed: {init_result}")
                    
            except Exception as e:
                device.status = 'failed'
                device.save()
                logger.error(f"Device initialization error: {e}")
        else:
            # VSCU devices don't need CMC keys, just activate them
            device.status = 'active'
            device.is_certified = True
            device.certification_date = timezone.now()
            device.last_sync = timezone.now()
            device.save()


class DeviceDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, and delete device"""
    serializer_class = DeviceSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        try:
            company = Company.objects.get(contact_email=self.request.user.email)
            return Device.objects.filter(company=company)
        except Company.DoesNotExist:
            return Device.objects.none()


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def sync_device(request, device_id):
    """Sync device with KRA - validates CMC key and connection"""
    try:
        company = Company.objects.get(contact_email=request.user.email)
        device = Device.objects.get(id=device_id, company=company)
        
        # Always update last_sync timestamp for user feedback
        device.last_sync = timezone.now()
        
        # Check if device has CMC key
        if not device.cmc_key:
            device.save()  # Save the timestamp even without CMC key
            return Response({
                'error': 'Device not registered with KRA',
                'message': 'Device needs CMC key. Please register device first.',
                'requires_registration': True,
                'device': {
                    'id': str(device.id),
                    'serial_number': device.serial_number,
                    'status': device.status,
                    'last_sync': device.last_sync.isoformat()
                }
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Different sync logic for OSCU vs VSCU
        if device.device_type == 'oscu':
            # OSCU: Verify real-time connection to KRA
            from .services.kra_client import KRAClient
            from django.conf import settings
            
            # DEVELOPMENT MODE: Skip KRA connection check
            if settings.DEBUG:
                device.status = 'active'
                device.save()
                
                return Response({
                    'message': 'OSCU device synced successfully (development mode)',
                    'device': {
                        'id': str(device.id),
                        'serial_number': device.serial_number,
                        'device_type': device.device_type,
                        'last_sync': device.last_sync.isoformat(),
                        'kra_status': 'development',
                        'cmc_key_valid': True,
                        'real_time_ready': True
                    }
                })
            
            try:
                kra_client = KRAClient()
                
                # Test connection by validating device status
                is_connected = kra_client.verify_device_connection(device)
                
                if is_connected:
                    device.status = 'active'
                    device.save()
                    
                    return Response({
                        'message': 'OSCU device synced successfully - Ready for real-time invoicing',
                        'device': {
                            'id': str(device.id),
                            'serial_number': device.serial_number,
                            'device_type': device.device_type,
                            'last_sync': device.last_sync.isoformat(),
                            'kra_status': 'online',
                            'cmc_key_valid': True,
                            'real_time_ready': True
                        }
                    })
                else:
                    # Still save the timestamp even if connection failed
                    device.save()
                    
                    return Response({
                        'message': 'Device synced (KRA offline)',
                        'warning': 'KRA server is unreachable. Invoices will be queued for retry.',
                        'device': {
                            'id': str(device.id),
                            'serial_number': device.serial_number,
                            'last_sync': device.last_sync.isoformat(),
                            'kra_status': 'offline',
                            'real_time_ready': False
                        }
                    })
                    
            except Exception as e:
                logger.error(f"OSCU sync error for device {device.serial_number}: {str(e)}")
                # Still save the timestamp even if error occurred
                device.save()
                
                return Response({
                    'message': 'Device synced (KRA error)',
                    'warning': f'Connection error: {str(e)}. Invoices will be queued for retry.',
                    'device': {
                        'id': str(device.id),
                        'serial_number': device.serial_number,
                        'last_sync': device.last_sync.isoformat(),
                        'kra_status': 'error',
                        'real_time_ready': False
                    }
                })
        
        elif device.device_type == 'vscu':
            # VSCU: Update timestamp, batch sync handled separately
            device.status = 'active'
            device.save()
            
            return Response({
                'message': 'VSCU device synced successfully - Ready for batch processing',
                'device': {
                    'id': str(device.id),
                    'serial_number': device.serial_number,
                    'device_type': device.device_type,
                    'last_sync': device.last_sync.isoformat(),
                    'batch_ready': True
                },
                'note': 'Use /vscu/sync/ endpoint for batch invoice sync'
            })
        
        else:
            device.save()  # Save timestamp even for unknown device type
            return Response({
                'error': 'Unknown device type',
                'message': f'Device type {device.device_type} is not supported',
                'device': {
                    'last_sync': device.last_sync.isoformat()
                }
            }, status=status.HTTP_400_BAD_REQUEST)
        
    except (Company.DoesNotExist, Device.DoesNotExist):
        return Response(
            {'error': 'Device not found'}, 
            status=status.HTTP_404_NOT_FOUND
        )


class InvoiceListCreateView(generics.ListCreateAPIView):
    """List and create invoices"""
    serializer_class = InvoiceSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        try:
            company = Company.objects.get(contact_email=self.request.user.email)
            queryset = Invoice.objects.filter(company=company).order_by('-created_at')
            
            # Filter by status if provided
            status_filter = self.request.query_params.get('status')
            if status_filter:
                queryset = queryset.filter(status=status_filter)
            
            return queryset
        except Company.DoesNotExist:
            return Invoice.objects.none()
    
    def list(self, request, *args, **kwargs):
        """Override list to provide mobile-friendly response format"""
        queryset = self.get_queryset()
        page = self.paginate_queryset(queryset)
        
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            invoices_data = self._format_invoices_for_mobile(serializer.data)
            # Return consistent format for paginated response
            return Response({
                'success': True,
                'data': invoices_data,
                'results': invoices_data,
                'count': len(invoices_data)
            })
        
        serializer = self.get_serializer(queryset, many=True)
        invoices_data = self._format_invoices_for_mobile(serializer.data)
        
        return Response({
            'success': True,
            'data': invoices_data,
            'results': invoices_data,  # Mobile app expects this field
            'count': len(invoices_data)
        })
    
    def _format_invoices_for_mobile(self, invoices_data):
        """Format invoice data for mobile app compatibility"""
        formatted_invoices = []
        
        for invoice_data in invoices_data:
            try:
                invoice = Invoice.objects.get(id=invoice_data['id'])
                formatted_invoice = {
                    # Backend format
                    'id': invoice_data['id'],
                    'invoice_no': invoice_data['invoice_no'],
                    'customer_name': invoice_data['customer_name'],
                    'customer_tin': invoice_data['customer_tin'],
                    'total_amount': invoice_data.get('total_amount', 0),
                    'tax_amount': invoice_data.get('tax_amount', 0),
                    'currency': invoice_data.get('currency', 'KES'),
                    'payment_type': invoice_data.get('payment_type', 'cash'),
                    'receipt_type': invoice_data.get('receipt_type', 'normal'),
                    'transaction_type': invoice_data.get('transaction_type', 'sale'),
                    'status': invoice_data.get('status', 'pending'),
                    'receipt_no': invoice_data.get('receipt_no', ''),
                    'created_at': invoice_data.get('created_at'),
                    'updated_at': invoice_data.get('updated_at'),
                    'transaction_date': invoice_data.get('transaction_date'),
                    'synced_at': invoice_data.get('synced_at'),
                    'error_message': invoice_data.get('error_message', ''),
                    'retry_count': invoice_data.get('retry_count', 0),
                    
                    # Mobile app format (camelCase)
                    'invoiceNumber': invoice_data.get('invoice_no', ''),
                    'customerName': invoice_data.get('customer_name', ''),
                    'customerPin': invoice_data.get('customer_tin', ''),
                    'totalAmount': float(invoice_data.get('total_amount', 0)) if invoice_data.get('total_amount') else 0,
                    'taxAmount': float(invoice_data.get('tax_amount', 0)) if invoice_data.get('tax_amount') else 0,
                    'amount': float(invoice_data.get('total_amount', 0)) if invoice_data.get('total_amount') else 0,
                    'createdAt': invoice_data.get('created_at'),
                    'updatedAt': invoice_data.get('updated_at'),
                    'integrationMode': invoice.device.device_type.upper() if invoice.device else 'OSCU',
                    'retryCount': invoice_data.get('retry_count', 0),
                    
                    # Additional mobile-specific fields
                    'items': [
                        {
                            'id': str(item.id),
                            'description': item.item_name,
                            'item_name': item.item_name,
                            'item_code': item.item_code,
                            'quantity': float(item.quantity),
                            'unitPrice': float(item.unit_price),
                            'unit_price': float(item.unit_price),
                            'taxRate': float(item.tax_rate),
                            'tax_rate': float(item.tax_rate),
                            'totalAmount': float(item.total_price),
                            'total_price': float(item.total_price),
                            'unit_of_measure': item.unit_of_measure
                        }
                        for item in invoice.items.all()
                    ]
                }
                formatted_invoices.append(formatted_invoice)
            except Invoice.DoesNotExist:
                # Skip if invoice not found
                continue
                
        return formatted_invoices
    
    def create(self, request, *args, **kwargs):
        """Override create to provide enhanced response with real-time status"""
        response = super().create(request, *args, **kwargs)
        
        if response.status_code == 201:
            # Get the created invoice
            invoice_data = response.data
            invoice = Invoice.objects.get(id=invoice_data['id'])
            
            # Format response to match mobile app expectations
            response.data = {
                'success': True,
                'data': {
                    'id': str(invoice.id),
                    'invoice_no': invoice.invoice_no,
                    'invoiceNumber': invoice.invoice_no,  # Mobile app expects this field
                    'customer_name': invoice.customer_name,
                    'customerName': invoice.customer_name,  # Mobile app expects this field
                    'customer_tin': invoice.customer_tin,
                    'customerPin': invoice.customer_tin,  # Mobile app expects this field
                    'total_amount': float(invoice.total_amount),
                    'totalAmount': float(invoice.total_amount),  # Mobile app expects this field
                    'tax_amount': float(invoice.tax_amount),
                    'taxAmount': float(invoice.tax_amount),  # Mobile app expects this field
                    'currency': invoice.currency,
                    'payment_type': invoice.payment_type,
                    'receipt_type': invoice.receipt_type,
                    'transaction_type': invoice.transaction_type,
                    'status': invoice.status,
                    'receipt_no': invoice.receipt_no,
                    'created_at': invoice.created_at.isoformat(),
                    'createdAt': invoice.created_at.isoformat(),  # Mobile app expects this field
                    'updated_at': invoice.updated_at.isoformat(),
                    'updatedAt': invoice.updated_at.isoformat(),  # Mobile app expects this field
                    'transaction_date': invoice.transaction_date.isoformat(),
                    'synced_at': invoice.synced_at.isoformat() if invoice.synced_at else None,
                    'error_message': invoice.error_message,
                    'retry_count': invoice.retry_count,
                    'device': {
                        'id': str(invoice.device.id),
                        'serial_number': invoice.device.serial_number,
                        'device_type': invoice.device.device_type,
                        'status': invoice.device.status
                    },
                    'items': [
                        {
                            'id': str(item.id),
                            'item_name': item.item_name,
                            'description': item.item_name,  # Mobile app expects this field
                            'item_code': item.item_code,
                            'quantity': float(item.quantity),
                            'unit_price': float(item.unit_price),
                            'unitPrice': float(item.unit_price),  # Mobile app expects this field
                            'tax_type': item.tax_type,
                            'tax_rate': float(item.tax_rate),
                            'taxRate': float(item.tax_rate),  # Mobile app expects this field
                            'tax_amount': float(item.tax_amount),
                            'total_price': float(item.total_price),
                            'totalAmount': float(item.total_price),  # Mobile app expects this field
                            'unit_of_measure': item.unit_of_measure
                        }
                        for item in invoice.items.all()
                    ]
                },
                'kra_status': invoice.status,
                'receipt_number': invoice.receipt_no,
                'sync_timestamp': invoice.synced_at.isoformat() if invoice.synced_at else None,
                'real_time_processing': invoice.device.device_type == 'oscu',
                'message': self._get_status_message(invoice)
            }
        else:
            # Format error response
            response.data = {
                'success': False,
                'message': response.data.get('detail') or 'Failed to create invoice',
                'errors': response.data if isinstance(response.data, dict) else {}
            }
        
        return response
    
    def _get_status_message(self, invoice):
        """Get user-friendly status message"""
        if invoice.status == 'confirmed':
            return f"✅ Invoice approved by KRA. Receipt number: {invoice.receipt_no}"
        elif invoice.status == 'failed':
            return f"❌ Invoice rejected by KRA: {invoice.error_message}"
        elif invoice.status == 'retry':
            return "🔄 Invoice queued for retry due to network issues"
        elif invoice.status == 'pending':
            return "⏳ Invoice created, waiting for KRA processing"
        else:
            return f"📋 Invoice status: {invoice.status}"
    
    def perform_create(self, serializer):
        from .services.compliance_service import ComplianceService
        from .services.kra_client import KRAClient
        from rest_framework.exceptions import ValidationError
        
        company = Company.objects.get(contact_email=self.request.user.email)
        
        # Check subscription limits FIRST
        can_create, limit_message = company.can_create_invoice
        if not can_create:
            if 'subscription' in limit_message.lower():
                raise ValidationError({
                    'subscription_error': True,
                    'message': limit_message,
                    'action_required': 'upgrade_subscription'
                })
            elif 'limit' in limit_message.lower():
                raise ValidationError({
                    'limit_error': True,
                    'message': limit_message,
                    'action_required': 'upgrade_plan'
                })
            else:
                raise ValidationError(limit_message)
        
        # Get the first active device for this company
        device = Device.objects.filter(company=company, status='active').first()
        if not device:
            raise ValidationError('No active device found. Please register a device first.')
        
        # Validate device has CMC key for OSCU
        if device.device_type == 'oscu' and not device.cmc_key:
            raise ValidationError('Device not properly registered with KRA. Missing CMC key.')
        
        # Check device certification
        is_certified, cert_msg = ComplianceService.check_device_certification(device)
        if not is_certified:
            raise ValidationError(cert_msg)
        
        # Check 24-hour offline rule
        can_create, offline_msg = ComplianceService.can_create_invoice(device)
        if not can_create:
            raise ValidationError(offline_msg)
        
        # Validate copy receipt requirements
        is_valid_copy, copy_msg = ComplianceService.validate_receipt_copy(self.request.data)
        if not is_valid_copy:
            raise ValidationError(copy_msg)
        
        # Generate sequential invoice number
        invoice_no = device.get_next_receipt_number()
        
        # Create invoice with generated invoice number
        invoice = serializer.save(
            company=company,
            device=device,
            tin=company.tin,
            invoice_no=invoice_no
        )
        
        # Increment subscription usage
        subscription = company.current_subscription
        if subscription:
            subscription.increment_invoice_usage()
        
        # Create invoice items
        items_data = self.request.data.get('items', [])
        for item_data in items_data:
            InvoiceItem.objects.create(
                invoice=invoice,
                item_code=item_data['item_code'],
                item_name=item_data['item_name'],
                quantity=Decimal(str(item_data['quantity'])),
                unit_price=Decimal(str(item_data['unit_price'])),
                tax_type=item_data['tax_type'],
                tax_rate=self.get_tax_rate(item_data['tax_type']),
                unit_of_measure=item_data['unit_of_measure']
            )
        
        # Generate QR code for the invoice
        from .services.qr_service import QRCodeService
        QRCodeService.update_invoice_qr(invoice)
        
        # REAL-TIME SUBMISSION TO KRA WITH CELERY FALLBACK
        if device.device_type == 'oscu':
            # OSCU: Try immediate submission first, fallback to Celery retry
            try:
                logger.info(f"Attempting real-time KRA submission for invoice {invoice.invoice_no}")
                logger.info(f"Device TIN: {device.tin}, Company TIN: {company.tin}")
                
                # Ensure TIN is registered with mock service (fallback for old registrations)
                from django.conf import settings
                if getattr(settings, 'KRA_USE_MOCK', True):
                    from .services.kra_mock_service import KRAMockService
                    if not KRAMockService.is_tin_registered(company.tin):
                        KRAMockService.register_tin(company.tin)
                        logger.info(f"Auto-registered TIN {company.tin} with mock service during invoice creation")
                
                kra_client = KRAClient()
                result = kra_client.send_sales_invoice(invoice)
                
                logger.info(f"KRA submission result: {result}")
                
                if result.get('success'):
                    # Update invoice with KRA response
                    invoice.receipt_no = result.get('receipt_no')
                    invoice.internal_data = result.get('internal_data')
                    invoice.receipt_signature = result.get('receipt_signature')
                    invoice.qr_code_data = result.get('qr_code', '')
                    invoice.status = 'confirmed'
                    invoice.synced_at = timezone.now()
                    invoice.save()
                    
                    # Generate QR code if not provided by KRA
                    if not invoice.qr_code_data:
                        QRCodeService.update_invoice_qr(invoice)
                    
                    logger.info(f"Invoice {invoice.invoice_no} successfully submitted to KRA in real-time")
                else:
                    logger.error(f"KRA submission failed: {result.get('error_message', 'Unknown error')}")
                    # Check if retryable
                    if result.get('is_retryable', True):
                        # Queue for Celery retry
                        invoice.status = 'retry'
                        invoice.error_message = result.get('error_message', 'KRA submission failed')
                        invoice.save()
                        
                        # Create retry queue entry
                        RetryQueue.objects.create(
                            invoice=invoice,
                            task_type='sales_retry',
                            next_retry=timezone.now() + timedelta(minutes=1),  # First retry in 1 minute
                            error_details=result.get('error_message', 'Initial submission failed')
                        )
                        
                        # Queue Celery task for retry
                        from .tasks import retry_sales_invoice
                        retry_sales_invoice.apply_async(
                            args=[str(invoice.id)],
                            countdown=60  # Retry in 60 seconds
                        )
                        
                        logger.info(f"Invoice {invoice.invoice_no} queued for Celery retry")
                    else:
                        # Permanent failure
                        invoice.status = 'failed'
                        invoice.error_message = result.get('error_message', 'KRA submission failed')
                        invoice.save()
                        
                        logger.error(f"Invoice {invoice.invoice_no} permanently failed: {result.get('error_message')}")
                    
            except Exception as e:
                # Network/connection error - queue for retry
                invoice.status = 'retry'
                invoice.error_message = f"Connection error: {str(e)}"
                invoice.save()
                
                # Create retry queue entry
                RetryQueue.objects.create(
                    invoice=invoice,
                    task_type='sales_retry',
                    next_retry=timezone.now() + timedelta(minutes=2),  # First retry in 2 minutes
                    error_details=f"Connection error: {str(e)}"
                )
                
                # Queue Celery task for retry
                from .tasks import retry_sales_invoice
                retry_sales_invoice.apply_async(
                    args=[str(invoice.id)],
                    countdown=120  # Retry in 2 minutes
                )
                
                logger.error(f"Invoice {invoice.invoice_no} connection error, queued for retry: {e}")
        
        elif device.device_type == 'vscu':
            # VSCU: Always use Celery for batch processing
            invoice.status = 'pending'
            invoice.save()
            
            from .tasks import retry_sales_invoice
            retry_sales_invoice.delay(str(invoice.id))
    
    def get_tax_rate(self, tax_type):
        """Get tax rate based on tax type"""
        tax_rates = {
            'A': Decimal('16.00'),  # VAT Standard Rate
            'B': Decimal('8.00'),   # VAT Reduced Rate
            'C': Decimal('0.00'),   # VAT Zero Rate
            'D': Decimal('0.00'),   # VAT Exempt
            'E': Decimal('0.00'),   # Special Tax
        }
        return tax_rates.get(tax_type, Decimal('0.00'))


class InvoiceDetailView(generics.RetrieveAPIView):
    """Retrieve invoice details"""
    serializer_class = InvoiceSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        try:
            company = Company.objects.get(contact_email=self.request.user.email)
            return Invoice.objects.filter(company=company)
        except Company.DoesNotExist:
            return Invoice.objects.none()
    
    def retrieve(self, request, *args, **kwargs):
        """Override retrieve to provide mobile-friendly response format"""
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        
        # Format response to match mobile app expectations
        return Response({
            'success': True,
            'data': serializer.data
        })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def resync_invoice(request, invoice_id):
    """Resync failed invoice"""
    try:
        company = Company.objects.get(contact_email=request.user.email)
        invoice = Invoice.objects.get(id=invoice_id, company=company)
        
        if invoice.status not in ['failed', 'retry', 'pending']:
            return Response(
                {'error': 'Only failed or pending invoices can be resynced'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create or update retry queue entry
        retry_entry, created = RetryQueue.objects.get_or_create(
            invoice=invoice,
            defaults={
                'task_type': 'sales_retry',
                'next_retry': timezone.now(),
                'error_details': 'Manual resync requested'
            }
        )
        
        if not created:
            retry_entry.next_retry = timezone.now()
            retry_entry.error_details = 'Manual resync requested'
            retry_entry.status = 'pending'
            retry_entry.save()
        
        # Update invoice status to retry
        invoice.status = 'retry'
        invoice.retry_count += 1
        invoice.save()
        
        return Response({
            'message': 'Invoice queued for resync',
            'invoice': {
                'id': str(invoice.id),
                'invoice_no': invoice.invoice_no,
                'status': invoice.status,
                'retry_count': invoice.retry_count
            }
        })
        
    except (Company.DoesNotExist, Invoice.DoesNotExist):
        return Response(
            {'error': 'Invoice not found'}, 
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def retry_all_failed(request):
    """Retry all failed invoices for the authenticated user's company"""
    try:
        company = Company.objects.get(contact_email=request.user.email)
        
        # Get all failed invoices
        failed_invoices = Invoice.objects.filter(
            company=company,
            status__in=['failed', 'retry']
        )
        
        count = failed_invoices.count()
        
        if count == 0:
            return Response({
                'success': True,
                'message': 'No failed invoices to retry',
                'count': 0
            })
        
        # Queue all failed invoices for retry
        for invoice in failed_invoices:
            # Create or update retry queue entry
            retry_entry, created = RetryQueue.objects.get_or_create(
                invoice=invoice,
                defaults={
                    'task_type': 'sales_retry',
                    'next_retry': timezone.now(),
                    'error_details': 'Manual retry all requested'
                }
            )
            
            if not created:
                retry_entry.next_retry = timezone.now()
                retry_entry.error_details = 'Manual retry all requested'
                retry_entry.status = 'pending'
                retry_entry.save()
            
            # Update invoice status
            invoice.status = 'retry'
            invoice.retry_count += 1
            invoice.save()
        
        return Response({
            'success': True,
            'message': f'{count} invoice(s) queued for retry',
            'count': count
        })
        
    except Company.DoesNotExist:
        return Response(
            {
                'success': False,
                'message': 'Company not found',
                'error': 'Company not found'
            }, 
            status=status.HTTP_404_NOT_FOUND
        )


class ItemMasterListCreateView(generics.ListCreateAPIView):
    """List and create items"""
    serializer_class = ItemMasterSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = ItemMaster.objects.filter(is_active=True)
    
    def get_queryset(self):
        queryset = super().get_queryset()
        search = self.request.query_params.get('search')
        
        if search:
            queryset = queryset.filter(
                Q(item_name__icontains=search) |
                Q(item_code__icontains=search) |
                Q(category__icontains=search)
            )
        
        return queryset.order_by('item_name')


class ComplianceReportListView(generics.ListAPIView):
    """List compliance reports"""
    serializer_class = ComplianceReportSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        try:
            company = Company.objects.get(contact_email=self.request.user.email)
            queryset = ComplianceReport.objects.filter(company=company).order_by('-created_at')
            
            # Filter by report type if provided
            report_type = self.request.query_params.get('report_type')
            if report_type:
                queryset = queryset.filter(report_type=report_type)
            
            return queryset
        except Company.DoesNotExist:
            return ComplianceReport.objects.none()


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def generate_report(request):
    """Generate a new compliance report"""
    try:
        company = Company.objects.get(contact_email=request.user.email)
        
        report_type = request.data.get('report_type', 'daily')
        start_date = request.data.get('start_date')
        end_date = request.data.get('end_date')
        
        if not start_date or not end_date:
            return Response(
                {'error': 'start_date and end_date are required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Parse dates
        start_date = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        end_date = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        
        # Generate report data
        invoices = Invoice.objects.filter(
            company=company,
            created_at__gte=start_date,
            created_at__lte=end_date
        )
        
        total_invoices = invoices.count()
        successful_invoices = invoices.filter(status='confirmed').count()
        failed_invoices = invoices.filter(status='failed').count()
        
        financial_data = invoices.filter(status='confirmed').aggregate(
            total_value=Sum('total_amount'),
            total_tax=Sum('tax_amount')
        )
        
        kra_acknowledgments = ApiLog.objects.filter(
            company=company,
            request_type='sales',
            status_code=200,
            created_at__gte=start_date,
            created_at__lte=end_date
        ).count()
        
        # Create report
        report = ComplianceReport.objects.create(
            company=company,
            report_type=report_type,
            period_start=start_date,
            period_end=end_date,
            total_invoices=total_invoices,
            successful_invoices=successful_invoices,
            failed_invoices=failed_invoices,
            total_value=financial_data['total_value'] or 0,
            total_tax=financial_data['total_tax'] or 0,
            kra_acknowledgments=kra_acknowledgments,
            detailed_data={
                'success_rate': round((successful_invoices / total_invoices * 100) if total_invoices > 0 else 0, 2),
                'generated_at': timezone.now().isoformat()
            }
        )
        
        serializer = ComplianceReportSerializer(report)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
        
    except Company.DoesNotExist:
        return Response(
            {'error': 'Company not found'}, 
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response(
            {'error': str(e)}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def trigger_vscu_sync(request):
    """Trigger VSCU sync for pending invoices"""
    try:
        company = Company.objects.get(contact_email=request.user.email)
        
        # Get VSCU devices
        vscu_devices = Device.objects.filter(
            company=company, 
            device_type='vscu', 
            status='active'
        )
        
        if not vscu_devices.exists():
            return Response(
                {'error': 'No active VSCU devices found'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update last_sync for all VSCU devices
        vscu_devices.update(last_sync=timezone.now())
        
        # Get pending invoices
        pending_invoices = Invoice.objects.filter(
            company=company,
            device__in=vscu_devices,
            status='pending'
        )
        
        return Response({
            'message': f'VSCU sync completed. {vscu_devices.count()} devices synced, {pending_invoices.count()} pending invoices',
            'synced_devices': vscu_devices.count(),
            'pending_invoices': pending_invoices.count()
        })
        
    except Company.DoesNotExist:
        return Response(
            {'error': 'Company not found'}, 
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def vscu_status(request):
    """Get VSCU sync status"""
    try:
        company = Company.objects.get(contact_email=request.user.email)
        
        # Get VSCU devices and their status
        vscu_devices = Device.objects.filter(
            company=company, 
            device_type='vscu'
        )
        
        pending_invoices = Invoice.objects.filter(
            company=company,
            device__in=vscu_devices,
            status='pending'
        ).count()
        
        retry_queue_count = RetryQueue.objects.filter(
            invoice__company=company,
            status='pending'
        ).count()
        
        return Response({
            'vscu_devices': vscu_devices.count(),
            'active_vscu_devices': vscu_devices.filter(status='active').count(),
            'pending_invoices': pending_invoices,
            'retry_queue_size': retry_queue_count,
            'last_sync': vscu_devices.filter(last_sync__isnull=False).aggregate(
                latest=Max('last_sync')
            )['latest']
        })
        
    except Company.DoesNotExist:
        return Response(
            {'error': 'Company not found'}, 
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def mobile_api_root(request):
    """Mobile API root endpoint - lists available endpoints"""
    return Response({
        'message': 'Revpay Connect Mobile API',
        'version': '1.0.0',
        'endpoints': {
            'authentication': {
                'login': '/api/mobile/auth/login/',
                'register': '/api/mobile/auth/register/',
                'refresh': '/api/mobile/auth/refresh/',
                'logout': '/api/mobile/auth/logout/',
            },
            'dashboard': {
                'stats': '/api/mobile/dashboard/stats/',
            },
            'company': {
                'profile': '/api/mobile/company/profile/',
            },
            'devices': {
                'list_create': '/api/mobile/devices/',
                'detail': '/api/mobile/devices/{id}/',
                'sync': '/api/mobile/devices/{id}/sync/',
            },
            'invoices': {
                'list_create': '/api/mobile/invoices/',
                'detail': '/api/mobile/invoices/{id}/',
                'resync': '/api/mobile/invoices/{id}/resync/',
            },
            'items': {
                'list_create': '/api/mobile/items/',
            },
            'reports': {
                'list': '/api/mobile/reports/',
                'generate': '/api/mobile/reports/generate/',
            },
            'vscu': {
                'sync': '/api/mobile/vscu/sync/',
                'status': '/api/mobile/vscu/status/',
            },
            'health': '/api/mobile/health/',
        },
        'timestamp': timezone.now().isoformat()
    })

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def health_check(request):
    """Health check endpoint"""
    return Response({
        'status': 'healthy',
        'timestamp': timezone.now().isoformat(),
        'version': '1.0.0'
    })


# New KRA Compliance API Endpoints

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_kra_codes(request):
    """Get KRA standard codes (tax types, units, countries, etc.)"""
    try:
        code_service = CodeManagementService()
        code_type = request.GET.get('type', 'all')
        query = request.GET.get('q', '')
        
        if code_type == 'all':
            # Get all codes
            codes = code_service.sync_all_codes()
        else:
            # Search specific code type
            codes = {
                'success': True,
                'data': {code_type: code_service.search_codes(code_type, query)}
            }
        
        return Response(codes)
        
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def generate_z_report(request):
    """Generate Z-Report for a device"""
    try:
        company = Company.objects.get(contact_email=request.user.email)
        device_serial = request.GET.get('device_serial')
        report_date = request.GET.get('date')
        
        if device_serial:
            device = Device.objects.get(company=company, serial_number=device_serial)
        else:
            device = Device.objects.filter(company=company, status='active').first()
            
        if not device:
            return Response({
                'error': 'No active device found'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Parse date if provided
        date_obj = None
        if report_date:
            date_obj = datetime.strptime(report_date, '%Y-%m-%d').date()
        
        report = ReportsService.generate_z_report(device, date_obj)
        
        return Response({
            'success': True,
            'report': report
        })
        
    except Company.DoesNotExist:
        return Response({
            'error': 'Company not found'
        }, status=status.HTTP_404_NOT_FOUND)
    except Device.DoesNotExist:
        return Response({
            'error': 'Device not found'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_real_time_analytics(request):
    """Get real-time dashboard analytics"""
    try:
        company = Company.objects.get(contact_email=request.user.email)
        analytics = ReportsService.generate_real_time_dashboard(company)
        
        return Response({
            'success': True,
            'data': analytics
        })
        
    except Company.DoesNotExist:
        return Response({
            'error': 'Company not found'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Subscription Management API Endpoints

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def get_subscription_plans(request):
    """Get available subscription plans (public endpoint)"""
    try:
        from .models import SubscriptionPlan
        
        plans = SubscriptionPlan.objects.filter(is_active=True).order_by('sort_order', 'price')
        
        # If no plans exist, return empty list instead of error
        if not plans.exists():
            logger.warning("No subscription plans found in database. Run: python manage.py shell < scripts/seed_subscription_plans.py")
            return Response({
                'success': True,
                'plans': [],
                'data': [],
                'message': 'No subscription plans available. Please contact administrator.'
            })
        
        plans_data = []
        for plan in plans:
            plans_data.append({
                'id': str(plan.id),
                'name': plan.name,
                'plan_type': plan.plan_type,
                'description': plan.description,
                'price': float(plan.price),
                'currency': plan.currency,
                'billing_cycle': plan.billing_cycle,
                'monthly_price': float(plan.monthly_price),
                'invoice_limit_per_month': plan.invoice_limit_per_month,
                'device_limit': plan.device_limit,
                'user_limit': plan.user_limit,
                'features': plan.features,
                'is_popular': plan.is_popular,
                'trial_days': plan.trial_days
            })
        
        return Response({
            'success': True,
            'plans': plans_data,  # Mobile app expects 'plans' key
            'data': plans_data    # Also include 'data' for consistency
        })
        
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_current_subscription(request):
    """Get current user's subscription details"""
    try:
        company = Company.objects.get(contact_email=request.user.email)
        subscription = company.current_subscription
        
        # If no subscription exists, return a default free plan
        if not subscription:
            return Response({
                'success': True,
                'data': {
                    'subscription': {
                        'id': 'free-plan',
                        'plan': {
                            'id': 'free',
                            'name': 'Free Plan',
                            'plan_type': 'free',
                            'price': 0.0,
                            'currency': 'KES',
                            'billing_cycle': 'monthly',
                            'invoice_limit_per_month': 100,
                            'device_limit': 2,
                            'features': {
                                'basic_invoicing': True,
                                'device_management': True,
                                'dashboard': True
                            }
                        },
                        'status': 'active',
                        'is_trial': False,
                        'trial_days_left': 0,
                        'days_remaining': 999,
                        'current_period_start': timezone.now().isoformat(),
                        'current_period_end': (timezone.now() + timedelta(days=365)).isoformat(),
                        'invoices_used_this_month': Invoice.objects.filter(
                            company=company,
                            created_at__month=timezone.now().month,
                            created_at__year=timezone.now().year
                        ).count(),
                        'devices_used': Device.objects.filter(company=company).count(),
                        'payment_method': 'none',
                        'auto_renew': False,
                        'can_create_invoice': True,
                        'can_add_device': True
                    }
                }
            })
        
        subscription_data = {
            'id': str(subscription.id),
            'plan': {
                'id': str(subscription.plan.id),
                'name': subscription.plan.name,
                'plan_type': subscription.plan.plan_type,
                'price': float(subscription.plan.price),
                'currency': subscription.plan.currency,
                'billing_cycle': subscription.plan.billing_cycle,
                'invoice_limit_per_month': subscription.plan.invoice_limit_per_month,
                'device_limit': subscription.plan.device_limit,
                'features': subscription.plan.features
            },
            'status': subscription.status,
            'is_trial': subscription.is_trial,
            'trial_days_left': subscription.trial_days_left,
            'days_remaining': subscription.days_remaining,
            'current_period_start': subscription.current_period_start.isoformat(),
            'current_period_end': subscription.current_period_end.isoformat(),
            'invoices_used_this_month': subscription.invoices_used_this_month,
            'devices_used': subscription.devices_used,
            'payment_method': subscription.payment_method,
            'auto_renew': subscription.auto_renew,
            'can_create_invoice': subscription.can_create_invoice[0],
            'can_add_device': subscription.can_add_device[0]
        }
        
        return Response({
            'success': True,
            'data': {
                'subscription': subscription_data
            }
        })
        
    except Company.DoesNotExist:
        return Response({
            'success': False,
            'error': 'Company not found'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def check_subscription_limits(request):
    """Check if user can perform an action based on subscription limits"""
    try:
        company = Company.objects.get(contact_email=request.user.email)
        action = request.data.get('action')
        
        if action == 'create_invoice':
            result = company.can_create_invoice
            # Handle both tuple and direct boolean returns
            if isinstance(result, tuple):
                can_create, message = result
            else:
                can_create = result
                message = "Can create invoice" if result else "Cannot create invoice"
            
            return Response({
                'success': True,
                'data': {
                    'allowed': can_create,
                    'message': message,
                    'reason': 'subscription_expired' if 'subscription' in message.lower() and not can_create else 
                             'invoice_limit_reached' if 'limit' in message.lower() and not can_create else 'allowed'
                }
            })
        elif action == 'add_device':
            result = company.can_add_device
            # Handle both tuple and direct boolean returns
            if isinstance(result, tuple):
                can_add, message = result
            else:
                can_add = result
                message = "Can add device" if result else "Cannot add device"
            
            return Response({
                'success': True,
                'data': {
                    'allowed': can_add,
                    'message': message,
                    'reason': 'device_limit_reached' if 'limit' in message.lower() and not can_add else 'allowed'
                }
            })
        else:
            return Response({
                'success': False,
                'error': 'Invalid action'
            }, status=status.HTTP_400_BAD_REQUEST)
        
    except Company.DoesNotExist:
        return Response({
            'success': False,
            'error': 'Company not found'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error checking subscription limits: {str(e)}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def initiate_payment(request):
    """Initiate payment for subscription upgrade"""
    try:
        from .models import SubscriptionPlan, Payment
        
        company = Company.objects.get(contact_email=request.user.email)
        plan_id = request.data.get('plan_id')
        payment_method = request.data.get('payment_method', 'mpesa')
        
        if not plan_id:
            return Response({
                'success': False,
                'error': 'Plan ID is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        plan = SubscriptionPlan.objects.get(id=plan_id)
        subscription = company.current_subscription
        
        if not subscription:
            return Response({
                'success': False,
                'error': 'No subscription found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Create payment record
        payment = Payment.objects.create(
            subscription=subscription,
            amount=plan.price,
            currency=plan.currency,
            payment_method=payment_method,
            status='pending',
            billing_period_start=subscription.current_period_start,
            billing_period_end=subscription.current_period_end,
            due_date=timezone.now() + timedelta(days=7)
        )
        
        # Generate payment instructions based on method
        if payment_method == 'mpesa':
            payment_instructions = {
                'method': 'mpesa',
                'paybill': '522522',
                'account_number': f'REVPAY{company.tin}',
                'amount': float(plan.price),
                'reference': str(payment.id)[:8].upper()
            }
        elif payment_method == 'bank_transfer':
            payment_instructions = {
                'method': 'bank_transfer',
                'bank_name': 'KCB Bank',
                'account_number': '1234567890',
                'account_name': 'RevPay Connect Ltd',
                'amount': float(plan.price),
                'reference': str(payment.id)[:8].upper()
            }
        else:
            payment_instructions = {
                'method': payment_method,
                'amount': float(plan.price),
                'reference': str(payment.id)[:8].upper()
            }
        
        return Response({
            'success': True,
            'data': {
                'payment_id': str(payment.id),
                'amount': float(plan.price),
                'currency': plan.currency,
                'plan_name': plan.name,
                'payment_instructions': payment_instructions,
                'expires_at': (timezone.now() + timedelta(hours=24)).isoformat()
            }
        })
        
    except Company.DoesNotExist:
        return Response({
            'success': False,
            'error': 'Company not found'
        }, status=status.HTTP_404_NOT_FOUND)
    except SubscriptionPlan.DoesNotExist:
        return Response({
            'success': False,
            'error': 'Subscription plan not found'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def confirm_payment(request):
    """Confirm payment and upgrade subscription"""
    try:
        from .models import Payment, SubscriptionPlan
        
        company = Company.objects.get(contact_email=request.user.email)
        payment_id = request.data.get('payment_id')
        transaction_reference = request.data.get('transaction_reference')
        
        if not payment_id:
            return Response({
                'success': False,
                'error': 'Payment ID is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        payment = Payment.objects.get(id=payment_id, subscription__company=company)
        
        if payment.status != 'pending':
            return Response({
                'success': False,
                'error': 'Payment already processed'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Update payment status
        payment.status = 'completed'
        payment.payment_date = timezone.now()
        payment.external_transaction_id = transaction_reference
        payment.save()
        
        # Update subscription
        subscription = payment.subscription
        subscription.status = 'active'
        subscription.is_trial = False
        subscription.last_payment_date = timezone.now()
        subscription.next_payment_date = timezone.now() + timedelta(days=30)  # Next month
        subscription.save()
        
        return Response({
            'success': True,
            'data': {
                'message': 'Payment confirmed successfully',
                'subscription_status': 'active',
                'next_payment_date': subscription.next_payment_date.isoformat()
            }
        })
        
    except Company.DoesNotExist:
        return Response({
            'success': False,
            'error': 'Company not found'
        }, status=status.HTTP_404_NOT_FOUND)
    except Payment.DoesNotExist:
        return Response({
            'success': False,
            'error': 'Payment not found'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_invoice_receipt(request, invoice_id):
    """Get formatted receipt data for mobile display"""
    try:
        from .services.receipt_service import ReceiptService
        
        company = Company.objects.get(contact_email=request.user.email)
        invoice = Invoice.objects.get(id=invoice_id, company=company)
        
        # Format receipt for mobile
        receipt_data = ReceiptService.format_receipt_for_mobile(invoice)
        
        return Response({
            'success': True,
            'data': receipt_data
        })
        
    except Company.DoesNotExist:
        return Response({
            'success': False,
            'error': 'Company not found'
        }, status=status.HTTP_404_NOT_FOUND)
    except Invoice.DoesNotExist:
        return Response({
            'success': False,
            'error': 'Invoice not found'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error generating receipt: {str(e)}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_invoice_receipt_print(request, invoice_id):
    """Get formatted receipt data for printing (ONETIMS format)"""
    try:
        from .services.receipt_service import ReceiptService
        from django.http import HttpResponse
        
        company = Company.objects.get(contact_email=request.user.email)
        invoice = Invoice.objects.get(id=invoice_id, company=company)
        
        # Generate HTML receipt
        html_content = ReceiptService.generate_receipt_html(invoice, format_type='print')
        
        return HttpResponse(html_content, content_type='text/html')
        
    except Company.DoesNotExist:
        return Response({
            'success': False,
            'error': 'Company not found'
        }, status=status.HTTP_404_NOT_FOUND)
    except Invoice.DoesNotExist:
        return Response({
            'success': False,
            'error': 'Invoice not found'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error generating print receipt: {str(e)}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def export_invoice_pdf(request, invoice_id):
    """Export invoice as PDF with QR code and digital signature"""
    try:
        from .services.pdf_service import InvoicePDFGenerator
        from django.http import HttpResponse
        import traceback
        
        company = Company.objects.get(contact_email=request.user.email)
        invoice = Invoice.objects.get(id=invoice_id, company=company)
        
        # Generate PDF
        try:
            pdf_data = InvoicePDFGenerator.generate_invoice_pdf(invoice)
        except Exception as pdf_error:
            logger.error(f"PDF generation error: {str(pdf_error)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            return Response({
                'success': False,
                'error': f'PDF generation failed: {str(pdf_error)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        # Create response
        response = HttpResponse(pdf_data, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="invoice_{invoice.invoice_no}.pdf"'
        
        logger.info(f"PDF exported for invoice {invoice.invoice_no}")
        
        return response
        
    except Company.DoesNotExist:
        return Response({
            'success': False,
            'error': 'Company not found'
        }, status=status.HTTP_404_NOT_FOUND)
    except Invoice.DoesNotExist:
        return Response({
            'success': False,
            'error': 'Invoice not found'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error exporting PDF: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    except Exception as e:
        logger.error(f"Error exporting PDF: {str(e)}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def activate_device(request):
    """
    Activate a device with KRA (mock service)
    Registers TIN and initializes device with CMC key
    """
    try:
        from .services.kra_client import KRAClient
        from django.utils import timezone
        
        serial_number = request.data.get('serial_number')
        if not serial_number:
            return Response({
                'success': False,
                'error': 'Device serial number is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get company
        company = Company.objects.get(contact_email=request.user.email)
        
        # Get device
        try:
            device = Device.objects.get(serial_number=serial_number, company=company)
        except Device.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Device not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Check if already active
        if device.status == 'active' and device.cmc_key:
            return Response({
                'success': True,
                'message': 'Device is already active',
                'device': {
                    'id': str(device.id),
                    'serial_number': device.serial_number,
                    'status': device.status,
                    'device_type': device.device_type
                }
            })
        
        # Initialize KRA client
        kra_client = KRAClient()
        
        # Register TIN with mock service (if using mock)
        from django.conf import settings
        if getattr(settings, 'KRA_USE_MOCK', True):
            from .services.kra_mock_service import KRAMockService
            mock_service = KRAMockService()
            mock_service.register_tin(company.tin)
            logger.info(f"Registered TIN {company.tin} with KRA mock service")
        
        # Initialize device with correct parameters
        result = kra_client.init_device(
            tin=company.tin,
            bhf_id=device.bhf_id or '00',
            serial_number=device.serial_number,
            device_name=f"{company.company_name} - {device.device_type.upper()}"
        )
        
        if result.get('success'):
            # Update device with CMC key and certification
            device.cmc_key = result.get('cmc_key', '')
            device.status = 'active'
            device.is_certified = True  # Mark as certified after successful KRA initialization
            device.last_sync = timezone.now()
            device.save()
            
            # Update company status
            if company.status == 'pending':
                company.status = 'active'
                company.save()
            
            logger.info(f"Device {device.serial_number} activated successfully")
            
            return Response({
                'success': True,
                'message': 'Device activated successfully',
                'device': {
                    'id': str(device.id),
                    'serial_number': device.serial_number,
                    'status': device.status,
                    'device_type': device.device_type,
                    'cmc_key': device.cmc_key[:20] + '...' if device.cmc_key else None
                }
            })
        else:
            logger.error(f"Device activation failed: {result.get('error')}")
            return Response({
                'success': False,
                'error': result.get('error', 'Device activation failed')
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
    except Company.DoesNotExist:
        return Response({
            'success': False,
            'error': 'Company not found'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error activating device: {str(e)}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

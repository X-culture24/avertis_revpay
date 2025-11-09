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

from .models import (
    Company, Device, Invoice, InvoiceItem, ItemMaster, 
    ComplianceReport, ApiLog, RetryQueue
)
from .serializers import (
    CompanySerializer, DeviceSerializer, InvoiceSerializer, 
    InvoiceItemSerializer, ItemMasterSerializer, ComplianceReportSerializer
)
from .tasks import retry_sales_invoice, sync_device_status


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
                    response.data['user'] = {
                        'id': str(user.id),
                        'email': user.email,
                        'is_active': user.is_active,
                        'date_joined': user.date_joined.isoformat(),
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
            is_sandbox=True  # Start in sandbox mode
        )
        
        # Auto-create default device for the company
        import uuid
        from datetime import datetime
        
        device_serial = f"DEV-{company.tin}-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        device = Device.objects.create(
            company=company,
            device_type='vscu',  # Default to VSCU (virtual) for easier setup
            integration_type='mobile_app',
            tin=company.tin,
            bhf_id='000',  # Default branch
            serial_number=device_serial,
            device_name=f"{company.company_name} - Default Device",
            status='pending',
            pos_version='1.0'
        )
        
        # Initialize device with KRA asynchronously
        from .tasks import initialize_device_with_kra
        initialize_device_with_kra.delay(str(device.id))
        
        # Generate tokens
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'tokens': {
                'access': str(refresh.access_token),
                'refresh': str(refresh)
            },
            'user': {
                'id': str(user.id),
                'email': user.email,
                'is_active': user.is_active,
                'date_joined': user.date_joined.isoformat(),
                'company': CompanySerializer(company).data
            },
            'device': {
                'id': str(device.id),
                'serial_number': device.serial_number,
                'status': device.status,
                'device_type': device.device_type,
                'message': 'Device initialization in progress. You can start creating invoices once device is active.'
            }
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
        
        return Response({
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
        })
        
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


class CompanyProfileView(APIView):
    """Company profile management"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        try:
            company = Company.objects.get(contact_email=request.user.email)
            serializer = CompanySerializer(company)
            return Response(serializer.data)
        except Company.DoesNotExist:
            return Response(
                {'error': 'Company not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
    
    def patch(self, request):
        try:
            company = Company.objects.get(contact_email=request.user.email)
            serializer = CompanySerializer(company, data=request.data, partial=True)
            
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Company.DoesNotExist:
            return Response(
                {'error': 'Company not found'}, 
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
    
    def perform_create(self, serializer):
        company = Company.objects.get(contact_email=self.request.user.email)
        serializer.save(company=company)


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
    """Trigger device sync"""
    try:
        company = Company.objects.get(contact_email=request.user.email)
        device = Device.objects.get(id=device_id, company=company)
        
        # Trigger async sync task
        sync_device_status.delay()
        
        return Response({'message': 'Device sync initiated'})
        
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
    
    def perform_create(self, serializer):
        from .services.compliance_service import ComplianceService
        from rest_framework.exceptions import ValidationError
        
        company = Company.objects.get(contact_email=self.request.user.email)
        
        # Get the first active device for this company
        device = Device.objects.filter(company=company, status='active').first()
        if not device:
            raise ValidationError('No active device found for this company')
        
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
        
        # Trigger async processing
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


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def resync_invoice(request, invoice_id):
    """Resync failed invoice"""
    try:
        company = Company.objects.get(contact_email=request.user.email)
        invoice = Invoice.objects.get(id=invoice_id, company=company)
        
        if invoice.status not in ['failed', 'retry']:
            return Response(
                {'error': 'Only failed invoices can be resynced'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create retry queue entry
        RetryQueue.objects.create(
            invoice=invoice,
            task_type='sales_retry',
            next_retry=timezone.now(),
            error_details='Manual resync requested'
        )
        
        # Update invoice status
        invoice.status = 'retry'
        invoice.save()
        
        # Trigger async retry
        retry_sales_invoice.delay(str(invoice.id))
        
        return Response({'message': 'Invoice queued for resync'})
        
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
            return Response({'message': 'No failed invoices to retry'})
        
        # Queue all failed invoices for retry
        for invoice in failed_invoices:
            # Create retry queue entry if not exists
            RetryQueue.objects.get_or_create(
                invoice=invoice,
                defaults={
                    'task_type': 'sales_retry',
                    'next_retry': timezone.now(),
                    'error_details': 'Manual retry all requested'
                }
            )
            
            # Update invoice status
            invoice.status = 'retry'
            invoice.save()
            
            # Trigger async retry
            retry_sales_invoice.delay(str(invoice.id))
        
        return Response({
            'message': f'{count} invoice(s) queued for retry',
            'count': count
        })
        
    except Company.DoesNotExist:
        return Response(
            {'error': 'Company not found'}, 
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
        
        # Get pending invoices
        pending_invoices = Invoice.objects.filter(
            company=company,
            device__in=vscu_devices,
            status='pending'
        )
        
        # Queue invoices for processing
        for invoice in pending_invoices:
            retry_sales_invoice.delay(str(invoice.id))
        
        return Response({
            'message': f'Queued {pending_invoices.count()} invoices for VSCU sync'
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

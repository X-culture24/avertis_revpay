"""
Revpay Connect client onboarding views.
Handles company registration and automatic device setup.
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.db import transaction
from django.utils import timezone
import logging

from .models import Company, Device, ApiLog, NotificationLog
from .serializers import (
    CompanyOnboardingSerializer, OnboardingResponseSerializer,
    CompanySerializer, DeviceSerializer
)
from .services.kra_client import KRAClient
from .tasks import send_notification_task, log_api_request

logger = logging.getLogger(__name__)


@api_view(['POST'])
@permission_classes([AllowAny])
def onboard_client(request):
    """
    Onboard a new client company with automatic device registration.
    
    This endpoint:
    1. Creates a new Company record
    2. Creates a Device record for the company
    3. Attempts to register the device with KRA
    4. Sends welcome notifications
    5. Returns onboarding status and next steps
    """
    serializer = CompanyOnboardingSerializer(data=request.data)
    
    if not serializer.is_valid():
        return Response({
            'success': False,
            'errors': serializer.errors,
            'message': 'Invalid onboarding data provided'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    data = serializer.validated_data
    
    try:
        with transaction.atomic():
            # Create company
            company = Company.objects.create(
                company_name=data['company_name'],
                tin=data['tin'],
                contact_person=data['contact_person'],
                contact_email=data['contact_email'],
                contact_phone=data['contact_phone'],
                business_address=data['business_address'],
                business_type=data.get('business_type', ''),
                subscription_plan=data.get('subscription_plan', 'basic'),
                status='pending_approval',
                is_sandbox=True  # Start in sandbox mode
            )
            
            # Create device
            device = Device.objects.create(
                company=company,
                tin=data['tin'],
                bhf_id=data['bhf_id'],
                serial_number=data['serial_number'],
                device_name=data['device_name'],
                pos_version=data.get('pos_version', '1.0'),
                status='pending'
            )
            
            # Log the onboarding request
            ApiLog.objects.create(
                company=company,
                device=device,
                endpoint='/api/onboard/',
                request_type='client_onboard',
                request_payload=str(request.data),
                response_payload='Company and device created successfully',
                status_code=201,
                response_time=0.0,
                severity='info',
                user_agent=request.META.get('HTTP_USER_AGENT', ''),
                ip_address=request.META.get('REMOTE_ADDR'),
                environment='sandbox'
            )
            
            # Attempt KRA device registration
            kra_registration_status = 'pending'
            next_steps = []
            
            try:
                kra_client = KRAClient()
                kra_response = kra_client.initialize_device(
                    tin=data['tin'],
                    bhf_id=data['bhf_id'],
                    serial_number=data['serial_number'],
                    device_name=data['device_name']
                )
                
                if kra_response.get('success'):
                    device.cmc_key = kra_response.get('cmc_key')
                    device.status = 'active'
                    device.is_certified = True
                    device.last_sync = timezone.now()
                    device.save()
                    
                    company.status = 'active'
                    company.save()
                    
                    kra_registration_status = 'success'
                    next_steps = [
                        'Device successfully registered with KRA',
                        'You can now start processing sales transactions',
                        'Access your dashboard to monitor transactions'
                    ]
                else:
                    kra_registration_status = 'failed'
                    next_steps = [
                        'KRA device registration failed',
                        'Please contact support for manual registration',
                        'You can test in sandbox mode while we resolve this'
                    ]
                    
            except Exception as e:
                logger.error(f"KRA registration failed for {data['serial_number']}: {str(e)}")
                kra_registration_status = 'error'
                next_steps = [
                    'KRA registration encountered an error',
                    'Our team has been notified',
                    'You will receive an email update within 24 hours'
                ]
            
            # Send welcome notification
            try:
                send_notification_task.delay(
                    company_id=str(company.id),
                    notification_type='email',
                    recipient=company.contact_email,
                    subject='Welcome to Revpay Connect eTIMS Gateway',
                    message=f"""
                    Dear {company.contact_person},
                    
                    Welcome to Revpay Connect! Your company "{company.company_name}" has been successfully onboarded.
                    
                    Company Details:
                    - TIN: {company.tin}
                    - Device: {device.device_name} ({device.serial_number})
                    - Status: {kra_registration_status}
                    
                    Next Steps:
                    {chr(10).join(f'- {step}' for step in next_steps)}
                    
                    If you have any questions, please contact our support team.
                    
                    Best regards,
                    Revpay Connect Team
                    """,
                    trigger_event='client_onboarding'
                )
            except Exception as e:
                logger.error(f"Failed to send welcome notification: {str(e)}")
            
            # Prepare response
            response_data = {
                'success': True,
                'company_id': company.id,
                'device_id': device.id,
                'message': f'Company "{company.company_name}" successfully onboarded',
                'kra_registration_status': kra_registration_status,
                'next_steps': next_steps
            }
            
            return Response(response_data, status=status.HTTP_201_CREATED)
            
    except Exception as e:
        logger.error(f"Onboarding failed: {str(e)}")
        return Response({
            'success': False,
            'message': 'Onboarding failed due to internal error',
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def list_companies(request):
    """List all companies with pagination and filtering"""
    companies = Company.objects.all().order_by('-created_at')
    
    # Filter by status if provided
    status_filter = request.query_params.get('status')
    if status_filter:
        companies = companies.filter(status=status_filter)
    
    # Filter by TIN if provided
    tin_filter = request.query_params.get('tin')
    if tin_filter:
        companies = companies.filter(tin__icontains=tin_filter)
    
    # Pagination
    page_size = min(int(request.query_params.get('page_size', 20)), 100)
    page = int(request.query_params.get('page', 1))
    start = (page - 1) * page_size
    end = start + page_size
    
    total_count = companies.count()
    companies_page = companies[start:end]
    
    serializer = CompanySerializer(companies_page, many=True)
    
    return Response({
        'companies': serializer.data,
        'pagination': {
            'page': page,
            'page_size': page_size,
            'total_count': total_count,
            'total_pages': (total_count + page_size - 1) // page_size
        }
    })


@api_view(['GET'])
def company_detail(request, company_id):
    """Get detailed information about a specific company"""
    try:
        company = Company.objects.get(id=company_id)
        company_serializer = CompanySerializer(company)
        
        # Get company devices
        devices = Device.objects.filter(company=company).order_by('-created_at')
        device_serializer = DeviceSerializer(devices, many=True)
        
        # Get recent activity
        recent_logs = ApiLog.objects.filter(company=company).order_by('-created_at')[:10]
        
        return Response({
            'company': company_serializer.data,
            'devices': device_serializer.data,
            'recent_activity': [
                {
                    'id': log.id,
                    'request_type': log.request_type,
                    'status_code': log.status_code,
                    'created_at': log.created_at,
                    'severity': log.severity
                } for log in recent_logs
            ],
            'statistics': {
                'total_devices': devices.count(),
                'active_devices': devices.filter(status='active').count(),
                'total_invoices': company.invoices.count(),
                'successful_invoices': company.invoices.filter(status='confirmed').count()
            }
        })
        
    except Company.DoesNotExist:
        return Response({
            'error': 'Company not found'
        }, status=status.HTTP_404_NOT_FOUND)


@api_view(['PUT'])
def update_company_status(request, company_id):
    """Update company status (approve, suspend, etc.)"""
    try:
        company = Company.objects.get(id=company_id)
        new_status = request.data.get('status')
        
        if new_status not in dict(Company.STATUS_CHOICES):
            return Response({
                'error': 'Invalid status value'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        old_status = company.status
        company.status = new_status
        company.save()
        
        # Log status change
        ApiLog.objects.create(
            company=company,
            endpoint=f'/api/companies/{company_id}/status/',
            request_type='status_change',
            request_payload=f'Status changed from {old_status} to {new_status}',
            response_payload='Status updated successfully',
            status_code=200,
            response_time=0.0,
            severity='info',
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
            ip_address=request.META.get('REMOTE_ADDR'),
            environment='production'
        )
        
        # Send notification about status change
        if new_status == 'active':
            send_notification_task.delay(
                company_id=str(company.id),
                notification_type='email',
                recipient=company.contact_email,
                subject='Your Revpay Connect Account is Now Active',
                message=f"""
                Dear {company.contact_person},
                
                Great news! Your Revpay Connect account for "{company.company_name}" has been approved and is now active.
                
                You can now:
                - Process live sales transactions
                - Switch to production mode
                - Access all premium features
                
                Login to your dashboard to get started.
                
                Best regards,
                Revpay Connect Team
                """,
                trigger_event='account_activated'
            )
        
        return Response({
            'success': True,
            'message': f'Company status updated to {new_status}',
            'company': CompanySerializer(company).data
        })
        
    except Company.DoesNotExist:
        return Response({
            'error': 'Company not found'
        }, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
def register_additional_device(request, company_id):
    """Register an additional device for an existing company"""
    try:
        company = Company.objects.get(id=company_id, status='active')
        
        serializer = DeviceSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                'success': False,
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if device serial number already exists
        if Device.objects.filter(serial_number=request.data['serial_number']).exists():
            return Response({
                'error': 'Device with this serial number already exists'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        with transaction.atomic():
            # Create device
            device = Device.objects.create(
                company=company,
                tin=company.tin,
                bhf_id=request.data['bhf_id'],
                serial_number=request.data['serial_number'],
                device_name=request.data['device_name'],
                pos_version=request.data.get('pos_version', '1.0'),
                status='pending'
            )
            
            # Attempt KRA registration
            try:
                kra_client = KRAClient()
                kra_response = kra_client.initialize_device(
                    tin=company.tin,
                    bhf_id=request.data['bhf_id'],
                    serial_number=request.data['serial_number'],
                    device_name=request.data['device_name']
                )
                
                if kra_response.get('success'):
                    device.cmc_key = kra_response.get('cmc_key')
                    device.status = 'active'
                    device.is_certified = True
                    device.last_sync = timezone.now()
                    device.save()
                    
                    return Response({
                        'success': True,
                        'message': 'Device registered successfully with KRA',
                        'device': DeviceSerializer(device).data
                    }, status=status.HTTP_201_CREATED)
                else:
                    return Response({
                        'success': False,
                        'message': 'Device created but KRA registration failed',
                        'device': DeviceSerializer(device).data,
                        'kra_error': kra_response.get('error')
                    }, status=status.HTTP_201_CREATED)
                    
            except Exception as e:
                logger.error(f"KRA registration failed: {str(e)}")
                return Response({
                    'success': False,
                    'message': 'Device created but KRA registration encountered an error',
                    'device': DeviceSerializer(device).data,
                    'error': str(e)
                }, status=status.HTTP_201_CREATED)
                
    except Company.DoesNotExist:
        return Response({
            'error': 'Company not found or not active'
        }, status=status.HTTP_404_NOT_FOUND)

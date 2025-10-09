"""
Revpay Connect environment switching and configuration management.
Handles sandbox/production environment switching with security controls.
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.conf import settings
from django.utils import timezone
import logging

from .models import Company, Device, ApiLog
from .services.kra_client import KRAClient
from .tasks import send_notification_task

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_environment_status(request, company_id):
    """Get current environment status for a company"""
    try:
        company = Company.objects.get(id=company_id)
        
        # Get system environment
        system_environment = getattr(settings, 'KRA_ENVIRONMENT', 'sandbox')
        
        # Get company's active devices
        devices = Device.objects.filter(company=company, status='active')
        
        # Check KRA connectivity for current environment
        kra_client = KRAClient()
        connectivity_status = 'unknown'
        
        try:
            # Test connection with a simple status check
            test_result = kra_client.test_connection()
            connectivity_status = 'connected' if test_result.get('success') else 'disconnected'
        except Exception as e:
            connectivity_status = 'error'
            logger.error(f"KRA connectivity test failed: {str(e)}")
        
        return Response({
            'company': {
                'id': str(company.id),
                'name': company.company_name,
                'tin': company.tin,
                'status': company.status
            },
            'environment': {
                'system_environment': system_environment,
                'company_sandbox_mode': company.is_sandbox,
                'effective_environment': 'sandbox' if company.is_sandbox else system_environment,
                'can_switch_to_production': company.status == 'active' and not company.is_sandbox,
                'kra_connectivity': connectivity_status
            },
            'devices': {
                'total_devices': devices.count(),
                'active_devices': devices.filter(status='active').count(),
                'certified_devices': devices.filter(is_certified=True).count()
            },
            'requirements_for_production': {
                'company_approved': company.status == 'active',
                'devices_certified': devices.filter(is_certified=True).count() > 0,
                'recent_successful_transactions': company.invoices.filter(
                    status='confirmed',
                    created_at__gte=timezone.now() - timezone.timedelta(days=7)
                ).exists()
            }
        })
        
    except Company.DoesNotExist:
        return Response({
            'error': 'Company not found'
        }, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def switch_environment(request, company_id):
    """
    Switch company between sandbox and production environments.
    Requires proper validation and approval.
    """
    try:
        company = Company.objects.get(id=company_id)
        target_environment = request.data.get('environment')
        
        if target_environment not in ['sandbox', 'production']:
            return Response({
                'success': False,
                'error': 'Invalid environment. Must be "sandbox" or "production"'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        current_sandbox_mode = company.is_sandbox
        target_sandbox_mode = target_environment == 'sandbox'
        
        # If no change needed
        if current_sandbox_mode == target_sandbox_mode:
            return Response({
                'success': True,
                'message': f'Company is already in {target_environment} mode',
                'environment': target_environment
            })
        
        # Validate switch to production
        if target_environment == 'production':
            validation_result = _validate_production_switch(company)
            if not validation_result['valid']:
                return Response({
                    'success': False,
                    'error': 'Cannot switch to production environment',
                    'details': validation_result['reasons']
                }, status=status.HTTP_400_BAD_REQUEST)
        
        # Perform the switch
        old_environment = 'sandbox' if current_sandbox_mode else 'production'
        company.is_sandbox = target_sandbox_mode
        company.save()
        
        # Log the environment switch
        ApiLog.objects.create(
            company=company,
            endpoint=f'/api/environment/{company_id}/switch/',
            request_type='environment_switch',
            request_payload=f'Switch from {old_environment} to {target_environment}',
            response_payload='Environment switched successfully',
            status_code=200,
            response_time=0.0,
            severity='info',
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
            ip_address=request.META.get('REMOTE_ADDR'),
            environment=target_environment
        )
        
        # Send notification about environment switch
        notification_message = f"""
        Environment Switch Notification
        
        Your Revpay Connect eTIMS integration environment has been switched.
        
        Company: {company.company_name}
        Previous Environment: {old_environment.title()}
        New Environment: {target_environment.title()}
        Switched At: {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}
        
        {"Important: You are now processing live transactions with KRA. Ensure all your systems are properly configured." if target_environment == 'production' else "You are now in sandbox mode for testing purposes."}
        
        If you did not request this change, please contact support immediately.
        """
        
        send_notification_task.delay(
            str(company.id),
            'email',
            company.contact_email,
            f'Environment Switched to {target_environment.title()}',
            notification_message,
            'environment_switch'
        )
        
        # If switching to production, also notify admin
        if target_environment == 'production':
            admin_message = f"""
            Company {company.company_name} ({company.tin}) has been switched to production environment.
            
            Please monitor their transactions for the next 24 hours to ensure smooth operation.
            """
            
            admin_email = getattr(settings, 'ADMIN_EMAIL', 'admin@revpayconnect.com')
            send_notification_task.delay(
                str(company.id),
                'email',
                admin_email,
                f'Company Switched to Production: {company.company_name}',
                admin_message,
                'production_switch_admin'
            )
        
        return Response({
            'success': True,
            'message': f'Successfully switched to {target_environment} environment',
            'environment': target_environment,
            'effective_date': timezone.now(),
            'next_steps': _get_environment_next_steps(target_environment)
        })
        
    except Company.DoesNotExist:
        return Response({
            'error': 'Company not found'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Environment switch error: {str(e)}")
        return Response({
            'success': False,
            'error': 'Environment switch failed',
            'message': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_kra_endpoints(request):
    """Get current KRA API endpoints configuration"""
    system_environment = getattr(settings, 'KRA_ENVIRONMENT', 'sandbox')
    
    endpoints = {
        'environment': system_environment,
        'sandbox': {
            'base_url': getattr(settings, 'KRA_SANDBOX_URL', 'https://etims-api-sbx.kra.go.ke'),
            'description': 'KRA eTIMS Sandbox Environment for Testing'
        },
        'production': {
            'base_url': getattr(settings, 'KRA_PRODUCTION_URL', 'https://etims-api.kra.go.ke'),
            'description': 'KRA eTIMS Production Environment for Live Transactions'
        }
    }
    
    # Test connectivity to current environment
    try:
        kra_client = KRAClient()
        connectivity_test = kra_client.test_connection()
        endpoints['current_connectivity'] = {
            'status': 'connected' if connectivity_test.get('success') else 'disconnected',
            'response_time': connectivity_test.get('response_time'),
            'last_tested': timezone.now()
        }
    except Exception as e:
        endpoints['current_connectivity'] = {
            'status': 'error',
            'error': str(e),
            'last_tested': timezone.now()
        }
    
    return Response(endpoints)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def test_kra_connectivity(request, company_id):
    """Test KRA connectivity for a specific company"""
    try:
        company = Company.objects.get(id=company_id)
        
        # Get a device to test with
        device = Device.objects.filter(company=company, status='active').first()
        if not device:
            return Response({
                'success': False,
                'error': 'No active devices found for testing'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Test KRA connectivity
        kra_client = KRAClient()
        
        # Test basic connectivity
        connectivity_result = kra_client.test_connection()
        
        # Test device status check if basic connectivity works
        device_status_result = None
        if connectivity_result.get('success'):
            try:
                device_status_result = kra_client.check_device_status(device)
            except Exception as e:
                device_status_result = {'success': False, 'error': str(e)}
        
        # Log the connectivity test
        ApiLog.objects.create(
            company=company,
            device=device,
            endpoint='/api/environment/test-connectivity/',
            request_type='connectivity_test',
            request_payload=f'Testing connectivity for {device.serial_number}',
            response_payload=f'Connectivity: {connectivity_result}, Device Status: {device_status_result}',
            status_code=200 if connectivity_result.get('success') else 500,
            response_time=connectivity_result.get('response_time', 0),
            severity='info' if connectivity_result.get('success') else 'warning',
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
            ip_address=request.META.get('REMOTE_ADDR'),
            environment='sandbox' if company.is_sandbox else getattr(settings, 'KRA_ENVIRONMENT', 'sandbox')
        )
        
        return Response({
            'company': {
                'id': str(company.id),
                'name': company.company_name,
                'environment': 'sandbox' if company.is_sandbox else 'production'
            },
            'device_tested': {
                'id': str(device.id),
                'name': device.device_name,
                'serial': device.serial_number
            },
            'connectivity_test': connectivity_result,
            'device_status_test': device_status_result,
            'overall_status': 'success' if connectivity_result.get('success') and device_status_result and device_status_result.get('success') else 'failed',
            'tested_at': timezone.now()
        })
        
    except Company.DoesNotExist:
        return Response({
            'error': 'Company not found'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Connectivity test error: {str(e)}")
        return Response({
            'success': False,
            'error': 'Connectivity test failed',
            'message': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def _validate_production_switch(company):
    """Validate if company can switch to production environment"""
    reasons = []
    
    # Check company status
    if company.status != 'active':
        reasons.append('Company must be in active status')
    
    # Check for certified devices
    certified_devices = Device.objects.filter(company=company, is_certified=True, status='active')
    if not certified_devices.exists():
        reasons.append('At least one device must be certified with KRA')
    
    # Check for recent successful transactions in sandbox
    recent_success = company.invoices.filter(
        status='confirmed',
        created_at__gte=timezone.now() - timezone.timedelta(days=7)
    ).exists()
    
    if not recent_success:
        reasons.append('Must have successful transactions in the last 7 days')
    
    # Check system environment
    system_env = getattr(settings, 'KRA_ENVIRONMENT', 'sandbox')
    if system_env == 'sandbox':
        reasons.append('System is currently in sandbox mode - production switching not available')
    
    return {
        'valid': len(reasons) == 0,
        'reasons': reasons
    }


def _get_environment_next_steps(environment):
    """Get next steps after environment switch"""
    if environment == 'production':
        return [
            'Verify all devices are working correctly',
            'Monitor transactions for the first 24 hours',
            'Ensure POS systems are configured for production',
            'Contact support if you encounter any issues'
        ]
    else:
        return [
            'You can now test transactions safely',
            'Use test data for all transactions',
            'Verify your integration before switching to production',
            'Contact support if you need assistance with testing'
        ]

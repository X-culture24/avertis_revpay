"""
Revpay Connect 3rd-party integrator service.
Manages both OSCU and VSCU integrations as a certified KRA eTIMS integrator.
Handles client onboarding, device management, and transaction processing.
"""
import logging
from typing import Dict, Any, Optional, List
from django.utils import timezone
from django.db import transaction
from ..models import Company, Device, Invoice, ApiLog
from .kra_client import KRAClient
from .vscu_client import VSCUClient
from .notification_service import NotificationService

logger = logging.getLogger(__name__)


class IntegratorService:
    """
    Central service for managing Revpay Connect's 3rd-party integrator operations.
    Handles both OSCU and VSCU device registrations and integrations.
    """
    
    def __init__(self):
        self.oscu_client = KRAClient()
        self.vscu_client = VSCUClient()
        self.notification_service = NotificationService()
    
    def onboard_client_with_device_type(self, onboarding_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Onboard a new client with specified device type (OSCU or VSCU).
        
        Args:
            onboarding_data: Client and device information including device_type
        
        Returns:
            Dict containing onboarding result and next steps
        """
        try:
            with transaction.atomic():
                # Create company
                company = Company.objects.create(
                    company_name=onboarding_data['company_name'],
                    tin=onboarding_data['tin'],
                    contact_person=onboarding_data.get('contact_person', ''),
                    contact_email=onboarding_data.get('contact_email', ''),
                    contact_phone=onboarding_data.get('contact_phone', ''),
                    business_address=onboarding_data.get('business_address', ''),
                    business_type=onboarding_data.get('business_type', ''),
                    status='active',
                    is_sandbox=True,  # Start in sandbox
                    subscription_plan=onboarding_data.get('subscription_plan', 'basic')
                )
                
                # Determine device type and create appropriate device
                device_type = onboarding_data.get('device_type', 'oscu')
                integration_type = onboarding_data.get('integration_type', 'pos')
                
                device = Device.objects.create(
                    company=company,
                    device_type=device_type,
                    integration_type=integration_type,
                    tin=onboarding_data['tin'],
                    bhf_id=onboarding_data['bhf_id'],
                    serial_number=onboarding_data['serial_number'],
                    device_name=onboarding_data['device_name'],
                    virtual_device_id=onboarding_data.get('virtual_device_id'),
                    api_endpoint=onboarding_data.get('api_endpoint'),
                    webhook_url=onboarding_data.get('webhook_url'),
                    integrator_reference=f"RC-{company.tin}-{device_type.upper()}-{timezone.now().strftime('%Y%m%d')}",
                    client_system_info=onboarding_data.get('client_system_info', {}),
                    status='pending'
                )
                
                # Register device with appropriate KRA system
                if device_type == 'oscu':
                    registration_result = self._register_oscu_device(device, onboarding_data)
                else:  # vscu
                    registration_result = self._register_vscu_device(device, onboarding_data)
                
                # Update device with registration result
                if registration_result['success']:
                    device.cmc_key = registration_result['cmc_key']
                    device.status = 'active'
                    device.is_certified = True
                    device.certification_date = timezone.now()
                    device.last_sync = timezone.now()
                    device.save()
                    
                    # Send welcome notification
                    self._send_onboarding_notification(company, device, registration_result)
                    
                    return {
                        'success': True,
                        'company_id': str(company.id),
                        'device_id': str(device.id),
                        'device_type': device_type,
                        'integration_type': integration_type,
                        'message': f'{device_type.upper()} device registered successfully',
                        'next_steps': self._get_integration_next_steps(device),
                        'registration_details': registration_result
                    }
                else:
                    device.status = 'failed'
                    device.save()
                    
                    return {
                        'success': False,
                        'company_id': str(company.id),
                        'device_id': str(device.id),
                        'error': registration_result.get('error', 'Device registration failed'),
                        'error_details': registration_result
                    }
                    
        except Exception as e:
            logger.error(f"Client onboarding error: {str(e)}")
            return {
                'success': False,
                'error': f'Onboarding failed: {str(e)}',
                'error_type': 'system_error'
            }
    
    def _register_oscu_device(self, device: Device, onboarding_data: Dict[str, Any]) -> Dict[str, Any]:
        """Register OSCU device with KRA"""
        device_data = {
            'tin': device.tin,
            'bhf_id': device.bhf_id,
            'serial_number': device.serial_number,
            'device_name': device.device_name,
            'pos_version': onboarding_data.get('pos_version', '1.0.0')
        }
        
        return self.oscu_client.initialize_device(device_data)
    
    def _register_vscu_device(self, device: Device, onboarding_data: Dict[str, Any]) -> Dict[str, Any]:
        """Register VSCU device with KRA"""
        device_data = {
            'tin': device.tin,
            'bhf_id': device.bhf_id,
            'virtual_device_id': device.virtual_device_id or f"VSCU-{device.tin}-{device.bhf_id}",
            'integration_type': device.integration_type,
            'api_endpoint': device.api_endpoint,
            'webhook_url': device.webhook_url
        }
        
        return self.vscu_client.register_virtual_device(device_data)
    
    def process_transaction_by_device_type(self, transaction_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process transaction based on device type (OSCU or VSCU).
        
        Args:
            transaction_data: Transaction information including device_id
        
        Returns:
            Dict containing transaction processing result
        """
        try:
            device_id = transaction_data.get('device_id')
            if not device_id:
                return {
                    'success': False,
                    'error': 'Device ID is required',
                    'error_type': 'validation_error'
                }
            
            device = Device.objects.select_related('company').get(id=device_id)
            
            if not device.is_active:
                return {
                    'success': False,
                    'error': 'Device is not active',
                    'error_type': 'device_inactive'
                }
            
            # Process based on device type
            if device.is_oscu:
                result = self._process_oscu_transaction(device, transaction_data)
            else:  # VSCU
                result = self._process_vscu_transaction(device, transaction_data)
            
            # Log transaction attempt
            self._log_transaction_attempt(device, transaction_data, result)
            
            return result
            
        except Device.DoesNotExist:
            return {
                'success': False,
                'error': 'Device not found',
                'error_type': 'device_not_found'
            }
        except Exception as e:
            logger.error(f"Transaction processing error: {str(e)}")
            return {
                'success': False,
                'error': f'Transaction processing failed: {str(e)}',
                'error_type': 'processing_error'
            }
    
    def _process_oscu_transaction(self, device: Device, transaction_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process OSCU transaction"""
        # Add device-specific data
        transaction_data.update({
            'tin': device.tin,
            'bhf_id': device.bhf_id,
            'serial_number': device.serial_number
        })
        
        return self.oscu_client.submit_sales_transaction(transaction_data, device.cmc_key)
    
    def _process_vscu_transaction(self, device: Device, transaction_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process VSCU transaction"""
        # Add VSCU-specific data
        transaction_data.update({
            'tin': device.tin,
            'bhf_id': device.bhf_id,
            'virtual_device_id': device.virtual_device_id,
            'integration_type': device.integration_type
        })
        
        return self.vscu_client.process_virtual_transaction(transaction_data, device.cmc_key)
    
    def get_integration_capabilities(self) -> Dict[str, Any]:
        """
        Get Revpay Connect's integration capabilities as a 3rd-party integrator.
        
        Returns:
            Dict containing supported integration types and features
        """
        return {
            'integrator_info': {
                'name': 'Revpay Connect Ltd',
                'certification_status': 'KRA Certified 3rd-Party Integrator',
                'supported_systems': ['OSCU', 'VSCU'],
                'certification_date': '2024-01-01',
                'version': '1.0.0'
            },
            'oscu_capabilities': {
                'description': 'Online Sales Control Unit Integration',
                'supported_integrations': [
                    'Point of Sale (POS) Systems',
                    'Enterprise Resource Planning (ERP)',
                    'Retail Management Systems',
                    'Restaurant Management Systems'
                ],
                'features': [
                    'Real-time transaction processing',
                    'Physical device management',
                    'Receipt printing integration',
                    'Offline transaction queuing',
                    'Device health monitoring'
                ],
                'requirements': [
                    'Physical OSCU device',
                    'Stable internet connection',
                    'POS system integration'
                ]
            },
            'vscu_capabilities': {
                'description': 'Virtual Sales Control Unit Integration',
                'supported_integrations': [
                    'E-commerce Platforms',
                    'Mobile Applications',
                    'Web Applications',
                    'API-only Integrations',
                    'SaaS Platforms',
                    'Marketplace Integrations'
                ],
                'features': [
                    'API-based transaction processing',
                    'Virtual device management',
                    'Webhook notifications',
                    'Multi-channel support',
                    'Cloud-based operations',
                    'Real-time compliance reporting'
                ],
                'requirements': [
                    'API integration capability',
                    'Webhook endpoint (optional)',
                    'Internet connectivity'
                ]
            },
            'common_features': [
                'Multi-tenant architecture',
                'Real-time compliance reporting',
                'Audit trail and logging',
                'Retry and error handling',
                'Performance monitoring',
                'Security and encryption',
                '24/7 technical support'
            ],
            'business_models': [
                'Transaction-based pricing',
                'Monthly subscription plans',
                'Enterprise custom solutions',
                'Partner revenue sharing'
            ]
        }
    
    def get_device_statistics(self, company_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Get device statistics for integrator dashboard.
        
        Args:
            company_id: Optional company filter
        
        Returns:
            Dict containing device statistics
        """
        devices_query = Device.objects.all()
        
        if company_id:
            devices_query = devices_query.filter(company_id=company_id)
        
        total_devices = devices_query.count()
        oscu_devices = devices_query.filter(device_type='oscu').count()
        vscu_devices = devices_query.filter(device_type='vscu').count()
        active_devices = devices_query.filter(status='active').count()
        
        # Integration type breakdown
        integration_stats = {}
        for integration_type, _ in Device.INTEGRATION_TYPE_CHOICES:
            count = devices_query.filter(integration_type=integration_type).count()
            integration_stats[integration_type] = count
        
        return {
            'total_devices': total_devices,
            'device_types': {
                'oscu': oscu_devices,
                'vscu': vscu_devices
            },
            'active_devices': active_devices,
            'inactive_devices': total_devices - active_devices,
            'integration_breakdown': integration_stats,
            'certification_rate': (active_devices / total_devices * 100) if total_devices > 0 else 0
        }
    
    def _send_onboarding_notification(self, company: Company, device: Device, registration_result: Dict[str, Any]):
        """Send onboarding success notification"""
        device_type_name = device.get_device_type_display()
        integration_type_name = device.get_integration_type_display()
        
        self.notification_service.send_email_notification(
            recipient_email=company.contact_email,
            subject=f"Welcome to Revpay Connect - {device_type_name} Integration Complete",
            template_data={
                'company_name': company.company_name,
                'device_type': device_type_name,
                'integration_type': integration_type_name,
                'device_name': device.device_name,
                'integrator_reference': device.integrator_reference,
                'next_steps': self._get_integration_next_steps(device)
            },
            notification_type='onboarding_success'
        )
    
    def _get_integration_next_steps(self, device: Device) -> List[str]:
        """Get next steps based on device type"""
        if device.is_oscu:
            return [
                "Configure your POS system with the provided CMC key",
                "Test transaction processing in sandbox mode",
                "Complete integration testing and validation",
                "Request production environment switch when ready",
                "Begin live transaction processing"
            ]
        else:  # VSCU
            return [
                "Integrate the provided API endpoints into your system",
                "Configure webhook notifications (if applicable)",
                "Test virtual transaction processing in sandbox mode",
                "Validate compliance reporting and audit trails",
                "Request production environment switch when ready",
                "Begin live transaction processing"
            ]
    
    def _log_transaction_attempt(self, device: Device, transaction_data: Dict[str, Any], result: Dict[str, Any]):
        """Log transaction processing attempt"""
        ApiLog.objects.create(
            company=device.company,
            endpoint=f"/integration/{device.device_type}/transaction",
            method='POST',
            request_data=transaction_data,
            response_data=result,
            status_code=200 if result.get('success') else 400,
            response_time=0.0,  # Would be calculated in actual implementation
            user_agent='Revpay Connect Integrator Service',
            ip_address='127.0.0.1',
            environment='sandbox' if device.company.is_sandbox else 'production',
            severity='info' if result.get('success') else 'error'
        )

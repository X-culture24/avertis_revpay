"""
Celery tasks for Revpay Connect eTIMS OSCU integration.
Handles async processing, retry logic, notifications, and multi-tenant operations.
"""
from celery import shared_task
from django.utils import timezone
from django.db import transaction
from django.db.models import Count, Sum, Avg, Q
import logging
from typing import Dict, Any
from datetime import timedelta

from .models import (
    Company, Invoice, RetryQueue, Device, ApiLog, ComplianceReport,
    NotificationLog, SystemCode
)
from .services.kra_client import KRAClient, KRAClientError
from .services.notification_service import (
    NotificationService, send_transaction_failure_alert,
    send_device_offline_alert, send_compliance_report_ready
)

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def initialize_device_with_kra(self, device_id: str):
    """
    Initialize device with KRA and obtain CMC key.
    Called automatically after user registration.
    """
    try:
        device = Device.objects.get(id=device_id)
        company = device.company
        
        logger.info(f"Initializing device {device.serial_number} for company {company.company_name}")
        
        # Initialize with KRA
        kra_client = KRAClient()
        result = kra_client.init_device(
            tin=device.tin,
            bhf_id=device.bhf_id,
            serial_number=device.serial_number,
            device_name=device.device_name
        )
        
        if result.get('success'):
            # Update device with CMC key
            device.cmc_key = result.get('cmc_key')
            device.status = 'active'
            device.is_certified = True
            device.certification_date = timezone.now()
            device.last_sync = timezone.now()
            device.save()
            
            logger.info(f"Device {device.serial_number} initialized successfully")
            return {
                'success': True,
                'device_id': device_id,
                'serial_number': device.serial_number,
                'message': 'Device initialized with KRA'
            }
        else:
            # Mark device as failed but keep it for manual retry
            device.status = 'failed'
            device.save()
            
            logger.error(f"Device initialization failed: {result.get('message')}")
            return {
                'success': False,
                'device_id': device_id,
                'error': result.get('message')
            }
            
    except Device.DoesNotExist:
        logger.error(f"Device {device_id} not found")
        return {'success': False, 'error': 'Device not found'}
    except Exception as e:
        logger.error(f"Error initializing device {device_id}: {str(e)}")
        # Retry with exponential backoff
        raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries))


@shared_task(bind=True, max_retries=5)
def retry_sales_invoice(self, invoice_id: str):
    """
    Retry failed sales invoice submission to KRA.
    Uses exponential backoff strategy.
    """
    try:
        with transaction.atomic():
            invoice = Invoice.objects.select_for_update().get(id=invoice_id)
            retry_entry = RetryQueue.objects.select_for_update().get(
                invoice=invoice,
                status='pending'
            )
            
            # Update retry entry
            retry_entry.status = 'processing'
            retry_entry.attempt_count += 1
            retry_entry.save()
            
            logger.info(f"Retrying sales invoice {invoice.invoice_no}, attempt {retry_entry.attempt_count}")
            
            # Send to KRA
            kra_client = KRAClient()
            result = kra_client.send_sales_invoice(invoice, is_retry=True)
            
            if result['success']:
                # Success - update invoice and complete retry
                invoice.receipt_no = result['receipt_no']
                invoice.internal_data = result['internal_data']
                invoice.receipt_signature = result['receipt_signature']
                invoice.qr_code_data = result.get('qr_code', '')
                invoice.status = 'confirmed'
                invoice.save()
                
                # Generate QR code if not provided by KRA
                if not invoice.qr_code_data:
                    from .services.qr_service import QRCodeService
                    QRCodeService.update_invoice_qr(invoice)
                
                retry_entry.status = 'completed'
                retry_entry.save()
                
                logger.info(f"Sales invoice retry successful: {invoice.invoice_no}")
                return {
                    'success': True,
                    'invoice_id': invoice_id,
                    'receipt_no': result['receipt_no'],
                    'attempt': retry_entry.attempt_count
                }
                
            elif result.get('is_retryable', False) and retry_entry.attempt_count < 5:
                # Still retryable - schedule next attempt
                retry_entry.status = 'pending'
                retry_entry.calculate_next_retry()
                retry_entry.error_details = result.get('error_message', 'Unknown error')
                retry_entry.save()
                
                # Retry with exponential backoff
                countdown = 60 * (2 ** retry_entry.attempt_count)  # 60, 120, 240, 480, 960 seconds
                
                logger.warning(f"Sales invoice retry failed, scheduling next attempt in {countdown}s")
                raise self.retry(countdown=countdown)
                
            else:
                # Permanent failure or max retries reached
                invoice.status = 'failed'
                invoice.save()
                
                retry_entry.status = 'failed'
                retry_entry.error_details = result.get('error_message', 'Max retries exceeded')
                retry_entry.save()
                
                logger.error(f"Sales invoice retry permanently failed: {invoice.invoice_no}")
                
                # Send failure notifications
                send_transaction_failure_alert(
                    str(invoice.company.id),
                    invoice_id,
                    result.get('error_message', 'Unknown error')
                )
                
                send_admin_alert.delay(
                    'sales_retry_failed',
                    f"Invoice {invoice.invoice_no} failed after {retry_entry.attempt_count} attempts",
                    {'invoice_id': invoice_id, 'company_id': str(invoice.company.id), 'error': result.get('error_message')}
                )
                
                return {
                    'success': False,
                    'invoice_id': invoice_id,
                    'error': 'Permanent failure or max retries exceeded',
                    'attempts': retry_entry.attempt_count
                }
                
    except Invoice.DoesNotExist:
        logger.error(f"Invoice not found for retry: {invoice_id}")
        return {'success': False, 'error': 'Invoice not found'}
        
    except RetryQueue.DoesNotExist:
        logger.error(f"Retry queue entry not found for invoice: {invoice_id}")
        return {'success': False, 'error': 'Retry entry not found'}
        
    except Exception as e:
        logger.error(f"Unexpected error in sales invoice retry: {e}")
        
        # Update retry entry with error
        try:
            retry_entry = RetryQueue.objects.get(invoice_id=invoice_id, status='processing')
            retry_entry.status = 'pending'
            retry_entry.error_details = str(e)
            retry_entry.save()
        except:
            pass
            
        # Retry with exponential backoff
        if self.request.retries < self.max_retries:
            countdown = 60 * (2 ** self.request.retries)
            raise self.retry(countdown=countdown, exc=e)
        else:
            return {'success': False, 'error': str(e)}


@shared_task
def sync_device_status():
    """
    Periodic task to sync device status with KRA.
    Runs every hour to check device health.
    """
    try:
        active_devices = Device.objects.filter(status='active')
        kra_client = KRAClient()
        
        updated_count = 0
        failed_count = 0
        
        for device in active_devices:
            try:
                result = kra_client.check_device_status(device)
                
                if result['success']:
                    device.last_sync = timezone.now()
                    device.save()
                    updated_count += 1
                else:
                    failed_count += 1
                    logger.warning(f"Device status check failed: {device.serial_number}")
                    
                    # Check if device has been offline for too long
                    if device.last_sync and (timezone.now() - device.last_sync) > timedelta(hours=6):
                        send_device_offline_alert(
                            str(device.company.id),
                            str(device.id),
                            device.device_name
                        )
                    
            except Exception as e:
                failed_count += 1
                logger.error(f"Error checking device {device.serial_number}: {e}")
        
        logger.info(f"Device status sync completed: {updated_count} updated, {failed_count} failed")
        
        return {
            'success': True,
            'updated': updated_count,
            'failed': failed_count,
            'total': len(active_devices)
        }
        
    except Exception as e:
        logger.error(f"Device status sync error: {e}")
        return {'success': False, 'error': str(e)}


@shared_task
def cleanup_old_logs():
    """
    Clean up old API logs to prevent database bloat.
    Keeps logs for 30 days by default.
    """
    try:
        from .models import ApiLog
        
        cutoff_date = timezone.now() - timedelta(days=30)
        deleted_count, _ = ApiLog.objects.filter(created_at__lt=cutoff_date).delete()
        
        logger.info(f"Cleaned up {deleted_count} old API logs")
        
        return {
            'success': True,
            'deleted_count': deleted_count,
            'cutoff_date': cutoff_date
        }
        
    except Exception as e:
        logger.error(f"Log cleanup error: {e}")
        return {'success': False, 'error': str(e)}


@shared_task
def process_pending_retries():
    """
    Process pending retry queue entries.
    Runs every 5 minutes to check for due retries.
    """
    try:
        from .models import RetryQueue
        
        # Get pending retries that are due
        due_retries = RetryQueue.objects.filter(
            status='pending',
            next_retry__lte=timezone.now()
        ).select_related('invoice')
        
        processed_count = 0
        
        for retry_entry in due_retries:
            try:
                # Queue the retry task
                retry_sales_invoice.delay(str(retry_entry.invoice.id))
                processed_count += 1
                
            except Exception as e:
                logger.error(f"Error queuing retry for invoice {retry_entry.invoice.id}: {e}")
        
        logger.info(f"Processed {processed_count} pending retries")
        
        return {
            'success': True,
            'processed': processed_count
        }
        
    except Exception as e:
        logger.error(f"Retry processing error: {e}")
        return {'success': False, 'error': str(e)}


@shared_task
def sync_system_codes():
    """
    Sync system codes from KRA (tax types, payment methods, etc.)
    Runs daily to keep reference data updated.
    """
    try:
        from .models import SystemCode
        
        kra_client = KRAClient()
        result = kra_client.get_system_codes()
        
        if result['success']:
            codes_data = result['data']
            updated_count = 0
            
            # Process different code types
            code_types = {
                'tax_type': codes_data.get('taxTypeList', []),
                'payment_type': codes_data.get('paymentTypeList', []),
                'unit_measure': codes_data.get('unitMeasureList', []),
            }
            
            for code_type, codes in code_types.items():
                for code_data in codes:
                    code_obj, created = SystemCode.objects.get_or_create(
                        code_type=code_type,
                        code_value=code_data.get('code', ''),
                        defaults={
                            'description': code_data.get('description', ''),
                            'is_active': True
                        }
                    )
                    
                    if not created:
                        code_obj.description = code_data.get('description', '')
                        code_obj.is_active = True
                        code_obj.save()
                    
                    updated_count += 1
            
            logger.info(f"System codes sync completed: {updated_count} codes updated")
            
            return {
                'success': True,
                'updated': updated_count
            }
        else:
            logger.error("Failed to retrieve system codes from KRA")
            return {'success': False, 'error': 'KRA sync failed'}
            
    except Exception as e:
        logger.error(f"System codes sync error: {e}")
        return {'success': False, 'error': str(e)}


@shared_task
def send_notification_task(company_id: str, notification_type: str, recipient: str,
                          subject: str, message: str, trigger_event: str):
    """
    Send notification using the notification service.
    Supports email, webhook, SMS, and system alerts.
    """
    try:
        service = NotificationService()
        
        if notification_type == 'email':
            result = service.send_email(company_id, recipient, subject, message, trigger_event)
        elif notification_type == 'webhook':
            # For webhook, recipient is the URL and message contains the payload
            import json
            payload = json.loads(message) if isinstance(message, str) else message
            result = service.send_webhook(company_id, recipient, payload, trigger_event)
        elif notification_type == 'sms':
            result = service.send_sms(company_id, recipient, message, trigger_event)
        elif notification_type == 'system':
            result = service.send_system_alert(company_id, subject, message, 'info')
        else:
            raise ValueError(f"Unsupported notification type: {notification_type}")
        
        return result
        
    except Exception as e:
        logger.error(f"Failed to send {notification_type} notification: {str(e)}")
        return {'success': False, 'error': str(e)}


@shared_task
def send_admin_alert(alert_type: str, message: str, details: Dict[str, Any] = None):
    """
    Send alert to administrators for critical issues.
    Can be extended to send emails, SMS, or push notifications.
    """
    try:
        logger.critical(f"ADMIN ALERT [{alert_type}]: {message}")
        
        if details:
            logger.critical(f"Alert details: {details}")
        
        # Send to admin notification system
        admin_company_id = details.get('company_id') if details else None
        if admin_company_id:
            service = NotificationService()
            service.send_system_alert(
                admin_company_id,
                alert_type,
                f"{message}\n\nDetails: {details}",
                'critical' if 'critical' in alert_type.lower() else 'error'
            )
        
        return {
            'success': True,
            'alert_type': alert_type,
            'message': message,
            'timestamp': timezone.now()
        }
        
    except Exception as e:
        logger.error(f"Failed to send admin alert: {e}")
        return {'success': False, 'error': str(e)}


@shared_task
def generate_compliance_reports():
    """
    Generate compliance reports for all active companies.
    Runs daily to create compliance reports.
    """
    try:
        active_companies = Company.objects.filter(status='active')
        reports_generated = 0
        
        for company in active_companies:
            try:
                # Generate daily report for yesterday
                yesterday = timezone.now().date() - timedelta(days=1)
                period_start = timezone.make_aware(timezone.datetime.combine(yesterday, timezone.time.min))
                period_end = timezone.make_aware(timezone.datetime.combine(yesterday, timezone.time.max))
                
                # Check if report already exists
                existing_report = ComplianceReport.objects.filter(
                    company=company,
                    report_type='daily',
                    period_start=period_start
                ).first()
                
                if existing_report:
                    continue
                
                # Generate report data
                invoices = Invoice.objects.filter(
                    company=company,
                    created_at__gte=period_start,
                    created_at__lte=period_end
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
                    created_at__gte=period_start,
                    created_at__lte=period_end
                ).count()
                
                # Create compliance report
                report = ComplianceReport.objects.create(
                    company=company,
                    report_type='daily',
                    period_start=period_start,
                    period_end=period_end,
                    total_invoices=total_invoices,
                    successful_invoices=successful_invoices,
                    failed_invoices=failed_invoices,
                    total_value=financial_data['total_value'] or 0,
                    total_tax=financial_data['total_tax'] or 0,
                    kra_acknowledgments=kra_acknowledgments,
                    detailed_data={
                        'success_rate': round((successful_invoices / total_invoices * 100) if total_invoices > 0 else 0, 2),
                        'average_transaction_value': float((financial_data['total_value'] or 0) / total_invoices) if total_invoices > 0 else 0,
                        'generated_at': timezone.now().isoformat()
                    }
                )
                
                reports_generated += 1
                
                # Send notification if significant issues detected
                if total_invoices > 0 and (failed_invoices / total_invoices) > 0.1:  # More than 10% failure rate
                    send_notification_task.delay(
                        str(company.id),
                        'email',
                        company.contact_email,
                        'High Transaction Failure Rate Detected',
                        f"""
                        We detected a high failure rate in your eTIMS transactions yesterday.
                        
                        Summary:
                        - Total Transactions: {total_invoices}
                        - Failed Transactions: {failed_invoices}
                        - Failure Rate: {round(failed_invoices / total_invoices * 100, 1)}%
                        
                        Please review your system configuration or contact support if you need assistance.
                        """,
                        'high_failure_rate'
                    )
                
            except Exception as e:
                logger.error(f"Failed to generate compliance report for company {company.id}: {str(e)}")
        
        logger.info(f"Generated {reports_generated} compliance reports")
        return {
            'success': True,
            'reports_generated': reports_generated
        }
        
    except Exception as e:
        logger.error(f"Compliance report generation error: {str(e)}")
        return {'success': False, 'error': str(e)}


@shared_task
def log_api_request(company_id: str, request_type: str, endpoint: str, 
                   request_data: Dict[str, Any], response_data: Dict[str, Any],
                   status_code: int, response_time: float = None):
    """
    Log API request details for audit and monitoring purposes.
    """
    try:
        from .models import ApiLog, Company
        
        company = Company.objects.get(id=company_id)
        
        api_log = ApiLog.objects.create(
            company=company,
            request_type=request_type,
            endpoint=endpoint,
            request_data=request_data,
            response_data=response_data,
            status_code=status_code,
            response_time=response_time or 0.0
        )
        
        logger.info(f"API request logged: {request_type} to {endpoint} for company {company_id}")
        
        return {
            'success': True,
            'log_id': str(api_log.id)
        }
        
    except Company.DoesNotExist:
        logger.error(f"Company not found for API logging: {company_id}")
        return {'success': False, 'error': 'Company not found'}
        
    except Exception as e:
        logger.error(f"Failed to log API request: {str(e)}")
        return {'success': False, 'error': str(e)}


@shared_task
def generate_daily_report():
    """
    Generate daily transaction report.
    Summarizes sales, failures, and system health.
    """
    try:
        from .models import Invoice, ApiLog
        from django.db.models import Count, Sum
        
        today = timezone.now().date()
        start_of_day = timezone.make_aware(timezone.datetime.combine(today, timezone.time.min))
        end_of_day = timezone.make_aware(timezone.datetime.combine(today, timezone.time.max))
        
        # Transaction statistics
        invoices_today = Invoice.objects.filter(
            created_at__range=[start_of_day, end_of_day]
        )
        
        stats = {
            'date': today,
            'total_transactions': invoices_today.count(),
            'successful_transactions': invoices_today.filter(status='confirmed').count(),
            'failed_transactions': invoices_today.filter(status='failed').count(),
            'pending_transactions': invoices_today.filter(status__in=['pending', 'retry']).count(),
            'total_amount': invoices_today.aggregate(Sum('total_amount'))['total_amount__sum'] or 0,
        }
        
        # API call statistics
        api_calls_today = ApiLog.objects.filter(
            created_at__range=[start_of_day, end_of_day]
        )
        
        api_stats = api_calls_today.values('request_type').annotate(
            count=Count('id'),
            success_count=Count('id', filter=Q(status_code=200)),
            avg_response_time=Avg('response_time')
        )
        
        stats['api_calls'] = list(api_stats)
        
        logger.info(f"Daily report generated: {stats}")
        
        # TODO: Send report via email or save to file
        
        return {
            'success': True,
            'report': stats
        }
        
    except Exception as e:
        logger.error(f"Daily report generation error: {e}")
        return {'success': False, 'error': str(e)}

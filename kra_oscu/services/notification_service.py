"""
Revpay Connect notification service.
Handles email, webhook, and SMS notifications for monitoring and alerts.
"""
import smtplib
import requests
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from django.conf import settings
from django.utils import timezone
from typing import Dict, Any, Optional

from ..models import NotificationLog, Company

logger = logging.getLogger(__name__)


class NotificationService:
    """Service for sending various types of notifications"""
    
    def __init__(self):
        self.smtp_host = getattr(settings, 'EMAIL_HOST', 'localhost')
        self.smtp_port = getattr(settings, 'EMAIL_PORT', 587)
        self.smtp_user = getattr(settings, 'EMAIL_HOST_USER', '')
        self.smtp_password = getattr(settings, 'EMAIL_HOST_PASSWORD', '')
        self.from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@revpayconnect.com')
    
    def send_email(self, company_id: str, recipient: str, subject: str, 
                   message: str, trigger_event: str) -> Dict[str, Any]:
        """Send email notification"""
        try:
            company = Company.objects.get(id=company_id)
            
            # Create notification log entry
            notification = NotificationLog.objects.create(
                company=company,
                notification_type='email',
                recipient=recipient,
                subject=subject,
                message=message,
                trigger_event=trigger_event,
                status='pending'
            )
            
            # Create email message
            msg = MIMEMultipart()
            msg['From'] = self.from_email
            msg['To'] = recipient
            msg['Subject'] = subject
            
            # Add Revpay Connect branding to email
            branded_message = f"""
            <html>
            <body>
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background-color: #1e3a8a; color: white; padding: 20px; text-align: center;">
                        <h1>Revpay Connect</h1>
                        <p>eTIMS Gateway Service</p>
                    </div>
                    <div style="padding: 20px; background-color: #f8fafc;">
                        <div style="white-space: pre-line;">{message}</div>
                    </div>
                    <div style="background-color: #e5e7eb; padding: 15px; text-align: center; font-size: 12px;">
                        <p>This is an automated message from Revpay Connect eTIMS Gateway.</p>
                        <p>For support, contact: support@revpayconnect.com</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            msg.attach(MIMEText(branded_message, 'html'))
            
            # Send email
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                if self.smtp_user and self.smtp_password:
                    server.login(self.smtp_user, self.smtp_password)
                
                server.send_message(msg)
            
            # Update notification status
            notification.status = 'sent'
            notification.sent_at = timezone.now()
            notification.save()
            
            logger.info(f"Email sent successfully to {recipient}")
            return {
                'success': True,
                'notification_id': notification.id,
                'message': 'Email sent successfully'
            }
            
        except Company.DoesNotExist:
            logger.error(f"Company not found: {company_id}")
            return {
                'success': False,
                'error': 'Company not found'
            }
        except Exception as e:
            logger.error(f"Failed to send email to {recipient}: {str(e)}")
            
            # Update notification status if it was created
            try:
                notification.status = 'failed'
                notification.error_message = str(e)
                notification.save()
            except:
                pass
            
            return {
                'success': False,
                'error': str(e)
            }
    
    def send_webhook(self, company_id: str, webhook_url: str, payload: Dict[str, Any], 
                     trigger_event: str) -> Dict[str, Any]:
        """Send webhook notification"""
        try:
            company = Company.objects.get(id=company_id)
            
            # Create notification log entry
            notification = NotificationLog.objects.create(
                company=company,
                notification_type='webhook',
                recipient=webhook_url,
                subject=f'Webhook: {trigger_event}',
                message=str(payload),
                trigger_event=trigger_event,
                status='pending'
            )
            
            # Add Revpay Connect metadata to payload
            enhanced_payload = {
                'event': trigger_event,
                'company_id': company_id,
                'company_name': company.company_name,
                'timestamp': timezone.now().isoformat(),
                'source': 'revpay_connect_etims',
                'data': payload
            }
            
            # Send webhook
            response = requests.post(
                webhook_url,
                json=enhanced_payload,
                headers={
                    'Content-Type': 'application/json',
                    'User-Agent': 'Revpay-Connect-eTIMS/1.0',
                    'X-Revpay-Event': trigger_event,
                    'X-Revpay-Company': company_id
                },
                timeout=30
            )
            
            response.raise_for_status()
            
            # Update notification status
            notification.status = 'delivered' if response.status_code == 200 else 'sent'
            notification.sent_at = timezone.now()
            notification.save()
            
            logger.info(f"Webhook sent successfully to {webhook_url}")
            return {
                'success': True,
                'notification_id': notification.id,
                'status_code': response.status_code,
                'message': 'Webhook sent successfully'
            }
            
        except Company.DoesNotExist:
            logger.error(f"Company not found: {company_id}")
            return {
                'success': False,
                'error': 'Company not found'
            }
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to send webhook to {webhook_url}: {str(e)}")
            
            # Update notification status
            try:
                notification.status = 'failed'
                notification.error_message = str(e)
                notification.save()
            except:
                pass
            
            return {
                'success': False,
                'error': str(e)
            }
        except Exception as e:
            logger.error(f"Unexpected error sending webhook: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def send_sms(self, company_id: str, phone_number: str, message: str, 
                 trigger_event: str) -> Dict[str, Any]:
        """Send SMS notification (placeholder for SMS service integration)"""
        try:
            company = Company.objects.get(id=company_id)
            
            # Create notification log entry
            notification = NotificationLog.objects.create(
                company=company,
                notification_type='sms',
                recipient=phone_number,
                subject=f'SMS: {trigger_event}',
                message=message,
                trigger_event=trigger_event,
                status='pending'
            )
            
            # Add Revpay Connect branding to SMS
            branded_message = f"Revpay Connect: {message}"
            
            # TODO: Integrate with SMS service provider (Twilio, AWS SNS, etc.)
            # For now, we'll simulate SMS sending
            logger.info(f"SMS would be sent to {phone_number}: {branded_message}")
            
            # Update notification status
            notification.status = 'sent'
            notification.sent_at = timezone.now()
            notification.save()
            
            return {
                'success': True,
                'notification_id': notification.id,
                'message': 'SMS sent successfully (simulated)'
            }
            
        except Company.DoesNotExist:
            logger.error(f"Company not found: {company_id}")
            return {
                'success': False,
                'error': 'Company not found'
            }
        except Exception as e:
            logger.error(f"Failed to send SMS to {phone_number}: {str(e)}")
            
            # Update notification status
            try:
                notification.status = 'failed'
                notification.error_message = str(e)
                notification.save()
            except:
                pass
            
            return {
                'success': False,
                'error': str(e)
            }
    
    def send_system_alert(self, company_id: str, alert_type: str, message: str, 
                         severity: str = 'info') -> Dict[str, Any]:
        """Send system alert notification"""
        try:
            company = Company.objects.get(id=company_id)
            
            # Create notification log entry
            notification = NotificationLog.objects.create(
                company=company,
                notification_type='system',
                recipient='system',
                subject=f'System Alert: {alert_type}',
                message=message,
                trigger_event=f'system_alert_{alert_type}',
                status='sent'
            )
            
            # Log system alert
            logger.log(
                logging.CRITICAL if severity == 'critical' else
                logging.ERROR if severity == 'error' else
                logging.WARNING if severity == 'warning' else
                logging.INFO,
                f"System Alert [{alert_type}] for {company.company_name}: {message}"
            )
            
            # If critical, also send email to admin
            if severity == 'critical':
                admin_email = getattr(settings, 'ADMIN_EMAIL', 'admin@revpayconnect.com')
                self.send_email(
                    company_id=company_id,
                    recipient=admin_email,
                    subject=f'CRITICAL ALERT: {alert_type} - {company.company_name}',
                    message=f"""
                    Critical system alert detected:
                    
                    Company: {company.company_name} ({company.tin})
                    Alert Type: {alert_type}
                    Severity: {severity}
                    
                    Details:
                    {message}
                    
                    Please investigate immediately.
                    """,
                    trigger_event=f'critical_alert_{alert_type}'
                )
            
            return {
                'success': True,
                'notification_id': notification.id,
                'message': 'System alert logged successfully'
            }
            
        except Company.DoesNotExist:
            logger.error(f"Company not found: {company_id}")
            return {
                'success': False,
                'error': 'Company not found'
            }
        except Exception as e:
            logger.error(f"Failed to send system alert: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }


# Convenience functions for common notification scenarios
def send_transaction_failure_alert(company_id: str, invoice_id: str, error_message: str):
    """Send alert for transaction failure"""
    service = NotificationService()
    
    try:
        company = Company.objects.get(id=company_id)
        
        message = f"""
        Transaction failure detected for your eTIMS integration.
        
        Invoice ID: {invoice_id}
        Error: {error_message}
        Time: {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}
        
        Our system will automatically retry this transaction. If the issue persists, please contact support.
        """
        
        # Send email to company contact
        service.send_email(
            company_id=company_id,
            recipient=company.contact_email,
            subject='eTIMS Transaction Failure Alert',
            message=message,
            trigger_event='transaction_failure'
        )
        
        # Send system alert
        service.send_system_alert(
            company_id=company_id,
            alert_type='transaction_failure',
            message=f'Invoice {invoice_id} failed: {error_message}',
            severity='error'
        )
        
    except Exception as e:
        logger.error(f"Failed to send transaction failure alert: {str(e)}")


def send_device_offline_alert(company_id: str, device_id: str, device_name: str):
    """Send alert when device goes offline"""
    service = NotificationService()
    
    try:
        company = Company.objects.get(id=company_id)
        
        message = f"""
        Device offline alert for your eTIMS integration.
        
        Device: {device_name}
        Device ID: {device_id}
        Time: {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}
        
        The device has not communicated with KRA for an extended period. Please check your device connectivity and contact support if needed.
        """
        
        # Send email to company contact
        service.send_email(
            company_id=company_id,
            recipient=company.contact_email,
            subject='eTIMS Device Offline Alert',
            message=message,
            trigger_event='device_offline'
        )
        
        # Send system alert
        service.send_system_alert(
            company_id=company_id,
            alert_type='device_offline',
            message=f'Device {device_name} ({device_id}) is offline',
            severity='warning'
        )
        
    except Exception as e:
        logger.error(f"Failed to send device offline alert: {str(e)}")


def send_compliance_report_ready(company_id: str, report_id: str, report_type: str):
    """Send notification when compliance report is ready"""
    service = NotificationService()
    
    try:
        company = Company.objects.get(id=company_id)
        
        message = f"""
        Your {report_type} compliance report is now available.
        
        Report ID: {report_id}
        Generated: {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}
        
        You can download the report from your Revpay Connect dashboard or contact support for assistance.
        """
        
        # Send email to company contact
        service.send_email(
            company_id=company_id,
            recipient=company.contact_email,
            subject=f'Compliance Report Ready - {report_type.title()}',
            message=message,
            trigger_event='compliance_report_ready'
        )
        
    except Exception as e:
        logger.error(f"Failed to send compliance report notification: {str(e)}")

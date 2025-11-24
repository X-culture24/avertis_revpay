"""
Celery tasks for subscription management, monitoring, and notifications
Handles trial expiration, payment reminders, and subscription status updates
"""
from celery import shared_task
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
import logging

from .models import Company, NotificationLog

logger = logging.getLogger(__name__)


@shared_task(name='kra_oscu.check_subscription_status')
def check_subscription_status():
    """
    Check all company subscriptions and update statuses.
    Runs every hour to monitor trial periods and subscription expirations.
    """
    logger.info("Starting subscription status check...")
    
    # Check trial expirations
    trial_companies = Company.objects.filter(
        subscription_status='trial',
        trial_ends_at__isnull=False
    )
    
    for company in trial_companies:
        days_remaining = (company.trial_ends_at - timezone.now()).days
        
        # Trial expired
        if company.trial_ends_at <= timezone.now():
            logger.info(f"Trial expired for {company.company_name}")
            company.subscription_status = 'expired'
            company.save()
            
            # Send notification
            send_trial_expired_notification(company)
        
        # Trial ending soon (3 days, 1 day, same day)
        elif days_remaining in [3, 1, 0]:
            logger.info(f"Trial ending in {days_remaining} days for {company.company_name}")
            send_trial_ending_notification(company, days_remaining)
    
    # Check active subscription expirations
    active_companies = Company.objects.filter(
        subscription_status='active',
        subscription_ends_at__isnull=False
    )
    
    for company in active_companies:
        days_remaining = (company.subscription_ends_at - timezone.now()).days
        
        # Subscription expired
        if company.subscription_ends_at <= timezone.now():
            logger.info(f"Subscription expired for {company.company_name}")
            company.subscription_status = 'expired'
            company.save()
            
            # Send notification
            send_subscription_expired_notification(company)
        
        # Subscription expiring soon (7 days, 3 days, 1 day)
        elif days_remaining in [7, 3, 1]:
            logger.info(f"Subscription expiring in {days_remaining} days for {company.company_name}")
            send_subscription_expiring_notification(company, days_remaining)
    
    logger.info("Subscription status check completed")
    return {
        'trial_companies_checked': trial_companies.count(),
        'active_companies_checked': active_companies.count()
    }


@shared_task(name='kra_oscu.process_auto_renewals')
def process_auto_renewals():
    """
    Process automatic subscription renewals for companies with auto-renew enabled.
    Runs daily to check for subscriptions that need renewal.
    """
    logger.info("Starting auto-renewal processing...")
    
    # Get companies with subscriptions expiring tomorrow and auto-renew enabled
    tomorrow = timezone.now() + timedelta(days=1)
    companies_to_renew = Company.objects.filter(
        subscription_status='active',
        auto_renew=True,
        subscription_ends_at__date=tomorrow.date()
    )
    
    renewed_count = 0
    failed_count = 0
    
    for company in companies_to_renew:
        try:
            # TODO: Integrate with actual payment processor (M-Pesa, Stripe, etc.)
            # For now, just extend subscription by 30 days
            logger.info(f"Auto-renewing subscription for {company.company_name}")
            
            # In production, this would:
            # 1. Charge the saved payment method
            # 2. If successful, extend subscription
            # 3. If failed, send notification and disable auto-renew
            
            # Simulate successful renewal
            company.subscription_ends_at = timezone.now() + timedelta(days=30)
            company.last_payment_date = timezone.now()
            company.save()
            
            # Send success notification
            send_renewal_success_notification(company)
            renewed_count += 1
            
        except Exception as e:
            logger.error(f"Failed to auto-renew for {company.company_name}: {str(e)}")
            send_renewal_failed_notification(company, str(e))
            failed_count += 1
    
    logger.info(f"Auto-renewal processing completed: {renewed_count} renewed, {failed_count} failed")
    return {
        'renewed': renewed_count,
        'failed': failed_count
    }


@shared_task(name='kra_oscu.check_usage_limits')
def check_usage_limits():
    """
    Check companies approaching their subscription limits and send warnings.
    Runs daily to monitor invoice usage.
    """
    logger.info("Starting usage limits check...")
    
    from .models import Invoice
    from .subscription_views import SUBSCRIPTION_PLANS
    
    # Get all active/trial companies
    companies = Company.objects.filter(
        subscription_status__in=['active', 'trial']
    )
    
    current_month_start = timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    for company in companies:
        # Get plan limits
        plan_id = company.subscription_plan or 'free'
        plan_limits = SUBSCRIPTION_PLANS.get(plan_id, {}).get('limits', {})
        invoice_limit = plan_limits.get('invoices', 0)
        
        # Skip unlimited plans
        if invoice_limit == -1:
            continue
        
        # Count invoices this month
        invoices_count = Invoice.objects.filter(
            company=company,
            created_at__gte=current_month_start
        ).count()
        
        # Calculate percentage
        usage_percentage = (invoices_count / invoice_limit) * 100 if invoice_limit > 0 else 0
        
        # Send warnings at 75%, 90%, and 100%
        if usage_percentage >= 100 and invoices_count == invoice_limit:
            send_limit_reached_notification(company, invoices_count, invoice_limit)
        elif usage_percentage >= 90 and invoices_count == int(invoice_limit * 0.9):
            send_limit_warning_notification(company, invoices_count, invoice_limit, 90)
        elif usage_percentage >= 75 and invoices_count == int(invoice_limit * 0.75):
            send_limit_warning_notification(company, invoices_count, invoice_limit, 75)
    
    logger.info("Usage limits check completed")
    return {'companies_checked': companies.count()}


# Notification helper functions
def send_trial_expired_notification(company: Company):
    """Send notification when trial expires"""
    NotificationLog.objects.create(
        company=company,
        notification_type='system',
        recipient=company.contact_email,
        subject='Your Revpay Connect Trial Has Expired',
        message=f'Your 7-day trial has ended. Upgrade to a paid plan to continue using Revpay Connect.',
        status='pending',
        context_data={'priority': 'high', 'action': 'upgrade'}
    )


def send_trial_ending_notification(company: Company, days_remaining: int):
    """Send notification when trial is ending soon"""
    NotificationLog.objects.create(
        company=company,
        notification_type='system',
        recipient=company.contact_email,
        subject=f'Your Trial Ends in {days_remaining} Day{"s" if days_remaining != 1 else ""}',
        message=f'Your Revpay Connect trial ends in {days_remaining} day{"s" if days_remaining != 1 else ""}. Upgrade now to avoid service interruption.',
        status='pending',
        context_data={'priority': 'high', 'days_remaining': days_remaining}
    )


def send_subscription_expired_notification(company: Company):
    """Send notification when subscription expires"""
    NotificationLog.objects.create(
        company=company,
        notification_type='payment',
        recipient=company.contact_email,
        subject='Your Subscription Has Expired',
        message='Your Revpay Connect subscription has expired. Renew now to continue creating invoices.',
        status='pending',
        context_data={'priority': 'high', 'action': 'renew'}
    )


def send_subscription_expiring_notification(company: Company, days_remaining: int):
    """Send notification when subscription is expiring soon"""
    NotificationLog.objects.create(
        company=company,
        notification_type='payment',
        recipient=company.contact_email,
        subject=f'Subscription Expires in {days_remaining} Day{"s" if days_remaining != 1 else ""}',
        message=f'Your subscription expires in {days_remaining} day{"s" if days_remaining != 1 else ""}. Auto-renewal is {"enabled" if company.auto_renew else "disabled"}.',
        status='pending',
        context_data={'priority': 'medium', 'days_remaining': days_remaining}
    )


def send_renewal_success_notification(company: Company):
    """Send notification when auto-renewal succeeds"""
    NotificationLog.objects.create(
        company=company,
        notification_type='payment',
        recipient=company.contact_email,
        subject='Subscription Renewed Successfully',
        message=f'Your {company.subscription_plan} subscription has been renewed for another month.',
        status='pending',
        context_data={'priority': 'low'}
    )


def send_renewal_failed_notification(company: Company, error: str):
    """Send notification when auto-renewal fails"""
    NotificationLog.objects.create(
        company=company,
        notification_type='payment',
        recipient=company.contact_email,
        subject='Subscription Renewal Failed',
        message=f'We could not renew your subscription. Please update your payment method. Error: {error}',
        status='pending',
        context_data={'priority': 'high', 'action': 'update_payment'}
    )


def send_limit_reached_notification(company: Company, used: int, limit: int):
    """Send notification when invoice limit is reached"""
    NotificationLog.objects.create(
        company=company,
        notification_type='system',
        recipient=company.contact_email,
        subject='Invoice Limit Reached',
        message=f'You have reached your monthly limit of {limit} invoices. Upgrade your plan to create more invoices.',
        status='pending',
        context_data={'priority': 'high', 'action': 'upgrade', 'used': used, 'limit': limit}
    )


def send_limit_warning_notification(company: Company, used: int, limit: int, percentage: int):
    """Send warning when approaching invoice limit"""
    NotificationLog.objects.create(
        company=company,
        notification_type='system',
        recipient=company.contact_email,
        subject=f'Invoice Limit Warning: {percentage}% Used',
        message=f'You have used {used} of {limit} invoices this month ({percentage}%). Consider upgrading to avoid hitting your limit.',
        status='pending',
        context_data={'priority': 'medium', 'used': used, 'limit': limit, 'percentage': percentage}
    )

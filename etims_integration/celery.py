import os
from celery import Celery

# Set the default Django settings module for the 'celery' program.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'etims_integration.settings')

app = Celery('etims_integration')

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Load task modules from all registered Django apps.
app.autodiscover_tasks()

# Celery Beat Schedule for periodic tasks
from celery.schedules import crontab

app.conf.beat_schedule = {
    # Check subscription status every hour
    'check-subscription-status': {
        'task': 'kra_oscu.check_subscription_status',
        'schedule': crontab(minute=0),  # Every hour at minute 0
    },
    # Process auto-renewals daily at 2 AM
    'process-auto-renewals': {
        'task': 'kra_oscu.process_auto_renewals',
        'schedule': crontab(hour=2, minute=0),  # Daily at 2:00 AM
    },
    # Check usage limits daily at 6 AM
    'check-usage-limits': {
        'task': 'kra_oscu.check_usage_limits',
        'schedule': crontab(hour=6, minute=0),  # Daily at 6:00 AM
    },
    # Existing tasks
    'retry-failed-invoices': {
        'task': 'kra_oscu.retry_sales_invoice',
        'schedule': crontab(minute='*/15'),  # Every 15 minutes
    },
    'sync-device-status': {
        'task': 'kra_oscu.sync_device_status',
        'schedule': crontab(hour='*/6'),  # Every 6 hours
    },
    'generate-compliance-reports': {
        'task': 'kra_oscu.generate_compliance_reports',
        'schedule': crontab(hour=0, minute=0, day_of_month=1),  # First day of month at midnight
    },
}

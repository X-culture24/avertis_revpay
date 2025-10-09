"""
Setup Celery Beat periodic tasks for Revpay Connect eTIMS Gateway.
Configures scheduled tasks for monitoring, compliance, and maintenance.
"""
from django.core.management.base import BaseCommand
from django_celery_beat.models import PeriodicTask, IntervalSchedule, CrontabSchedule
import json


class Command(BaseCommand):
    help = 'Setup Celery Beat periodic tasks for Revpay Connect'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear-existing',
            action='store_true',
            help='Clear existing periodic tasks before creating new ones'
        )

    def handle(self, *args, **options):
        self.stdout.write(
            self.style.SUCCESS('⏰ Setting up Celery Beat periodic tasks for Revpay Connect')
        )
        self.stdout.write('=' * 70)
        
        if options['clear_existing']:
            self._clear_existing_tasks()
        
        # Create schedules
        schedules = self._create_schedules()
        
        # Create periodic tasks
        self._create_periodic_tasks(schedules)
        
        self.stdout.write('\n✅ Celery Beat setup completed successfully!')

    def _clear_existing_tasks(self):
        """Clear existing Revpay Connect periodic tasks"""
        self.stdout.write('\n🧹 Clearing existing periodic tasks...')
        
        revpay_tasks = PeriodicTask.objects.filter(
            name__startswith='revpay_'
        )
        
        deleted_count = revpay_tasks.count()
        revpay_tasks.delete()
        
        self.stdout.write(f'✅ Cleared {deleted_count} existing tasks')

    def _create_schedules(self):
        """Create interval and cron schedules"""
        self.stdout.write('\n📅 Creating schedules...')
        
        schedules = {}
        
        # Every 5 minutes
        schedules['every_5_minutes'], _ = IntervalSchedule.objects.get_or_create(
            every=5,
            period=IntervalSchedule.MINUTES,
        )
        
        # Every 15 minutes
        schedules['every_15_minutes'], _ = IntervalSchedule.objects.get_or_create(
            every=15,
            period=IntervalSchedule.MINUTES,
        )
        
        # Every hour
        schedules['every_hour'], _ = IntervalSchedule.objects.get_or_create(
            every=1,
            period=IntervalSchedule.HOURS,
        )
        
        # Every 6 hours
        schedules['every_6_hours'], _ = IntervalSchedule.objects.get_or_create(
            every=6,
            period=IntervalSchedule.HOURS,
        )
        
        # Daily at 2 AM
        schedules['daily_2am'], _ = CrontabSchedule.objects.get_or_create(
            minute=0,
            hour=2,
            day_of_week='*',
            day_of_month='*',
            month_of_year='*',
        )
        
        # Daily at 6 AM
        schedules['daily_6am'], _ = CrontabSchedule.objects.get_or_create(
            minute=0,
            hour=6,
            day_of_week='*',
            day_of_month='*',
            month_of_year='*',
        )
        
        # Weekly on Sunday at 3 AM
        schedules['weekly_sunday'], _ = CrontabSchedule.objects.get_or_create(
            minute=0,
            hour=3,
            day_of_week=0,  # Sunday
            day_of_month='*',
            month_of_year='*',
        )
        
        self.stdout.write(f'✅ Created {len(schedules)} schedules')
        return schedules

    def _create_periodic_tasks(self, schedules):
        """Create all periodic tasks"""
        self.stdout.write('\n📋 Creating periodic tasks...')
        
        tasks = [
            # High frequency monitoring tasks
            {
                'name': 'revpay_process_pending_retries',
                'task': 'kra_oscu.tasks.process_pending_retries',
                'schedule': schedules['every_5_minutes'],
                'description': 'Process pending retry queue entries'
            },
            {
                'name': 'revpay_monitor_system_health',
                'task': 'kra_oscu.tasks.monitor_system_health',
                'schedule': schedules['every_15_minutes'],
                'description': 'Monitor overall system health and send alerts'
            },
            
            # Hourly tasks
            {
                'name': 'revpay_sync_device_status',
                'task': 'kra_oscu.tasks.sync_device_status',
                'schedule': schedules['every_hour'],
                'description': 'Sync device status with KRA'
            },
            
            # 6-hourly tasks
            {
                'name': 'revpay_sync_system_codes',
                'task': 'kra_oscu.tasks.sync_system_codes',
                'schedule': schedules['every_6_hours'],
                'description': 'Sync system codes from KRA'
            },
            
            # Daily tasks
            {
                'name': 'revpay_generate_compliance_reports',
                'task': 'kra_oscu.tasks.generate_compliance_reports',
                'schedule': schedules['daily_2am'],
                'description': 'Generate daily compliance reports for all companies'
            },
            {
                'name': 'revpay_generate_daily_report',
                'task': 'kra_oscu.tasks.generate_daily_report',
                'schedule': schedules['daily_6am'],
                'description': 'Generate system-wide daily report'
            },
            
            # Weekly tasks
            {
                'name': 'revpay_cleanup_old_data',
                'task': 'kra_oscu.tasks.cleanup_old_data',
                'schedule': schedules['weekly_sunday'],
                'description': 'Clean up old logs and data to prevent database bloat'
            },
        ]
        
        created_count = 0
        updated_count = 0
        
        for task_config in tasks:
            task, created = PeriodicTask.objects.get_or_create(
                name=task_config['name'],
                defaults={
                    'task': task_config['task'],
                    'interval': task_config['schedule'] if isinstance(task_config['schedule'], IntervalSchedule) else None,
                    'crontab': task_config['schedule'] if isinstance(task_config['schedule'], CrontabSchedule) else None,
                    'enabled': True,
                    'description': task_config['description']
                }
            )
            
            if created:
                created_count += 1
                self.stdout.write(f'✅ Created: {task_config["name"]}')
            else:
                # Update existing task
                task.task = task_config['task']
                task.interval = task_config['schedule'] if isinstance(task_config['schedule'], IntervalSchedule) else None
                task.crontab = task_config['schedule'] if isinstance(task_config['schedule'], CrontabSchedule) else None
                task.description = task_config['description']
                task.enabled = True
                task.save()
                updated_count += 1
                self.stdout.write(f'🔄 Updated: {task_config["name"]}')
        
        self.stdout.write(f'\n📊 Summary: {created_count} created, {updated_count} updated')
        
        # Display task schedule summary
        self._display_task_summary()

    def _display_task_summary(self):
        """Display summary of all scheduled tasks"""
        self.stdout.write('\n📋 Scheduled Tasks Summary')
        self.stdout.write('-' * 50)
        
        tasks = PeriodicTask.objects.filter(
            name__startswith='revpay_',
            enabled=True
        ).order_by('name')
        
        for task in tasks:
            if task.interval:
                schedule_info = f"Every {task.interval.every} {task.interval.period}"
            elif task.crontab:
                cron = task.crontab
                if cron.hour == 2 and cron.minute == 0 and cron.day_of_week == '*':
                    schedule_info = "Daily at 2:00 AM"
                elif cron.hour == 6 and cron.minute == 0 and cron.day_of_week == '*':
                    schedule_info = "Daily at 6:00 AM"
                elif cron.day_of_week == 0 and cron.hour == 3:
                    schedule_info = "Weekly on Sunday at 3:00 AM"
                else:
                    schedule_info = f"Cron: {cron.minute} {cron.hour} {cron.day_of_month} {cron.month_of_year} {cron.day_of_week}"
            else:
                schedule_info = "No schedule"
            
            self.stdout.write(f'⏰ {task.name}: {schedule_info}')
            if task.description:
                self.stdout.write(f'   📝 {task.description}')
        
        self.stdout.write('\n💡 Tips:')
        self.stdout.write('   • Start Celery Beat: celery -A etims_integration beat --loglevel=info')
        self.stdout.write('   • Start Celery Worker: celery -A etims_integration worker --loglevel=info')
        self.stdout.write('   • Monitor tasks in Django admin: /admin/django_celery_beat/')
        self.stdout.write('   • View task results: Check Celery logs and Django admin')

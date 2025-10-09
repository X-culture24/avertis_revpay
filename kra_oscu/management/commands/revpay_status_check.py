"""
Revpay Connect system status check management command.
Performs comprehensive health checks and sends alerts if issues are detected.
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db.models import Count, Avg
from datetime import timedelta
import logging

from ...models import Company, Device, Invoice, ApiLog, RetryQueue
from ...services.kra_client import KRAClient
from ...tasks import send_admin_alert, send_notification_task

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Perform comprehensive system status check for Revpay Connect eTIMS Gateway'

    def add_arguments(self, parser):
        parser.add_argument(
            '--send-alerts',
            action='store_true',
            help='Send alerts for detected issues'
        )
        parser.add_argument(
            '--verbose',
            action='store_true',
            help='Enable verbose output'
        )

    def handle(self, *args, **options):
        self.verbose = options['verbose']
        self.send_alerts = options['send_alerts']
        
        self.stdout.write(
            self.style.SUCCESS('🚀 Revpay Connect eTIMS Gateway - System Status Check')
        )
        self.stdout.write('=' * 60)
        
        # Perform all checks
        issues = []
        
        # 1. Database connectivity and basic stats
        db_issues = self._check_database_health()
        issues.extend(db_issues)
        
        # 2. KRA connectivity
        kra_issues = self._check_kra_connectivity()
        issues.extend(kra_issues)
        
        # 3. Company and device status
        company_issues = self._check_companies_and_devices()
        issues.extend(company_issues)
        
        # 4. Transaction health
        transaction_issues = self._check_transaction_health()
        issues.extend(transaction_issues)
        
        # 5. Retry queue status
        retry_issues = self._check_retry_queue()
        issues.extend(retry_issues)
        
        # 6. System performance
        performance_issues = self._check_system_performance()
        issues.extend(performance_issues)
        
        # Summary
        self._print_summary(issues)
        
        # Send alerts if requested and issues found
        if self.send_alerts and issues:
            self._send_alerts(issues)

    def _check_database_health(self):
        """Check database connectivity and basic statistics"""
        self.stdout.write('\n📊 Database Health Check')
        self.stdout.write('-' * 30)
        
        issues = []
        
        try:
            # Basic counts
            total_companies = Company.objects.count()
            active_companies = Company.objects.filter(status='active').count()
            total_devices = Device.objects.count()
            active_devices = Device.objects.filter(status='active').count()
            
            self.stdout.write(f'✅ Database connectivity: OK')
            self.stdout.write(f'📈 Companies: {total_companies} total, {active_companies} active')
            self.stdout.write(f'🖥️  Devices: {total_devices} total, {active_devices} active')
            
            # Check for inactive companies with recent activity
            inactive_with_activity = Company.objects.filter(
                status__in=['inactive', 'suspended'],
                invoices__created_at__gte=timezone.now() - timedelta(days=1)
            ).distinct().count()
            
            if inactive_with_activity > 0:
                issue = f"Found {inactive_with_activity} inactive companies with recent transactions"
                issues.append(('warning', issue))
                self.stdout.write(self.style.WARNING(f'⚠️  {issue}'))
            
        except Exception as e:
            issue = f"Database connectivity error: {str(e)}"
            issues.append(('critical', issue))
            self.stdout.write(self.style.ERROR(f'❌ {issue}'))
        
        return issues

    def _check_kra_connectivity(self):
        """Check KRA API connectivity"""
        self.stdout.write('\n🌐 KRA Connectivity Check')
        self.stdout.write('-' * 30)
        
        issues = []
        
        try:
            kra_client = KRAClient()
            result = kra_client.test_connection()
            
            if result.get('success'):
                response_time = result.get('response_time', 0)
                self.stdout.write(f'✅ KRA connectivity: OK ({response_time:.3f}s)')
                
                if response_time > 5.0:
                    issue = f"KRA response time is slow: {response_time:.3f}s"
                    issues.append(('warning', issue))
                    self.stdout.write(self.style.WARNING(f'⚠️  {issue}'))
            else:
                issue = f"KRA connectivity failed: {result.get('error', 'Unknown error')}"
                issues.append(('critical', issue))
                self.stdout.write(self.style.ERROR(f'❌ {issue}'))
                
        except Exception as e:
            issue = f"KRA connectivity test error: {str(e)}"
            issues.append(('critical', issue))
            self.stdout.write(self.style.ERROR(f'❌ {issue}'))
        
        return issues

    def _check_companies_and_devices(self):
        """Check company and device status"""
        self.stdout.write('\n🏢 Companies & Devices Check')
        self.stdout.write('-' * 30)
        
        issues = []
        
        try:
            # Check for companies without devices
            companies_without_devices = Company.objects.filter(
                status='active',
                devices__isnull=True
            ).count()
            
            if companies_without_devices > 0:
                issue = f"{companies_without_devices} active companies have no devices"
                issues.append(('warning', issue))
                self.stdout.write(self.style.WARNING(f'⚠️  {issue}'))
            else:
                self.stdout.write('✅ All active companies have devices')
            
            # Check for devices that haven't synced recently
            stale_threshold = timezone.now() - timedelta(hours=24)
            stale_devices = Device.objects.filter(
                status='active',
                last_sync__lt=stale_threshold
            ).count()
            
            if stale_devices > 0:
                issue = f"{stale_devices} active devices haven't synced in 24+ hours"
                issues.append(('warning', issue))
                self.stdout.write(self.style.WARNING(f'⚠️  {issue}'))
            else:
                self.stdout.write('✅ All devices have recent sync activity')
            
            # Check for uncertified devices in production companies
            uncertified_prod = Device.objects.filter(
                company__status='active',
                company__is_sandbox=False,
                is_certified=False,
                status='active'
            ).count()
            
            if uncertified_prod > 0:
                issue = f"{uncertified_prod} uncertified devices in production companies"
                issues.append(('error', issue))
                self.stdout.write(self.style.ERROR(f'🚨 {issue}'))
            
        except Exception as e:
            issue = f"Company/device check error: {str(e)}"
            issues.append(('error', issue))
            self.stdout.write(self.style.ERROR(f'❌ {issue}'))
        
        return issues

    def _check_transaction_health(self):
        """Check transaction processing health"""
        self.stdout.write('\n💳 Transaction Health Check')
        self.stdout.write('-' * 30)
        
        issues = []
        
        try:
            # Check last 24 hours
            last_24h = timezone.now() - timedelta(hours=24)
            
            recent_invoices = Invoice.objects.filter(created_at__gte=last_24h)
            total_recent = recent_invoices.count()
            
            if total_recent == 0:
                self.stdout.write('ℹ️  No transactions in the last 24 hours')
            else:
                confirmed = recent_invoices.filter(status='confirmed').count()
                failed = recent_invoices.filter(status='failed').count()
                pending = recent_invoices.filter(status__in=['pending', 'retry']).count()
                
                success_rate = (confirmed / total_recent * 100) if total_recent > 0 else 0
                
                self.stdout.write(f'📊 Last 24h: {total_recent} transactions')
                self.stdout.write(f'   ✅ Confirmed: {confirmed} ({success_rate:.1f}%)')
                self.stdout.write(f'   ❌ Failed: {failed}')
                self.stdout.write(f'   ⏳ Pending: {pending}')
                
                # Check for high failure rate
                if success_rate < 90 and total_recent > 10:
                    issue = f"Low success rate: {success_rate:.1f}% ({confirmed}/{total_recent})"
                    issues.append(('error', issue))
                    self.stdout.write(self.style.ERROR(f'🚨 {issue}'))
                
                # Check for too many pending transactions
                if pending > (total_recent * 0.1):  # More than 10% pending
                    issue = f"High number of pending transactions: {pending}"
                    issues.append(('warning', issue))
                    self.stdout.write(self.style.WARNING(f'⚠️  {issue}'))
            
        except Exception as e:
            issue = f"Transaction health check error: {str(e)}"
            issues.append(('error', issue))
            self.stdout.write(self.style.ERROR(f'❌ {issue}'))
        
        return issues

    def _check_retry_queue(self):
        """Check retry queue status"""
        self.stdout.write('\n🔄 Retry Queue Check')
        self.stdout.write('-' * 30)
        
        issues = []
        
        try:
            pending_retries = RetryQueue.objects.filter(status='pending').count()
            processing_retries = RetryQueue.objects.filter(status='processing').count()
            failed_retries = RetryQueue.objects.filter(status='failed').count()
            
            self.stdout.write(f'⏳ Pending retries: {pending_retries}')
            self.stdout.write(f'🔄 Processing retries: {processing_retries}')
            self.stdout.write(f'❌ Failed retries: {failed_retries}')
            
            # Check for stuck processing retries
            stuck_threshold = timezone.now() - timedelta(hours=2)
            stuck_retries = RetryQueue.objects.filter(
                status='processing',
                updated_at__lt=stuck_threshold
            ).count()
            
            if stuck_retries > 0:
                issue = f"{stuck_retries} retry tasks appear to be stuck"
                issues.append(('error', issue))
                self.stdout.write(self.style.ERROR(f'🚨 {issue}'))
            
            # Check for high number of failed retries
            if failed_retries > 50:
                issue = f"High number of permanently failed retries: {failed_retries}"
                issues.append(('warning', issue))
                self.stdout.write(self.style.WARNING(f'⚠️  {issue}'))
            
        except Exception as e:
            issue = f"Retry queue check error: {str(e)}"
            issues.append(('error', issue))
            self.stdout.write(self.style.ERROR(f'❌ {issue}'))
        
        return issues

    def _check_system_performance(self):
        """Check system performance metrics"""
        self.stdout.write('\n⚡ System Performance Check')
        self.stdout.write('-' * 30)
        
        issues = []
        
        try:
            # Check API response times in last hour
            last_hour = timezone.now() - timedelta(hours=1)
            
            recent_logs = ApiLog.objects.filter(created_at__gte=last_hour)
            
            if recent_logs.exists():
                avg_response_time = recent_logs.aggregate(
                    avg_time=Avg('response_time')
                )['avg_time']
                
                error_rate = recent_logs.filter(status_code__gte=400).count() / recent_logs.count() * 100
                
                self.stdout.write(f'📈 Last hour API stats:')
                self.stdout.write(f'   🕐 Avg response time: {avg_response_time:.3f}s')
                self.stdout.write(f'   📊 Error rate: {error_rate:.1f}%')
                
                if avg_response_time > 3.0:
                    issue = f"High average response time: {avg_response_time:.3f}s"
                    issues.append(('warning', issue))
                    self.stdout.write(self.style.WARNING(f'⚠️  {issue}'))
                
                if error_rate > 10:
                    issue = f"High error rate: {error_rate:.1f}%"
                    issues.append(('error', issue))
                    self.stdout.write(self.style.ERROR(f'🚨 {issue}'))
            else:
                self.stdout.write('ℹ️  No API activity in the last hour')
            
        except Exception as e:
            issue = f"Performance check error: {str(e)}"
            issues.append(('error', issue))
            self.stdout.write(self.style.ERROR(f'❌ {issue}'))
        
        return issues

    def _print_summary(self, issues):
        """Print summary of all issues found"""
        self.stdout.write('\n📋 Summary')
        self.stdout.write('=' * 60)
        
        if not issues:
            self.stdout.write(self.style.SUCCESS('🎉 All systems are healthy!'))
        else:
            critical_count = len([i for i in issues if i[0] == 'critical'])
            error_count = len([i for i in issues if i[0] == 'error'])
            warning_count = len([i for i in issues if i[0] == 'warning'])
            
            self.stdout.write(f'🚨 Critical issues: {critical_count}')
            self.stdout.write(f'❌ Error issues: {error_count}')
            self.stdout.write(f'⚠️  Warning issues: {warning_count}')
            
            self.stdout.write('\nIssue Details:')
            for severity, message in issues:
                if severity == 'critical':
                    self.stdout.write(self.style.ERROR(f'🚨 CRITICAL: {message}'))
                elif severity == 'error':
                    self.stdout.write(self.style.ERROR(f'❌ ERROR: {message}'))
                else:
                    self.stdout.write(self.style.WARNING(f'⚠️  WARNING: {message}'))

    def _send_alerts(self, issues):
        """Send alerts for detected issues"""
        self.stdout.write('\n📧 Sending Alerts')
        self.stdout.write('-' * 30)
        
        critical_issues = [i[1] for i in issues if i[0] == 'critical']
        error_issues = [i[1] for i in issues if i[0] == 'error']
        warning_issues = [i[1] for i in issues if i[0] == 'warning']
        
        if critical_issues:
            send_admin_alert.delay(
                'system_health_critical',
                f"Critical system health issues detected: {len(critical_issues)} issues",
                {
                    'critical_issues': critical_issues,
                    'error_issues': error_issues,
                    'warning_issues': warning_issues,
                    'timestamp': timezone.now().isoformat()
                }
            )
            self.stdout.write('🚨 Critical alert sent to administrators')
        
        if error_issues and not critical_issues:
            send_admin_alert.delay(
                'system_health_error',
                f"System health errors detected: {len(error_issues)} errors",
                {
                    'error_issues': error_issues,
                    'warning_issues': warning_issues,
                    'timestamp': timezone.now().isoformat()
                }
            )
            self.stdout.write('❌ Error alert sent to administrators')
        
        self.stdout.write('✅ Alert notifications queued')

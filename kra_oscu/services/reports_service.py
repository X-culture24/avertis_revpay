"""
KRA Compliance Reports Service
Generates Z-Reports, X-Reports, and compliance reports for KRA eTIMS
DigiTax-inspired reporting with real-time analytics
"""

from django.db.models import Sum, Count, Q
from django.utils import timezone
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Any, Optional
import logging

from ..models import Invoice, InvoiceItem, Device, Company

logger = logging.getLogger(__name__)


class ReportsService:
    """
    Service for generating KRA compliance reports
    Inspired by DigiTax's comprehensive reporting approach
    """
    
    @staticmethod
    def generate_z_report(device: Device, date: Optional[datetime] = None) -> Dict[str, Any]:
        """
        Generate Z-Report (End of Day Sales Report)
        Required by KRA for daily reconciliation
        """
        if not date:
            date = timezone.now().date()
        
        start_time = timezone.make_aware(datetime.combine(date, datetime.min.time()))
        end_time = timezone.make_aware(datetime.combine(date, datetime.max.time()))
        
        # Get all invoices for the day
        invoices = Invoice.objects.filter(
            device=device,
            transaction_date__range=[start_time, end_time]
        )
        
        # Calculate totals
        total_sales = invoices.filter(status='confirmed').aggregate(
            total_amount=Sum('total_amount'),
            tax_amount=Sum('tax_amount'),
            count=Count('id')
        )
        
        # Tax breakdown
        tax_breakdown = invoices.filter(status='confirmed').values('currency').annotate(
            total_amount=Sum('total_amount'),
            tax_amount=Sum('tax_amount'),
            count=Count('id')
        )
        
        # Payment method breakdown
        payment_breakdown = invoices.filter(status='confirmed').values('payment_type').annotate(
            total_amount=Sum('total_amount'),
            count=Count('id')
        )
        
        # Failed transactions
        failed_transactions = invoices.filter(status='failed').count()
        
        # Receipt number range
        confirmed_invoices = invoices.filter(status='confirmed').order_by('receipt_no')
        first_receipt = confirmed_invoices.first()
        last_receipt = confirmed_invoices.last()
        
        report = {
            'report_type': 'Z_REPORT',
            'device_serial': device.serial_number,
            'business_name': device.company.company_name,
            'tin': device.company.tin,
            'report_date': date.isoformat(),
            'generated_at': timezone.now().isoformat(),
            
            # Sales summary
            'sales_summary': {
                'total_transactions': total_sales['count'] or 0,
                'total_amount': float(total_sales['total_amount'] or 0),
                'total_tax': float(total_sales['tax_amount'] or 0),
                'net_amount': float((total_sales['total_amount'] or 0) - (total_sales['tax_amount'] or 0)),
            },
            
            # Receipt range
            'receipt_range': {
                'first_receipt': first_receipt.receipt_no if first_receipt else None,
                'last_receipt': last_receipt.receipt_no if last_receipt else None,
                'total_receipts': confirmed_invoices.count()
            },
            
            # Tax breakdown
            'tax_breakdown': list(tax_breakdown),
            
            # Payment methods
            'payment_breakdown': list(payment_breakdown),
            
            # System status
            'system_status': {
                'failed_transactions': failed_transactions,
                'device_status': device.status,
                'last_sync': device.last_sync.isoformat() if device.last_sync else None
            }
        }
        
        logger.info(f"Generated Z-Report for device {device.serial_number} on {date}")
        return report
    
    @staticmethod
    def generate_x_report(device: Device) -> Dict[str, Any]:
        """
        Generate X-Report (Current Day Sales Report - Non-resetting)
        Shows current day totals without resetting counters
        """
        today = timezone.now().date()
        return ReportsService.generate_z_report(device, today)
    
    @staticmethod
    def generate_monthly_compliance_report(company: Company, year: int, month: int) -> Dict[str, Any]:
        """
        Generate monthly compliance report for KRA submission
        DigiTax-inspired comprehensive reporting
        """
        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = datetime(year, month + 1, 1) - timedelta(days=1)
        
        start_time = timezone.make_aware(datetime.combine(start_date, datetime.min.time()))
        end_time = timezone.make_aware(datetime.combine(end_date, datetime.max.time()))
        
        # Get all invoices for the month
        invoices = Invoice.objects.filter(
            company=company,
            transaction_date__range=[start_time, end_time]
        )
        
        # Overall statistics
        stats = invoices.aggregate(
            total_invoices=Count('id'),
            confirmed_invoices=Count('id', filter=Q(status='confirmed')),
            failed_invoices=Count('id', filter=Q(status='failed')),
            total_revenue=Sum('total_amount', filter=Q(status='confirmed')),
            total_tax=Sum('tax_amount', filter=Q(status='confirmed'))
        )
        
        # Daily breakdown
        daily_stats = []
        current_date = start_date
        while current_date <= end_date.date():
            day_start = timezone.make_aware(datetime.combine(current_date, datetime.min.time()))
            day_end = timezone.make_aware(datetime.combine(current_date, datetime.max.time()))
            
            day_invoices = invoices.filter(transaction_date__range=[day_start, day_end])
            day_totals = day_invoices.aggregate(
                count=Count('id', filter=Q(status='confirmed')),
                revenue=Sum('total_amount', filter=Q(status='confirmed')),
                tax=Sum('tax_amount', filter=Q(status='confirmed'))
            )
            
            daily_stats.append({
                'date': current_date.isoformat(),
                'transactions': day_totals['count'] or 0,
                'revenue': float(day_totals['revenue'] or 0),
                'tax': float(day_totals['tax'] or 0)
            })
            
            current_date += timedelta(days=1)
        
        # Device performance
        device_stats = []
        for device in company.devices.filter(status='active'):
            device_invoices = invoices.filter(device=device)
            device_totals = device_invoices.aggregate(
                count=Count('id', filter=Q(status='confirmed')),
                revenue=Sum('total_amount', filter=Q(status='confirmed')),
                failed=Count('id', filter=Q(status='failed'))
            )
            
            device_stats.append({
                'device_serial': device.serial_number,
                'device_type': device.device_type,
                'transactions': device_totals['count'] or 0,
                'revenue': float(device_totals['revenue'] or 0),
                'failed_transactions': device_totals['failed'] or 0,
                'success_rate': (
                    (device_totals['count'] or 0) / 
                    max(device_invoices.count(), 1) * 100
                )
            })
        
        report = {
            'report_type': 'MONTHLY_COMPLIANCE',
            'company_name': company.company_name,
            'tin': company.tin,
            'period': f"{year}-{month:02d}",
            'generated_at': timezone.now().isoformat(),
            
            # Summary statistics
            'summary': {
                'total_invoices': stats['total_invoices'] or 0,
                'confirmed_invoices': stats['confirmed_invoices'] or 0,
                'failed_invoices': stats['failed_invoices'] or 0,
                'success_rate': (
                    (stats['confirmed_invoices'] or 0) / 
                    max(stats['total_invoices'] or 1, 1) * 100
                ),
                'total_revenue': float(stats['total_revenue'] or 0),
                'total_tax': float(stats['total_tax'] or 0),
                'net_revenue': float((stats['total_revenue'] or 0) - (stats['total_tax'] or 0))
            },
            
            # Daily breakdown
            'daily_breakdown': daily_stats,
            
            # Device performance
            'device_performance': device_stats,
            
            # Compliance indicators
            'compliance_status': {
                'devices_active': company.devices.filter(status='active').count(),
                'devices_total': company.devices.count(),
                'last_sync_issues': company.devices.filter(
                    last_sync__lt=timezone.now() - timedelta(hours=25)
                ).count()
            }
        }
        
        logger.info(f"Generated monthly compliance report for {company.company_name} - {year}-{month:02d}")
        return report
    
    @staticmethod
    def generate_real_time_dashboard(company: Company) -> Dict[str, Any]:
        """
        Generate real-time dashboard data
        DigiTax-inspired live analytics
        """
        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Today's statistics
        today_invoices = Invoice.objects.filter(
            company=company,
            transaction_date__gte=today_start
        )
        
        today_stats = today_invoices.aggregate(
            total_count=Count('id'),
            confirmed_count=Count('id', filter=Q(status='confirmed')),
            pending_count=Count('id', filter=Q(status='pending')),
            failed_count=Count('id', filter=Q(status='failed')),
            total_revenue=Sum('total_amount', filter=Q(status='confirmed')),
            total_tax=Sum('tax_amount', filter=Q(status='confirmed'))
        )
        
        # Recent activity (last 24 hours)
        recent_invoices = Invoice.objects.filter(
            company=company,
            created_at__gte=now - timedelta(hours=24)
        ).order_by('-created_at')[:10]
        
        # Device status
        devices = company.devices.all()
        device_status = {
            'active': devices.filter(status='active').count(),
            'inactive': devices.filter(status='inactive').count(),
            'offline': devices.filter(
                last_sync__lt=now - timedelta(hours=24)
            ).count()
        }
        
        return {
            'timestamp': now.isoformat(),
            'today_stats': {
                'total_invoices': today_stats['total_count'] or 0,
                'confirmed_invoices': today_stats['confirmed_count'] or 0,
                'pending_invoices': today_stats['pending_count'] or 0,
                'failed_invoices': today_stats['failed_count'] or 0,
                'total_revenue': float(today_stats['total_revenue'] or 0),
                'total_tax': float(today_stats['total_tax'] or 0),
                'success_rate': (
                    (today_stats['confirmed_count'] or 0) / 
                    max(today_stats['total_count'] or 1, 1) * 100
                )
            },
            'recent_activity': [
                {
                    'invoice_no': inv.invoice_no,
                    'customer_name': inv.customer_name or 'Walk-in Customer',
                    'total_amount': float(inv.total_amount),
                    'status': inv.status,
                    'created_at': inv.created_at.isoformat(),
                    'etr_number': inv.receipt_no
                }
                for inv in recent_invoices
            ],
            'device_status': device_status,
            'kra_integration': {
                'environment': getattr(settings, 'DIGITAX_ENVIRONMENT', 'sandbox'),
                'real_time_enabled': True,
                'last_code_sync': company.devices.aggregate(
                    last_sync=timezone.Max('last_sync')
                )['last_sync']
            }
        }

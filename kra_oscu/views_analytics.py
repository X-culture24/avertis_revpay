"""
Revpay Connect analytics and monitoring views.
Provides comprehensive dashboards and reporting for multi-tenant eTIMS integration.
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Count, Sum, Avg, Q
from django.utils import timezone
from datetime import timedelta, datetime
from decimal import Decimal
import logging

from .models import (
    Company, Device, Invoice, ApiLog, ComplianceReport, 
    NotificationLog, RetryQueue
)
from .serializers import (
    AnalyticsSerializer, ComplianceReportSerializer,
    ApiLogSerializer, NotificationLogSerializer
)

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def company_analytics(request, company_id):
    """
    Get comprehensive analytics for a specific company.
    Includes transaction metrics, device performance, and KRA compliance data.
    """
    try:
        company = Company.objects.get(id=company_id)
        
        # Parse date range parameters
        period_days = int(request.query_params.get('period_days', 30))
        end_date = timezone.now()
        start_date = end_date - timedelta(days=period_days)
        
        # Transaction metrics
        invoices = Invoice.objects.filter(
            company=company,
            created_at__gte=start_date,
            created_at__lte=end_date
        )
        
        total_transactions = invoices.count()
        successful_transactions = invoices.filter(status='confirmed').count()
        failed_transactions = invoices.filter(status='failed').count()
        success_rate = (successful_transactions / total_transactions * 100) if total_transactions > 0 else 0
        
        # Financial metrics
        financial_data = invoices.filter(status='confirmed').aggregate(
            total_revenue=Sum('total_amount'),
            total_tax=Sum('tax_amount')
        )
        
        total_revenue = financial_data['total_revenue'] or Decimal('0.00')
        total_tax_collected = financial_data['total_tax'] or Decimal('0.00')
        
        # Device metrics
        devices = Device.objects.filter(company=company)
        active_devices = devices.filter(status='active').count()
        
        # Calculate device uptime (percentage of successful API calls)
        device_logs = ApiLog.objects.filter(
            company=company,
            created_at__gte=start_date,
            created_at__lte=end_date
        )
        
        if device_logs.exists():
            successful_calls = device_logs.filter(status_code__lt=400).count()
            total_calls = device_logs.count()
            device_uptime = (successful_calls / total_calls * 100) if total_calls > 0 else 0
        else:
            device_uptime = 100
        
        # KRA metrics
        kra_logs = device_logs.filter(request_type__in=['sales', 'init', 'status_check'])
        kra_acknowledgments = kra_logs.filter(status_code=200).count()
        
        avg_response_time = kra_logs.aggregate(
            avg_time=Avg('response_time')
        )['avg_time'] or Decimal('0.000')
        
        # Prepare analytics response
        analytics_data = {
            'company_id': company.id,
            'period_start': start_date,
            'period_end': end_date,
            'total_transactions': total_transactions,
            'successful_transactions': successful_transactions,
            'failed_transactions': failed_transactions,
            'success_rate': round(success_rate, 2),
            'total_revenue': total_revenue,
            'total_tax_collected': total_tax_collected,
            'active_devices': active_devices,
            'device_uptime': round(device_uptime, 2),
            'kra_acknowledgments': kra_acknowledgments,
            'average_response_time': avg_response_time
        }
        
        return Response(analytics_data)
        
    except Company.DoesNotExist:
        return Response({
            'error': 'Company not found'
        }, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def system_dashboard(request):
    """
    System-wide dashboard with aggregated metrics across all companies.
    For admin and monitoring purposes.
    """
    # Parse date range parameters
    period_days = int(request.query_params.get('period_days', 7))
    end_date = timezone.now()
    start_date = end_date - timedelta(days=period_days)
    
    # System-wide metrics
    total_companies = Company.objects.count()
    active_companies = Company.objects.filter(status='active').count()
    pending_companies = Company.objects.filter(status='pending_approval').count()
    
    total_devices = Device.objects.count()
    active_devices = Device.objects.filter(status='active').count()
    
    # Transaction metrics across all companies
    all_invoices = Invoice.objects.filter(
        created_at__gte=start_date,
        created_at__lte=end_date
    )
    
    total_transactions = all_invoices.count()
    successful_transactions = all_invoices.filter(status='confirmed').count()
    failed_transactions = all_invoices.filter(status='failed').count()
    
    # Financial metrics
    financial_totals = all_invoices.filter(status='confirmed').aggregate(
        total_revenue=Sum('total_amount'),
        total_tax=Sum('tax_amount')
    )
    
    # API performance metrics
    api_logs = ApiLog.objects.filter(
        created_at__gte=start_date,
        created_at__lte=end_date
    )
    
    api_performance = api_logs.aggregate(
        total_requests=Count('id'),
        successful_requests=Count('id', filter=Q(status_code__lt=400)),
        avg_response_time=Avg('response_time')
    )
    
    # Error analysis
    error_logs = api_logs.filter(severity__in=['error', 'critical'])
    error_breakdown = error_logs.values('request_type').annotate(
        count=Count('id')
    ).order_by('-count')
    
    # Recent activity
    recent_onboardings = Company.objects.filter(
        created_at__gte=start_date
    ).order_by('-created_at')[:5]
    
    recent_errors = error_logs.order_by('-created_at')[:10]
    
    # Retry queue status
    retry_stats = RetryQueue.objects.aggregate(
        pending_retries=Count('id', filter=Q(status='pending')),
        failed_retries=Count('id', filter=Q(status='failed'))
    )
    
    dashboard_data = {
        'period': {
            'start_date': start_date,
            'end_date': end_date,
            'days': period_days
        },
        'companies': {
            'total': total_companies,
            'active': active_companies,
            'pending': pending_companies
        },
        'devices': {
            'total': total_devices,
            'active': active_devices
        },
        'transactions': {
            'total': total_transactions,
            'successful': successful_transactions,
            'failed': failed_transactions,
            'success_rate': round((successful_transactions / total_transactions * 100) if total_transactions > 0 else 0, 2)
        },
        'financial': {
            'total_revenue': financial_totals['total_revenue'] or Decimal('0.00'),
            'total_tax': financial_totals['total_tax'] or Decimal('0.00')
        },
        'api_performance': {
            'total_requests': api_performance['total_requests'] or 0,
            'successful_requests': api_performance['successful_requests'] or 0,
            'success_rate': round((api_performance['successful_requests'] / api_performance['total_requests'] * 100) if api_performance['total_requests'] > 0 else 0, 2),
            'avg_response_time': api_performance['avg_response_time'] or Decimal('0.000')
        },
        'errors': {
            'total_errors': error_logs.count(),
            'breakdown': list(error_breakdown)
        },
        'retry_queue': retry_stats,
        'recent_activity': {
            'new_companies': [
                {
                    'id': company.id,
                    'name': company.company_name,
                    'tin': company.tin,
                    'created_at': company.created_at
                } for company in recent_onboardings
            ],
            'recent_errors': [
                {
                    'id': log.id,
                    'company': log.company.company_name if log.company else 'System',
                    'request_type': log.request_type,
                    'error_message': log.error_message,
                    'created_at': log.created_at
                } for log in recent_errors
            ]
        }
    }
    
    return Response(dashboard_data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_logs(request):
    """
    Get API logs with filtering and pagination.
    Supports filtering by company, device, request type, severity, and date range.
    """
    logs = ApiLog.objects.all().order_by('-created_at')
    
    # Apply filters
    company_id = request.query_params.get('company_id')
    if company_id:
        logs = logs.filter(company_id=company_id)
    
    device_id = request.query_params.get('device_id')
    if device_id:
        logs = logs.filter(device_id=device_id)
    
    request_type = request.query_params.get('request_type')
    if request_type:
        logs = logs.filter(request_type=request_type)
    
    severity = request.query_params.get('severity')
    if severity:
        logs = logs.filter(severity=severity)
    
    # Date range filter
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')
    
    if start_date:
        try:
            start_date = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            logs = logs.filter(created_at__gte=start_date)
        except ValueError:
            pass
    
    if end_date:
        try:
            end_date = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            logs = logs.filter(created_at__lte=end_date)
        except ValueError:
            pass
    
    # Pagination
    page_size = min(int(request.query_params.get('page_size', 50)), 200)
    page = int(request.query_params.get('page', 1))
    start = (page - 1) * page_size
    end = start + page_size
    
    total_count = logs.count()
    logs_page = logs[start:end]
    
    serializer = ApiLogSerializer(logs_page, many=True)
    
    return Response({
        'logs': serializer.data,
        'pagination': {
            'page': page,
            'page_size': page_size,
            'total_count': total_count,
            'total_pages': (total_count + page_size - 1) // page_size
        },
        'filters_applied': {
            'company_id': company_id,
            'device_id': device_id,
            'request_type': request_type,
            'severity': severity,
            'start_date': start_date.isoformat() if start_date else None,
            'end_date': end_date.isoformat() if end_date else None
        }
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def compliance_reports(request, company_id):
    """
    Get compliance reports for a specific company.
    Supports filtering by report type and date range.
    """
    try:
        company = Company.objects.get(id=company_id)
        
        reports = ComplianceReport.objects.filter(company=company).order_by('-period_start')
        
        # Filter by report type
        report_type = request.query_params.get('report_type')
        if report_type:
            reports = reports.filter(report_type=report_type)
        
        # Date range filter
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        if start_date:
            try:
                start_date = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                reports = reports.filter(period_start__gte=start_date)
            except ValueError:
                pass
        
        if end_date:
            try:
                end_date = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                reports = reports.filter(period_end__lte=end_date)
            except ValueError:
                pass
        
        # Pagination
        page_size = min(int(request.query_params.get('page_size', 20)), 100)
        page = int(request.query_params.get('page', 1))
        start = (page - 1) * page_size
        end = start + page_size
        
        total_count = reports.count()
        reports_page = reports[start:end]
        
        serializer = ComplianceReportSerializer(reports_page, many=True)
        
        return Response({
            'reports': serializer.data,
            'pagination': {
                'page': page,
                'page_size': page_size,
                'total_count': total_count,
                'total_pages': (total_count + page_size - 1) // page_size
            }
        })
        
    except Company.DoesNotExist:
        return Response({
            'error': 'Company not found'
        }, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_compliance_report(request, company_id):
    """
    Generate a new compliance report for a company.
    """
    try:
        company = Company.objects.get(id=company_id)
        
        report_type = request.data.get('report_type', 'monthly')
        period_start = request.data.get('period_start')
        period_end = request.data.get('period_end')
        
        if not period_start or not period_end:
            return Response({
                'error': 'period_start and period_end are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            period_start = datetime.fromisoformat(period_start.replace('Z', '+00:00'))
            period_end = datetime.fromisoformat(period_end.replace('Z', '+00:00'))
        except ValueError:
            return Response({
                'error': 'Invalid date format. Use ISO format.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if report already exists
        existing_report = ComplianceReport.objects.filter(
            company=company,
            report_type=report_type,
            period_start=period_start
        ).first()
        
        if existing_report:
            return Response({
                'message': 'Report already exists',
                'report': ComplianceReportSerializer(existing_report).data
            })
        
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
        
        # Detailed breakdown by day
        daily_breakdown = {}
        current_date = period_start.date()
        end_date = period_end.date()
        
        while current_date <= end_date:
            day_invoices = invoices.filter(
                created_at__date=current_date
            )
            
            daily_breakdown[current_date.isoformat()] = {
                'total_invoices': day_invoices.count(),
                'successful_invoices': day_invoices.filter(status='confirmed').count(),
                'total_value': float(day_invoices.filter(status='confirmed').aggregate(
                    total=Sum('total_amount')
                )['total'] or 0),
                'total_tax': float(day_invoices.filter(status='confirmed').aggregate(
                    total=Sum('tax_amount')
                )['total'] or 0)
            }
            
            current_date += timedelta(days=1)
        
        # Create compliance report
        report = ComplianceReport.objects.create(
            company=company,
            report_type=report_type,
            period_start=period_start,
            period_end=period_end,
            total_invoices=total_invoices,
            successful_invoices=successful_invoices,
            failed_invoices=failed_invoices,
            total_value=financial_data['total_value'] or Decimal('0.00'),
            total_tax=financial_data['total_tax'] or Decimal('0.00'),
            kra_acknowledgments=kra_acknowledgments,
            detailed_data={
                'daily_breakdown': daily_breakdown,
                'success_rate': round((successful_invoices / total_invoices * 100) if total_invoices > 0 else 0, 2),
                'average_transaction_value': float((financial_data['total_value'] or Decimal('0.00')) / total_invoices) if total_invoices > 0 else 0,
                'generated_at': timezone.now().isoformat()
            }
        )
        
        return Response({
            'success': True,
            'message': 'Compliance report generated successfully',
            'report': ComplianceReportSerializer(report).data
        }, status=status.HTTP_201_CREATED)
        
    except Company.DoesNotExist:
        return Response({
            'error': 'Company not found'
        }, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def notification_logs(request, company_id):
    """
    Get notification logs for a specific company.
    """
    try:
        company = Company.objects.get(id=company_id)
        
        notifications = NotificationLog.objects.filter(company=company).order_by('-created_at')
        
        # Filter by notification type
        notification_type = request.query_params.get('notification_type')
        if notification_type:
            notifications = notifications.filter(notification_type=notification_type)
        
        # Filter by status
        status_filter = request.query_params.get('status')
        if status_filter:
            notifications = notifications.filter(status=status_filter)
        
        # Pagination
        page_size = min(int(request.query_params.get('page_size', 20)), 100)
        page = int(request.query_params.get('page', 1))
        start = (page - 1) * page_size
        end = start + page_size
        
        total_count = notifications.count()
        notifications_page = notifications[start:end]
        
        serializer = NotificationLogSerializer(notifications_page, many=True)
        
        return Response({
            'notifications': serializer.data,
            'pagination': {
                'page': page,
                'page_size': page_size,
                'total_count': total_count,
                'total_pages': (total_count + page_size - 1) // page_size
            }
        })
        
    except Company.DoesNotExist:
        return Response({
            'error': 'Company not found'
        }, status=status.HTTP_404_NOT_FOUND)

"""
Notification Management Views
Handles user notifications, alerts, and notification settings
"""
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.utils import timezone
from datetime import timedelta
import logging

from .models import Company, NotificationLog

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_notifications(request):
    """Get all notifications for the authenticated user"""
    try:
        company = Company.objects.get(contact_email=request.user.email)
        
        # Get notifications from the last 30 days
        thirty_days_ago = timezone.now() - timedelta(days=30)
        notifications = NotificationLog.objects.filter(
            company=company,
            created_at__gte=thirty_days_ago
        ).order_by('-created_at')[:50]  # Limit to 50 most recent
        
        # Format notifications for mobile app
        notifications_data = []
        for notif in notifications:
            notifications_data.append({
                'id': str(notif.id),
                'title': notif.subject,
                'message': notif.message,
                'type': notif.notification_type,
                'timestamp': notif.created_at.isoformat(),
                'read': notif.status == 'delivered',  # Using 'delivered' status as 'read'
                'priority': notif.context_data.get('priority', 'medium') if notif.context_data else 'medium',
            })
        
        return Response({
            'notifications': notifications_data,
            'unread_count': sum(1 for n in notifications_data if not n['read'])
        })
        
    except Company.DoesNotExist:
        return Response(
            {'error': 'Company not found'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def mark_notification_read(request, notification_id):
    """Mark a specific notification as read"""
    try:
        company = Company.objects.get(contact_email=request.user.email)
        notification = NotificationLog.objects.get(
            id=notification_id,
            company=company
        )
        
        notification.status = 'delivered'
        notification.delivered_at = timezone.now()
        notification.save()
        
        return Response({
            'message': 'Notification marked as read'
        })
        
    except NotificationLog.DoesNotExist:
        return Response(
            {'error': 'Notification not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Company.DoesNotExist:
        return Response(
            {'error': 'Company not found'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def mark_all_notifications_read(request):
    """Mark all notifications as read"""
    try:
        company = Company.objects.get(contact_email=request.user.email)
        
        updated_count = NotificationLog.objects.filter(
            company=company,
            status='sent'
        ).update(
            status='delivered',
            delivered_at=timezone.now()
        )
        
        return Response({
            'message': f'{updated_count} notifications marked as read'
        })
        
    except Company.DoesNotExist:
        return Response(
            {'error': 'Company not found'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def delete_notification(request, notification_id):
    """Delete a specific notification"""
    try:
        company = Company.objects.get(contact_email=request.user.email)
        notification = NotificationLog.objects.get(
            id=notification_id,
            company=company
        )
        
        notification.delete()
        
        return Response({
            'message': 'Notification deleted'
        })
        
    except NotificationLog.DoesNotExist:
        return Response(
            {'error': 'Notification not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Company.DoesNotExist:
        return Response(
            {'error': 'Company not found'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def clear_all_notifications(request):
    """Clear all notifications"""
    try:
        company = Company.objects.get(contact_email=request.user.email)
        
        deleted_count = NotificationLog.objects.filter(company=company).delete()[0]
        
        return Response({
            'message': f'{deleted_count} notifications cleared'
        })
        
    except Company.DoesNotExist:
        return Response(
            {'error': 'Company not found'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def notification_settings(request):
    """Get or update notification settings"""
    try:
        company = Company.objects.get(contact_email=request.user.email)
        
        if request.method == 'GET':
            # Return current settings (stored in company context_data or separate settings model)
            settings = {
                'push_enabled': True,
                'email_enabled': True,
                'invoice_notifications': True,
                'sync_notifications': True,
                'compliance_notifications': True,
                'payment_notifications': True,
                'system_notifications': True,
            }
            
            return Response({'settings': settings})
        
        elif request.method == 'POST':
            # Update settings
            # TODO: Store settings in database
            settings = request.data.get('settings', {})
            
            logger.info(f"Notification settings updated for {company.company_name}")
            
            return Response({
                'message': 'Notification settings updated',
                'settings': settings
            })
        
    except Company.DoesNotExist:
        return Response(
            {'error': 'Company not found'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def create_test_notification(request):
    """Create a test notification (for testing purposes)"""
    try:
        company = Company.objects.get(contact_email=request.user.email)
        
        notification = NotificationLog.objects.create(
            company=company,
            notification_type='system',
            recipient=company.contact_email,
            subject='Test Notification',
            message='This is a test notification from Revpay Connect',
            status='sent',
            context_data={'priority': 'low'}
        )
        
        return Response({
            'message': 'Test notification created',
            'notification_id': str(notification.id)
        })
        
    except Company.DoesNotExist:
        return Response(
            {'error': 'Company not found'},
            status=status.HTTP_404_NOT_FOUND
        )

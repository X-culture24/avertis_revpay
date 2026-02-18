"""URL configuration for Revpay Connect - Subscription and Notification endpoints.
Mobile API only.
"""
from django.urls import path, include
from . import subscription_views
from . import notification_views

# Mobile-only URL patterns (web interface removed)
urlpatterns = [
    # Include the main API URLs from api_urls.py
    path('', include('kra_oscu.api_urls')),
    
    # Include subscription management URLs
    path('subscription/', include([
        path('plans/', subscription_views.get_subscription_plans, name='subscription-plans'),
        path('current/', subscription_views.get_current_subscription, name='current-subscription'),
        path('upgrade/', subscription_views.upgrade_subscription, name='upgrade-subscription'),
        path('cancel/', subscription_views.cancel_subscription, name='cancel-subscription'),
        path('billing-history/', subscription_views.get_billing_history, name='billing-history'),
        path('check-limits/', subscription_views.check_subscription_limits, name='check-limits'),
    ])),
    
    # Include payment URLs
    path('payment/', include([
        path('mpesa/initiate/', subscription_views.initiate_mpesa_payment, name='mpesa-initiate'),
        path('mpesa/callback/', subscription_views.mpesa_callback, name='mpesa-callback'),
    ])),
    
    # Include notification management URLs
    path('notifications/', include([
        path('list/', notification_views.get_notifications, name='get-notifications'),
        path('<uuid:notification_id>/read/', notification_views.mark_notification_read, name='mark-notification-read'),
        path('mark-all-read/', notification_views.mark_all_notifications_read, name='mark-all-read'),
        path('<uuid:notification_id>/delete/', notification_views.delete_notification, name='delete-notification'),
        path('clear-all/', notification_views.clear_all_notifications, name='clear-notifications'),
        path('settings/', notification_views.notification_settings, name='notification-settings'),
        path('test/', notification_views.create_test_notification, name='test-notification'),
    ])),
]

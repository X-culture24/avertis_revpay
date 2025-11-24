"""
URL configuration for Revpay Connect eTIMS OSCU integration.
Includes multi-tenant endpoints, onboarding, analytics, integration APIs, and web interface.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from . import views_onboarding
from . import views_analytics
from . import views_integration
from . import views_environment
from . import api_views
from . import mobile_api_views

# Web interface URL patterns
web_urlpatterns = [
    # Authentication
    path('', views.home_view, name='home'),
    path('dashboard/', views.dashboard_view, name='dashboard'),
    path('login/', views.login_view, name='login'),
    path('register/', views.register_view, name='register'),
    path('logout/', views.logout_view, name='logout'),
    
    # Main pages
    path('invoices/', views.invoices_view, name='invoices'),
    path('invoices/create/', views.create_invoice_view, name='create_invoice'),
    path('invoices/<int:invoice_id>/', views.invoice_detail_view, name='invoice_detail'),
    path('devices/', views.devices_view, name='devices'),
    path('devices/sync/', views.sync_devices_view, name='sync_devices'),
    path('devices/<uuid:device_id>/sync/', views.sync_devices_view, name='sync_single_device'),
    path('reports/', views.reports_view, name='reports'),
    path('settings/', views.settings_view, name='settings'),
    
    # Actions
    path('invoices/<int:invoice_id>/resync/', views.resync_invoice_view, name='resync_invoice'),
    path('vscu/sync/', views.trigger_vscu_sync_view, name='trigger_vscu_sync'),
    path('invoices/retry-all/', views.retry_all_failed_view, name='retry_all_failed'),
]

# Mobile/Unified API URL patterns
mobile_api_urlpatterns = [
    # Authentication
    path('auth/login/', mobile_api_views.mobile_login, name='mobile-login'),
    
    # Dashboard
    path('dashboard/stats/', mobile_api_views.mobile_dashboard_stats, name='mobile-dashboard-stats'),
    
    # Invoices - Handle both GET and POST on same endpoint
    path('invoices/', mobile_api_views.mobile_invoices_handler, name='mobile-invoices'),
    path('invoices/<uuid:invoice_id>/', mobile_api_views.mobile_invoice_details, name='mobile-invoice-details'),
    path('invoices/<uuid:invoice_id>/resync/', mobile_api_views.mobile_resync_invoice, name='mobile-resync-invoice'),
    
    # Receipt
    path('receipts/<uuid:invoice_id>/', mobile_api_views.mobile_receipt_data, name='mobile-receipt-data'),
    
    # Notifications
    path('notifications/', mobile_api_views.mobile_notifications, name='mobile-notifications'),
    
    # DigiTax callback
    path('callback/digitax/', mobile_api_views.digitax_callback, name='digitax-callback'),
    
    # KRA Compliance endpoints
    path('codes/', api_views.get_kra_codes, name='kra-codes'),
    path('reports/z-report/', api_views.generate_z_report, name='z-report'),
    path('analytics/realtime/', api_views.get_real_time_analytics, name='realtime-analytics'),
]

# API URL patterns
api_urlpatterns = [
    # Core eTIMS endpoints (legacy compatibility)
    path('device/init/', views.DeviceInitView.as_view(), name='device-init'),
    path('device/<uuid:device_id>/status/', views.DeviceStatusView.as_view(), name='device-status'),
    path('device/<str:device_serial>/generate-keys/', views.GenerateDeviceKeysView.as_view(), name='generate-device-keys'),
    path('device/test-connection/', views.test_connection, name='test-connection'),
    path('sales/', views.SalesTransactionView.as_view(), name='sales-transaction'),
    path('invoices/', views.InvoiceListView.as_view(), name='invoice-list'),
    path('item/sync/', views.ItemSyncView.as_view(), name='item-sync'),
    path('logs/', views.ApiLogListView.as_view(), name='api-logs'),
    path('health/', views.health_check, name='health-check'),
    
    # Client onboarding and management
    path('onboard/', views_onboarding.onboard_client, name='client-onboard'),
    path('companies/', views_onboarding.list_companies, name='list-companies'),
    path('companies/<uuid:company_id>/', views_onboarding.company_detail, name='company-detail'),
    path('companies/<uuid:company_id>/status/', views_onboarding.update_company_status, name='update-company-status'),
    path('companies/<uuid:company_id>/devices/', views_onboarding.register_additional_device, name='register-device'),
    
    # Analytics and monitoring
    path('analytics/<uuid:company_id>/', views_analytics.company_analytics, name='company-analytics'),
    path('dashboard/', views_analytics.system_dashboard, name='system-dashboard'),
    path('logs/enhanced/', views_analytics.api_logs, name='enhanced-api-logs'),
    path('compliance/<uuid:company_id>/reports/', views_analytics.compliance_reports, name='compliance-reports'),
    path('compliance/<uuid:company_id>/generate/', views_analytics.generate_compliance_report, name='generate-compliance-report'),
    path('notifications/<uuid:company_id>/', views_analytics.notification_logs, name='notification-logs'),
    
    # Integration layer for POS/ERP systems
    path('integration/sales/', views_integration.process_sales_transaction, name='integration-sales'),
    path('integration/transaction/<uuid:invoice_id>/', views_integration.get_transaction_status, name='integration-transaction-status'),
    path('integration/items/sync/', views_integration.sync_item_catalog, name='integration-item-sync'),
    path('integration/companies/<uuid:company_id>/devices/', views_integration.get_company_devices, name='integration-company-devices'),
    path('integration/companies/<uuid:company_id>/items/', views_integration.get_item_catalog, name='integration-item-catalog'),
    path('integration/webhook/<uuid:company_id>/', views_integration.webhook_endpoint, name='integration-webhook'),
    
    # Environment management
    path('environment/<uuid:company_id>/status/', views_environment.get_environment_status, name='environment-status'),
    path('environment/<uuid:company_id>/switch/', views_environment.switch_environment, name='environment-switch'),
    path('environment/kra-endpoints/', views_environment.get_kra_endpoints, name='kra-endpoints'),
    path('environment/<uuid:company_id>/test-connectivity/', views_environment.test_kra_connectivity, name='test-connectivity'),
]

# Mobile-only URL patterns (web interface removed)
urlpatterns = [
    # Include the main API URLs from api_urls.py
    path('', include('kra_oscu.api_urls')),
]

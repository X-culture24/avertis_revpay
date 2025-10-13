"""
URL configuration for Revpay Connect eTIMS OSCU integration.
Includes multi-tenant endpoints, onboarding, analytics, and integration APIs.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from . import views_onboarding
from . import views_analytics
from . import views_integration
from . import views_environment

# API URL patterns
urlpatterns = [
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

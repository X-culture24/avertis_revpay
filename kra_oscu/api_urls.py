"""
URL configuration for mobile app API endpoints.
Provides REST API routes for React Native mobile app integration.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .api_views import (
    CustomTokenObtainPairView,
    register_user,
    register_business,
    logout_user,
    dashboard_stats,
    CompanyProfileView,
    DeviceListCreateView,
    DeviceDetailView,
    sync_device,
    activate_device,
    InvoiceListCreateView,
    InvoiceDetailView,
    resync_invoice,
    retry_all_failed,
    ItemMasterListCreateView,
    ComplianceReportListView,
    generate_report,
    trigger_vscu_sync,
    vscu_status,
    mobile_api_root,
    health_check,
    get_subscription_plans,
    get_current_subscription,
    check_subscription_limits,
    initiate_payment,
    confirm_payment,
    get_invoice_receipt,
    get_invoice_receipt_print,
    export_invoice_pdf,
)
from .mobile_api_views import export_invoices_excel

# API URL patterns for mobile app
urlpatterns = [
    # Root endpoint
    path('', mobile_api_root, name='mobile_api_root'),
    
    # Authentication endpoints
    path('auth/login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/register/', register_user, name='register'),
    path('auth/register-business/', register_business, name='register_business'),
    path('auth/logout/', logout_user, name='logout'),
    
    # Dashboard endpoints
    path('dashboard/stats/', dashboard_stats, name='dashboard_stats'),
    
    # Company profile endpoints
    path('company/profile/', CompanyProfileView.as_view(), name='company_profile'),
    
    # Device management endpoints
    path('devices/', DeviceListCreateView.as_view(), name='device_list_create'),
    path('devices/<uuid:pk>/', DeviceDetailView.as_view(), name='device_detail'),
    path('devices/<uuid:device_id>/sync/', sync_device, name='sync_device'),
    path('devices/activate/', activate_device, name='activate_device'),
    
    # Invoice management endpoints
    path('invoices/', InvoiceListCreateView.as_view(), name='invoice_list_create'),
    path('invoices/<uuid:pk>/', InvoiceDetailView.as_view(), name='invoice_detail'),
    path('invoices/<uuid:invoice_id>/resync/', resync_invoice, name='resync_invoice'),
    path('invoices/<uuid:invoice_id>/receipt/', get_invoice_receipt, name='invoice_receipt'),
    path('invoices/<uuid:invoice_id>/receipt/print/', get_invoice_receipt_print, name='invoice_receipt_print'),
    path('invoices/<uuid:invoice_id>/pdf/', export_invoice_pdf, name='export_invoice_pdf'),
    path('invoices/retry-all/', retry_all_failed, name='retry_all_failed'),
    path('invoices/export-excel/', export_invoices_excel, name='export_invoices_excel'),
    
    # Item master endpoints
    path('items/', ItemMasterListCreateView.as_view(), name='item_list_create'),
    
    # Compliance and reporting endpoints
    path('reports/', ComplianceReportListView.as_view(), name='compliance_reports'),
    path('reports/generate/', generate_report, name='generate_report'),
    
    # VSCU specific endpoints
    path('vscu/sync/', trigger_vscu_sync, name='trigger_vscu_sync'),
    path('vscu/status/', vscu_status, name='vscu_status'),
    
    # Subscription management endpoints
    path('subscription/plans/', get_subscription_plans, name='subscription_plans'),
    path('subscription/current/', get_current_subscription, name='current_subscription'),
    path('subscription/check-limits/', check_subscription_limits, name='check_subscription_limits'),
    path('subscription/payment/initiate/', initiate_payment, name='initiate_payment'),
    path('subscription/payment/confirm/', confirm_payment, name='confirm_payment'),
    
    # Health check endpoint
    path('health/', health_check, name='health_check'),
]

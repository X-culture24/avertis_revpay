"""
Django admin configuration for eTIMS OSCU models.
"""
from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils.safestring import mark_safe
from .models import Device, Invoice, InvoiceItem, ItemMaster, ApiLog, SystemCode, RetryQueue


@admin.register(Device)
class DeviceAdmin(admin.ModelAdmin):
    list_display = ['device_name', 'tin', 'bhf_id', 'serial_number', 'status', 'is_certified', 'last_sync']
    list_filter = ['status', 'is_certified', 'created_at']
    search_fields = ['device_name', 'tin', 'bhf_id', 'serial_number']
    readonly_fields = ['id', 'cmc_key', 'created_at', 'updated_at']
    
    fieldsets = (
        ('Device Information', {
            'fields': ('device_name', 'pos_version', 'serial_number')
        }),
        ('KRA Registration', {
            'fields': ('tin', 'bhf_id', 'status', 'is_certified', 'cmc_key')
        }),
        ('Timestamps', {
            'fields': ('last_sync', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )


class InvoiceItemInline(admin.TabularInline):
    model = InvoiceItem
    extra = 0
    readonly_fields = ['total_price', 'tax_amount']


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ['invoice_no', 'device', 'total_amount', 'status', 'transaction_date', 'receipt_no']
    list_filter = ['status', 'payment_type', 'transaction_date', 'device']
    search_fields = ['invoice_no', 'receipt_no', 'customer_name', 'customer_tin']
    readonly_fields = ['id', 'internal_data', 'receipt_signature', 'created_at', 'updated_at']
    inlines = [InvoiceItemInline]
    
    fieldsets = (
        ('Invoice Details', {
            'fields': ('invoice_no', 'receipt_no', 'device', 'transaction_date')
        }),
        ('Financial Information', {
            'fields': ('total_amount', 'tax_amount', 'currency', 'payment_type')
        }),
        ('Customer Information', {
            'fields': ('customer_tin', 'customer_name')
        }),
        ('KRA Response', {
            'fields': ('status', 'internal_data', 'receipt_signature', 'retry_count'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('device')


@admin.register(ItemMaster)
class ItemMasterAdmin(admin.ModelAdmin):
    list_display = ['item_code', 'item_name', 'tax_type', 'default_price', 'unit_of_measure', 'is_active']
    list_filter = ['tax_type', 'is_active', 'item_type']
    search_fields = ['item_code', 'item_name', 'description']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(ApiLog)
class ApiLogAdmin(admin.ModelAdmin):
    list_display = ['created_at', 'device', 'request_type', 'endpoint', 'status_code', 'response_time', 'is_retry']
    list_filter = ['request_type', 'status_code', 'is_retry', 'created_at']
    search_fields = ['endpoint', 'device__device_name', 'error_message']
    readonly_fields = ['id', 'created_at']
    
    fieldsets = (
        ('Request Information', {
            'fields': ('device', 'endpoint', 'request_type', 'is_retry')
        }),
        ('Response Information', {
            'fields': ('status_code', 'response_time', 'error_message')
        }),
        ('Payload Data', {
            'fields': ('request_payload', 'response_payload'),
            'classes': ('collapse',)
        }),
        ('Timestamp', {
            'fields': ('created_at',)
        })
    )

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('device')


@admin.register(SystemCode)
class SystemCodeAdmin(admin.ModelAdmin):
    list_display = ['code_type', 'code_value', 'description', 'is_active', 'last_updated']
    list_filter = ['code_type', 'is_active', 'last_updated']
    search_fields = ['code_value', 'description']
    readonly_fields = ['id', 'last_updated', 'created_at']


@admin.register(RetryQueue)
class RetryQueueAdmin(admin.ModelAdmin):
    list_display = ['invoice', 'task_type', 'status', 'attempt_count', 'next_retry']
    list_filter = ['task_type', 'status', 'created_at']
    search_fields = ['invoice__invoice_no', 'error_details']
    readonly_fields = ['id', 'created_at', 'updated_at']
    
    fieldsets = (
        ('Retry Information', {
            'fields': ('invoice', 'task_type', 'status', 'attempt_count', 'next_retry')
        }),
        ('Error Details', {
            'fields': ('error_details',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('invoice', 'invoice__device')


# Custom admin site configuration
admin.site.site_header = "eTIMS OSCU Integration Admin"
admin.site.site_title = "eTIMS Admin"
admin.site.index_title = "Welcome to eTIMS OSCU Integration Administration"

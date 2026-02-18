"""
Django REST Framework serializers for Revpay Connect eTIMS OSCU integration.
Multi-tenant architecture with enhanced onboarding and monitoring.
"""
from rest_framework import serializers
from decimal import Decimal
from django.core.validators import RegexValidator
from .models import (
    Company, Device, Invoice, InvoiceItem, ItemMaster, ApiLog, 
    SystemCode, RetryQueue, ComplianceReport, NotificationLog
)


class CompanySerializer(serializers.ModelSerializer):
    """Serializer for Company model"""
    
    class Meta:
        model = Company
        fields = [
            'id', 'company_name', 'tin', 'contact_person', 'contact_email',
            'contact_phone', 'business_address', 'business_type', 'status',
            'is_sandbox', 'onboarding_date', 'subscription_plan', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'onboarding_date', 'created_at', 'updated_at']

    def validate_tin(self, value):
        """Validate TIN format - allow alphanumeric for testing"""
        if len(value) != 11:
            raise serializers.ValidationError("TIN must be exactly 11 characters")
        # Allow alphanumeric TINs for testing (e.g., P1234567890)
        # In production, you might want to enforce digits only
        return value


class CompanyOnboardingSerializer(serializers.Serializer):
    """Serializer for client onboarding request"""
    company_name = serializers.CharField(max_length=200)
    tin = serializers.CharField(
        max_length=11,
        validators=[RegexValidator(r'^\d{11}$', 'TIN must be 11 digits')]
    )
    contact_person = serializers.CharField(max_length=100)
    contact_email = serializers.EmailField()
    contact_phone = serializers.CharField(max_length=20)
    business_address = serializers.CharField()
    business_type = serializers.CharField(max_length=100, required=False)
    subscription_plan = serializers.CharField(max_length=50, default='basic')
    
    # Device information for automatic registration
    device_name = serializers.CharField(max_length=100)
    bhf_id = serializers.CharField(
        max_length=3,
        validators=[RegexValidator(r'^\d{3}$', 'Branch ID must be 3 digits')]
    )
    serial_number = serializers.CharField(max_length=50)
    pos_version = serializers.CharField(max_length=20, default='1.0')
    
    def validate_tin(self, value):
        """Check if TIN is already registered"""
        if Company.objects.filter(tin=value).exists():
            raise serializers.ValidationError("Company with this TIN is already registered")
        return value
    
    def validate_serial_number(self, value):
        """Check if serial number is already used"""
        if Device.objects.filter(serial_number=value).exists():
            raise serializers.ValidationError("Device with this serial number already exists")
        return value


class DeviceSerializer(serializers.ModelSerializer):
    """Serializer for Device model"""
    company_name = serializers.CharField(source='company.company_name', read_only=True)
    
    class Meta:
        model = Device
        fields = [
            'id', 'company', 'company_name', 'tin', 'bhf_id', 'serial_number', 'device_name', 
            'pos_version', 'status', 'is_certified', 'last_sync',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'cmc_key', 'status', 'is_certified', 'last_sync', 'created_at', 'updated_at']

    def validate_tin(self, value):
        """Validate TIN format - accepts alphanumeric for testing"""
        import re
        if not re.match(r'^[A-Z0-9]{11}$', value):
            raise serializers.ValidationError("TIN must be exactly 11 alphanumeric characters")
        return value

    def validate_bhf_id(self, value):
        """Validate Branch ID format"""
        if not value.isdigit() or len(value) != 3:
            raise serializers.ValidationError("Branch ID must be exactly 3 digits")
        return value


class DeviceInitSerializer(serializers.Serializer):
    """Serializer for device initialization request"""
    company_id = serializers.UUIDField(help_text="Company UUID")
    tin = serializers.CharField(
        max_length=11,
        validators=[RegexValidator(r'^\d{11}$', 'TIN must be 11 digits')]
    )
    bhf_id = serializers.CharField(
        max_length=3,
        validators=[RegexValidator(r'^\d{3}$', 'Branch ID must be 3 digits')]
    )
    device_serial = serializers.CharField(max_length=50, source='serial_number')
    device_name = serializers.CharField(max_length=100)
    pos_version = serializers.CharField(max_length=20, required=False, default="1.0")
    
    def validate_company_id(self, value):
        """Validate company exists and is active"""
        try:
            company = Company.objects.get(id=value, status='active')
            return value
        except Company.DoesNotExist:
            raise serializers.ValidationError("Company not found or not active")
    
    def validate(self, data):
        """Cross-field validation"""
        # Validate TIN matches company
        try:
            company = Company.objects.get(id=data['company_id'])
            if data['tin'] != company.tin:
                raise serializers.ValidationError("TIN does not match company TIN")
        except Company.DoesNotExist:
            pass  # Already handled in company_id validation
        
        return data


class ItemMasterSerializer(serializers.ModelSerializer):
    """Serializer for ItemMaster model"""
    
    class Meta:
        model = ItemMaster
        fields = [
            'id', 'item_code', 'item_name', 'item_type', 'tax_type',
            'default_price', 'unit_of_measure', 'description', 'category',
            'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class InvoiceItemSerializer(serializers.ModelSerializer):
    """Serializer for InvoiceItem model"""
    
    class Meta:
        model = InvoiceItem
        fields = [
            'id', 'item_code', 'item_name', 'quantity', 'unit_price',
            'total_price', 'tax_type', 'tax_rate', 'tax_amount', 'unit_of_measure'
        ]
        read_only_fields = ['id', 'total_price', 'tax_amount']

    def validate_quantity(self, value):
        """Validate quantity is positive"""
        if value <= 0:
            raise serializers.ValidationError("Quantity must be greater than 0")
        return value

    def validate_unit_price(self, value):
        """Validate unit price is not negative"""
        if value < 0:
            raise serializers.ValidationError("Unit price cannot be negative")
        return value


class InvoiceSerializer(serializers.ModelSerializer):
    """Serializer for Invoice model"""
    items = InvoiceItemSerializer(many=True)
    device_serial_number = serializers.CharField(write_only=True, help_text="Device serial number")
    invoice_no = serializers.CharField(required=False, help_text="Auto-generated if not provided")
    
    class Meta:
        model = Invoice
        fields = [
            'id', 'invoice_no', 'receipt_no', 'device_serial_number', 'tin',
            'total_amount', 'tax_amount', 'currency', 'customer_tin', 'customer_name',
            'payment_type', 'receipt_type', 'transaction_type', 'is_copy', 
            'original_receipt_no', 'qr_code_data', 'receipt_signature', 'internal_data',
            'status', 'transaction_date', 'retry_count', 'items', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'receipt_no', 'internal_data', 'receipt_signature', 
            'qr_code_data', 'status', 'retry_count', 'created_at', 'updated_at'
        ]

    def validate_device_serial_number(self, value):
        """Validate device exists and is active"""
        try:
            device = Device.objects.get(serial_number=value, status='active')
            return value
        except Device.DoesNotExist:
            raise serializers.ValidationError("Device not found or not active")

    def validate_customer_tin(self, value):
        """Validate customer TIN format if provided"""
        if value and (not value.isdigit() or len(value) != 11):
            raise serializers.ValidationError("Customer TIN must be exactly 11 digits")
        return value

    def validate_total_amount(self, value):
        """Validate total amount is positive"""
        if value <= 0:
            raise serializers.ValidationError("Total amount must be greater than 0")
        return value

    def validate(self, data):
        """Cross-field validation"""
        from .services.compliance_service import ComplianceService
        
        items = data.get('items', [])
        if not items:
            raise serializers.ValidationError("Invoice must contain at least one item")
        
        # Validate transaction type vs amount
        transaction_type = data.get('transaction_type', 'sale')
        total_amount = float(data.get('total_amount', 0))
        is_valid, msg = ComplianceService.validate_transaction_type(transaction_type, total_amount)
        if not is_valid:
            raise serializers.ValidationError(msg)
        
        # Calculate totals from items
        calculated_total = sum(
            item['quantity'] * item['unit_price'] for item in items
        )
        calculated_tax = sum(
            (item['quantity'] * item['unit_price']) * (item.get('tax_rate', 0) / 100)
            for item in items
        )
        
        # Validate totals match
        if abs(float(data['total_amount']) - float(calculated_total + calculated_tax)) > 0.01:
            raise serializers.ValidationError(
                "Total amount does not match sum of items plus tax"
            )
        
        return data

    def create(self, validated_data):
        """Create invoice with items"""
        items_data = validated_data.pop('items')
        device_serial = validated_data.pop('device_serial_number')
        
        # Get device and company
        device = Device.objects.get(serial_number=device_serial, status='active')
        validated_data['device'] = device
        validated_data['company'] = device.company
        
        # Auto-generate invoice_no if not provided
        if 'invoice_no' not in validated_data or not validated_data['invoice_no']:
            validated_data['invoice_no'] = device.get_next_receipt_number()
        
        # Create invoice
        invoice = Invoice.objects.create(**validated_data)
        
        # Create items
        for item_data in items_data:
            InvoiceItem.objects.create(invoice=invoice, **item_data)
        
        return invoice


class SalesRequestSerializer(serializers.Serializer):
    """Serializer for sales transaction request"""
    device_serial_number = serializers.CharField(max_length=50)
    invoice_no = serializers.CharField(max_length=50)
    tin = serializers.CharField(
        max_length=11,
        validators=[RegexValidator(r'^\d{11}$', 'TIN must be 11 digits')]
    )
    customer_tin = serializers.CharField(
        max_length=11,
        required=False,
        allow_blank=True,
        validators=[RegexValidator(r'^\d{11}$', 'Customer TIN must be 11 digits')]
    )
    customer_name = serializers.CharField(max_length=200, required=False, allow_blank=True)
    payment_method = serializers.ChoiceField(
        choices=Invoice.PAYMENT_TYPE_CHOICES,
        default='CASH',
        source='payment_type'
    )
    transaction_date = serializers.DateTimeField()
    currency = serializers.CharField(max_length=3, default='KES')
    items = InvoiceItemSerializer(many=True)

    def validate_items(self, value):
        """Validate items list"""
        if not value:
            raise serializers.ValidationError("At least one item is required")
        return value

    def validate(self, data):
        """Validate totals and device"""
        # Check device exists and is active
        try:
            device = Device.objects.get(
                serial_number=data['device_serial_number'],
                status='active'
            )
        except Device.DoesNotExist:
            raise serializers.ValidationError("Device not found or not active")
        
        # Validate TIN matches device
        if data['tin'] != device.tin:
            raise serializers.ValidationError("TIN does not match device TIN")
        
        return data


class ApiLogSerializer(serializers.ModelSerializer):
    """Serializer for enhanced ApiLog model"""
    device_name = serializers.CharField(source='device.device_name', read_only=True)
    company_name = serializers.CharField(source='company.company_name', read_only=True)
    
    class Meta:
        model = ApiLog
        fields = [
            'id', 'company', 'company_name', 'device', 'device_name', 'endpoint', 'request_type',
            'status_code', 'response_time', 'error_message', 'is_retry', 'severity',
            'user_agent', 'ip_address', 'environment', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class SystemCodeSerializer(serializers.ModelSerializer):
    """Serializer for SystemCode model"""
    
    class Meta:
        model = SystemCode
        fields = [
            'id', 'code_type', 'code_value', 'description', 'is_active',
            'last_updated', 'created_at'
        ]
        read_only_fields = ['id', 'last_updated', 'created_at']


class RetryQueueSerializer(serializers.ModelSerializer):
    """Serializer for RetryQueue model"""
    invoice_no = serializers.CharField(source='invoice.invoice_no', read_only=True)
    
    class Meta:
        model = RetryQueue
        fields = [
            'id', 'invoice', 'invoice_no', 'task_type', 'attempt_count',
            'next_retry', 'error_details', 'status', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class DeviceStatusSerializer(serializers.Serializer):
    """Serializer for device status response"""
    device_id = serializers.UUIDField()
    status = serializers.CharField()
    last_sync = serializers.DateTimeField(allow_null=True)
    is_active = serializers.BooleanField()
    kra_status = serializers.CharField()
    message = serializers.CharField()


class SalesResponseSerializer(serializers.Serializer):
    """Serializer for sales transaction response"""
    success = serializers.BooleanField()
    invoice_id = serializers.UUIDField()
    receipt_no = serializers.CharField(allow_null=True)
    status = serializers.CharField()
    message = serializers.CharField()
    internal_data = serializers.CharField(allow_null=True)
    receipt_signature = serializers.CharField(allow_null=True)
    retry_queued = serializers.BooleanField(default=False)


class HealthCheckSerializer(serializers.Serializer):
    """Serializer for health check response"""
    status = serializers.CharField()
    database = serializers.CharField()
    kra_service = serializers.CharField()
    timestamp = serializers.DateTimeField()
    version = serializers.CharField()


class ComplianceReportSerializer(serializers.ModelSerializer):
    """Serializer for ComplianceReport model"""
    company_name = serializers.CharField(source='company.company_name', read_only=True)
    
    class Meta:
        model = ComplianceReport
        fields = [
            'id', 'company', 'company_name', 'report_type', 'period_start', 'period_end',
            'total_invoices', 'successful_invoices', 'failed_invoices', 'total_value',
            'total_tax', 'kra_acknowledgments', 'detailed_data', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class NotificationLogSerializer(serializers.ModelSerializer):
    """Serializer for NotificationLog model"""
    company_name = serializers.CharField(source='company.company_name', read_only=True)
    
    class Meta:
        model = NotificationLog
        fields = [
            'id', 'company', 'company_name', 'notification_type', 'recipient',
            'subject', 'message', 'status', 'trigger_event', 'retry_count',
            'sent_at', 'error_message', 'created_at'
        ]
        read_only_fields = ['id', 'sent_at', 'created_at']


class OnboardingResponseSerializer(serializers.Serializer):
    """Serializer for onboarding response"""
    success = serializers.BooleanField()
    company_id = serializers.UUIDField()
    device_id = serializers.UUIDField()
    message = serializers.CharField()
    kra_registration_status = serializers.CharField()
    next_steps = serializers.ListField(child=serializers.CharField())


class AnalyticsSerializer(serializers.Serializer):
    """Serializer for analytics dashboard data"""
    company_id = serializers.UUIDField()
    period_start = serializers.DateTimeField()
    period_end = serializers.DateTimeField()
    
    # Transaction metrics
    total_transactions = serializers.IntegerField()
    successful_transactions = serializers.IntegerField()
    failed_transactions = serializers.IntegerField()
    success_rate = serializers.DecimalField(max_digits=5, decimal_places=2)
    
    # Financial metrics
    total_revenue = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_tax_collected = serializers.DecimalField(max_digits=15, decimal_places=2)
    
    # Device metrics
    active_devices = serializers.IntegerField()
    device_uptime = serializers.DecimalField(max_digits=5, decimal_places=2)
    
    # KRA metrics
    kra_acknowledgments = serializers.IntegerField()
    average_response_time = serializers.DecimalField(max_digits=8, decimal_places=3)


class ErrorResponseSerializer(serializers.Serializer):
    """Serializer for error responses"""
    error = serializers.CharField()
    message = serializers.CharField()
    details = serializers.DictField(required=False)
    timestamp = serializers.DateTimeField()
    request_id = serializers.CharField(required=False)

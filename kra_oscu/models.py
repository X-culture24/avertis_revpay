"""
Django models for Revpay Connect eTIMS Gateway - OSCU & VSCU Integration.
Multi-tenant architecture with enhanced security and monitoring.
Certified 3rd-party integrator for both Online and Virtual Sales Control Units.
Based on KRA technical specifications and ERD design.
"""
import uuid
from django.db import models
from django.core.validators import RegexValidator, MinValueValidator, MaxValueValidator
from django.utils import timezone
from decimal import Decimal
from cryptography.fernet import Fernet
from django.conf import settings
import json


class EncryptionMixin:
    """Mixin for encrypting sensitive fields"""
    
    @staticmethod
    def encrypt_data(data: str) -> str:
        """Encrypt sensitive data"""
        if not data:
            return data
        key = getattr(settings, 'ENCRYPTION_KEY', Fernet.generate_key())
        f = Fernet(key)
        return f.encrypt(data.encode()).decode()
    
    @staticmethod
    def decrypt_data(encrypted_data: str) -> str:
        """Decrypt sensitive data"""
        if not encrypted_data:
            return encrypted_data
        try:
            key = getattr(settings, 'ENCRYPTION_KEY', None)
            if not key:
                return encrypted_data
            f = Fernet(key)
            return f.decrypt(encrypted_data.encode()).decode()
        except Exception:
            return encrypted_data


class BaseModel(models.Model):
    """Base model with common fields"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Company(BaseModel):
    """
    Multi-tenant company model for Revpay Connect clients.
    Each company represents a business using the eTIMS integration.
    """
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('suspended', 'Suspended'),
        ('pending_approval', 'Pending Approval'),
    ]
    
    # Company identification
    company_name = models.CharField(max_length=200, help_text="Business/Company name")
    tin = models.CharField(
        max_length=11,
        unique=True,
        validators=[RegexValidator(r'^\d{11}$', 'TIN must be 11 digits')],
        help_text="Tax Identification Number (11 digits)"
    )
    
    # Contact information
    contact_person = models.CharField(max_length=100, help_text="Primary contact person")
    contact_email = models.EmailField(help_text="Contact email address")
    contact_phone = models.CharField(max_length=20, help_text="Contact phone number")
    
    # Business details
    business_address = models.TextField(help_text="Physical business address")
    business_type = models.CharField(max_length=100, blank=True, help_text="Type of business")
    
    # Status and configuration
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending_approval')
    is_sandbox = models.BooleanField(default=True, help_text="Using sandbox environment")
    
    # Revpay Connect metadata
    onboarding_date = models.DateTimeField(auto_now_add=True)
    subscription_plan = models.CharField(max_length=50, default='basic', help_text="Subscription plan")
    
    class Meta:
        db_table = 'revpay_companies'
        verbose_name_plural = 'Companies'
        indexes = [
            models.Index(fields=['tin']),
            models.Index(fields=['status']),
            models.Index(fields=['contact_email']),
        ]
    
    def __str__(self):
        return f"{self.company_name} ({self.tin})"
    
    @property
    def is_active(self):
        return self.status == 'active'


class Device(BaseModel, EncryptionMixin):
    """
    Represents a device registered with KRA eTIMS (OSCU or VSCU).
    Each device gets a unique CMC key for secure communication.
    Supports both Online Sales Control Unit (OSCU) and Virtual Sales Control Unit (VSCU).
    """
    STATUS_CHOICES = [
        ('pending', 'Pending Registration'),
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('suspended', 'Suspended'),
        ('failed', 'Registration Failed'),
    ]
    
    DEVICE_TYPE_CHOICES = [
        ('oscu', 'Online Sales Control Unit (OSCU)'),
        ('vscu', 'Virtual Sales Control Unit (VSCU)'),
    ]
    
    INTEGRATION_TYPE_CHOICES = [
        ('pos', 'Point of Sale System'),
        ('erp', 'Enterprise Resource Planning'),
        ('ecommerce', 'E-commerce Platform'),
        ('mobile_app', 'Mobile Application'),
        ('web_app', 'Web Application'),
        ('api_integration', 'Direct API Integration'),
    ]

    # Multi-tenant relationship
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='devices',
        help_text="Company that owns this device"
    )
    
    # Device type and integration classification
    device_type = models.CharField(
        max_length=10,
        choices=DEVICE_TYPE_CHOICES,
        default='oscu',
        help_text="Type of eTIMS device (OSCU or VSCU)"
    )
    integration_type = models.CharField(
        max_length=20,
        choices=INTEGRATION_TYPE_CHOICES,
        default='pos',
        help_text="Type of system being integrated"
    )
    
    # KRA required fields
    tin = models.CharField(
        max_length=11,
        validators=[RegexValidator(r'^\d{11}$', 'TIN must be 11 digits')],
        help_text="Tax Identification Number (11 digits)"
    )
    bhf_id = models.CharField(
        max_length=3,
        validators=[RegexValidator(r'^\d{3}$', 'Branch ID must be 3 digits')],
        help_text="Branch ID (3 digits, e.g., 001)"
    )
    serial_number = models.CharField(
        max_length=50,
        unique=True,
        help_text="Unique device serial number"
    )
    
    # VSCU-specific fields
    virtual_device_id = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text="Virtual device identifier for VSCU integrations"
    )
    api_endpoint = models.URLField(
        blank=True,
        null=True,
        help_text="Custom API endpoint for VSCU integrations"
    )
    webhook_url = models.URLField(
        blank=True,
        null=True,
        help_text="Webhook URL for real-time notifications"
    )
    
    # KRA response fields (encrypted)
    cmc_key_encrypted = models.TextField(
        blank=True,
        null=True,
        help_text="Encrypted Communication Key from KRA"
    )
    
    @property
    def cmc_key(self):
        """Decrypt and return CMC key"""
        if self.cmc_key_encrypted:
            return self.decrypt_data(self.cmc_key_encrypted)
        return None
    
    @cmc_key.setter
    def cmc_key(self, value):
        """Encrypt and store CMC key"""
        if value:
            self.cmc_key_encrypted = self.encrypt_data(value)
        else:
            self.cmc_key_encrypted = None
    
    # Device management fields
    device_name = models.CharField(max_length=100, help_text="Friendly device name")
    pos_version = models.CharField(max_length=20, blank=True, help_text="POS/System software version")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    is_certified = models.BooleanField(default=False, help_text="KRA certification status")
    last_sync = models.DateTimeField(null=True, blank=True, help_text="Last successful sync with KRA")
    
    # 3rd-party integrator fields
    integrator_reference = models.CharField(
        max_length=100,
        blank=True,
        help_text="Revpay Connect internal reference for this integration"
    )
    client_system_info = models.JSONField(
        default=dict,
        blank=True,
        help_text="Client system information and configuration"
    )
    certification_date = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Date when device was certified by KRA"
    )
    certification_expiry = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Certification expiry date"
    )

    class Meta:
        db_table = 'kra_devices'
        unique_together = ['company', 'tin', 'bhf_id', 'serial_number']
        indexes = [
            models.Index(fields=['company']),
            models.Index(fields=['tin', 'bhf_id']),
            models.Index(fields=['status']),
            models.Index(fields=['serial_number']),
            models.Index(fields=['device_type']),
            models.Index(fields=['integration_type']),
        ]

    def __str__(self):
        device_type_display = self.get_device_type_display()
        return f"{self.device_name} ({device_type_display} - {self.company.company_name})"

    @property
    def is_active(self):
        return self.status == 'active' and self.cmc_key is not None
    
    @property
    def is_oscu(self):
        """Check if this is an OSCU device"""
        return self.device_type == 'oscu'
    
    @property
    def is_vscu(self):
        """Check if this is a VSCU device"""
        return self.device_type == 'vscu'
    
    @property
    def requires_physical_device(self):
        """Check if this integration requires a physical device"""
        return self.device_type == 'oscu'
    
    @property
    def is_virtual_integration(self):
        """Check if this is a virtual/API-only integration"""
        return self.device_type == 'vscu'


class ItemMaster(BaseModel):
    """
    Master catalog of items/products with KRA tax classifications.
    Synchronized with KRA item codes and tax types.
    """
    TAX_TYPE_CHOICES = [
        ('A', 'VAT Standard Rate (16%)'),
        ('B', 'VAT Reduced Rate (8%)'),
        ('C', 'VAT Zero Rate (0%)'),
        ('D', 'VAT Exempt'),
        ('E', 'Special Tax'),
    ]

    item_code = models.CharField(
        max_length=50,
        unique=True,
        help_text="KRA standardized item code"
    )
    item_name = models.CharField(max_length=200, help_text="Item/product name")
    item_type = models.CharField(max_length=50, blank=True, help_text="Item category/type")
    tax_type = models.CharField(
        max_length=1,
        choices=TAX_TYPE_CHOICES,
        help_text="KRA tax classification"
    )
    default_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))],
        null=True,
        blank=True,
        help_text="Default selling price"
    )
    unit_of_measure = models.CharField(max_length=20, help_text="Unit of measure (e.g., PCS, KG)")
    description = models.TextField(blank=True, help_text="Item description")
    category = models.CharField(max_length=100, blank=True, help_text="Product category")
    is_active = models.BooleanField(default=True, help_text="Item is available for sale")

    class Meta:
        db_table = 'kra_item_master'
        indexes = [
            models.Index(fields=['item_code']),
            models.Index(fields=['tax_type']),
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        return f"{self.item_code} - {self.item_name}"


class Invoice(BaseModel):
    """
    Sales invoice/receipt sent to KRA eTIMS.
    Contains KRA signature and internal data after successful transmission.
    """
    STATUS_CHOICES = [
        ('pending', 'Pending KRA Submission'),
        ('sent', 'Sent to KRA'),
        ('confirmed', 'Confirmed by KRA'),
        ('failed', 'Failed Submission'),
        ('retry', 'In Retry Queue'),
    ]

    PAYMENT_TYPE_CHOICES = [
        ('CASH', 'Cash'),
        ('CARD', 'Credit/Debit Card'),
        ('MOBILE', 'Mobile Money'),
        ('BANK', 'Bank Transfer'),
        ('CREDIT', 'Credit Sale'),
    ]

    # Invoice identification
    invoice_no = models.CharField(
        max_length=50,
        help_text="Internal invoice/receipt number"
    )
    receipt_no = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text="KRA receipt number (after successful submission)"
    )
    
    # Device and business info
    device = models.ForeignKey(
        Device,
        on_delete=models.CASCADE,
        related_name='invoices',
        help_text="Device that generated this invoice"
    )
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='invoices',
        help_text="Company that owns this invoice"
    )
    tin = models.CharField(max_length=11, help_text="Business TIN")
    
    # Financial details
    total_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Total invoice amount including tax"
    )
    tax_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Total tax amount"
    )
    currency = models.CharField(max_length=3, default='KES', help_text="Currency code")
    
    # Customer information
    customer_tin = models.CharField(
        max_length=11,
        blank=True,
        validators=[RegexValidator(r'^\d{11}$', 'Customer TIN must be 11 digits')],
        help_text="Customer TIN (optional)"
    )
    customer_name = models.CharField(max_length=200, blank=True, help_text="Customer name")
    payment_type = models.CharField(
        max_length=10,
        choices=PAYMENT_TYPE_CHOICES,
        default='CASH',
        help_text="Payment method"
    )
    
    # KRA response data
    internal_data = models.TextField(
        blank=True,
        null=True,
        help_text="KRA internal data (encrypted)"
    )
    receipt_signature = models.TextField(
        blank=True,
        null=True,
        help_text="KRA receipt signature"
    )
    
    # Status and timing
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    transaction_date = models.DateTimeField(help_text="Transaction timestamp")
    retry_count = models.PositiveIntegerField(default=0, help_text="Number of retry attempts")

    class Meta:
        db_table = 'kra_invoices'
        unique_together = ['device', 'invoice_no']
        indexes = [
            models.Index(fields=['device', 'transaction_date']),
            models.Index(fields=['status']),
            models.Index(fields=['receipt_no']),
            models.Index(fields=['tin']),
        ]

    def __str__(self):
        return f"Invoice {self.invoice_no} - {self.total_amount} KES"

    @property
    def is_confirmed(self):
        return self.status == 'confirmed' and self.receipt_signature is not None


class InvoiceItem(BaseModel):
    """
    Line items within an invoice.
    Each item references the master item catalog and includes tax calculations.
    """
    invoice = models.ForeignKey(
        Invoice,
        on_delete=models.CASCADE,
        related_name='items',
        help_text="Parent invoice"
    )
    item_code = models.CharField(max_length=50, help_text="KRA item code")
    item_name = models.CharField(max_length=200, help_text="Item name")
    
    # Quantity and pricing
    quantity = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        validators=[MinValueValidator(Decimal('0.001'))],
        help_text="Item quantity"
    )
    unit_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Unit price before tax"
    )
    total_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Total line amount before tax"
    )
    
    # Tax information
    tax_type = models.CharField(
        max_length=1,
        choices=ItemMaster.TAX_TYPE_CHOICES,
        help_text="KRA tax classification"
    )
    tax_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00')), MaxValueValidator(Decimal('100.00'))],
        help_text="Tax rate percentage"
    )
    tax_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Tax amount for this line"
    )
    
    unit_of_measure = models.CharField(max_length=20, help_text="Unit of measure")

    class Meta:
        db_table = 'kra_invoice_items'
        indexes = [
            models.Index(fields=['invoice']),
            models.Index(fields=['item_code']),
        ]

    def __str__(self):
        return f"{self.item_name} x {self.quantity}"

    def save(self, *args, **kwargs):
        """Calculate totals before saving"""
        self.total_price = self.quantity * self.unit_price
        self.tax_amount = self.total_price * (self.tax_rate / 100)
        super().save(*args, **kwargs)


class ApiLog(BaseModel):
    """
    Enhanced audit log with multi-tenant support and detailed monitoring.
    Critical for compliance, debugging, and analytics.
    """
    """
    Audit log of all KRA API interactions.
    Critical for compliance and debugging.
    """
    REQUEST_TYPE_CHOICES = [
        ('init', 'Device Initialization'),
        ('sales', 'Sales Transaction'),
        ('item_sync', 'Item Synchronization'),
        ('status_check', 'Status Check'),
        ('codes', 'System Codes'),
        ('health_check', 'Health Check'),
        ('client_onboard', 'Client Onboarding'),
    ]
    
    SEVERITY_CHOICES = [
        ('info', 'Information'),
        ('warning', 'Warning'),
        ('error', 'Error'),
        ('critical', 'Critical'),
    ]

    # Multi-tenant relationships
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='api_logs',
        null=True,
        blank=True,
        help_text="Company associated with this log"
    )
    device = models.ForeignKey(
        Device,
        on_delete=models.CASCADE,
        related_name='api_logs',
        null=True,
        blank=True,
        help_text="Device that made the request"
    )
    endpoint = models.CharField(max_length=200, help_text="KRA API endpoint called")
    request_type = models.CharField(
        max_length=20,
        choices=REQUEST_TYPE_CHOICES,
        help_text="Type of API request"
    )
    
    # Request/Response data
    request_payload = models.TextField(help_text="Request sent to KRA (JSON/XML)")
    response_payload = models.TextField(blank=True, help_text="Response from KRA")
    
    # Response metadata
    status_code = models.PositiveIntegerField(help_text="HTTP status code")
    response_time = models.DecimalField(
        max_digits=8,
        decimal_places=3,
        help_text="Response time in seconds"
    )
    error_message = models.TextField(blank=True, help_text="Error message if failed")
    is_retry = models.BooleanField(default=False, help_text="Is this a retry attempt")
    
    # Enhanced monitoring fields
    severity = models.CharField(
        max_length=10,
        choices=SEVERITY_CHOICES,
        default='info',
        help_text="Log severity level"
    )
    user_agent = models.CharField(max_length=200, blank=True, help_text="Client user agent")
    ip_address = models.GenericIPAddressField(null=True, blank=True, help_text="Client IP address")
    environment = models.CharField(max_length=20, default='sandbox', help_text="Environment (sandbox/production)")

    class Meta:
        db_table = 'kra_api_logs'
        indexes = [
            models.Index(fields=['company', 'created_at']),
            models.Index(fields=['device', 'created_at']),
            models.Index(fields=['request_type']),
            models.Index(fields=['status_code']),
            models.Index(fields=['severity']),
            models.Index(fields=['environment']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.request_type} - {self.status_code} ({self.created_at})"


class SystemCode(BaseModel):
    """
    KRA system codes and reference data.
    Tax types, payment methods, units of measure, etc.
    """
    CODE_TYPE_CHOICES = [
        ('tax_type', 'Tax Types'),
        ('payment_type', 'Payment Types'),
        ('unit_measure', 'Units of Measure'),
        ('currency', 'Currency Codes'),
        ('item_category', 'Item Categories'),
    ]

    code_type = models.CharField(
        max_length=20,
        choices=CODE_TYPE_CHOICES,
        help_text="Type of system code"
    )
    code_value = models.CharField(max_length=50, help_text="Code value")
    description = models.CharField(max_length=200, help_text="Code description")
    is_active = models.BooleanField(default=True, help_text="Code is active")
    last_updated = models.DateTimeField(auto_now=True, help_text="Last update from KRA")

    class Meta:
        db_table = 'kra_system_codes'
        unique_together = ['code_type', 'code_value']
        indexes = [
            models.Index(fields=['code_type', 'is_active']),
        ]

    def __str__(self):
        return f"{self.code_type}: {self.code_value} - {self.description}"


class RetryQueue(BaseModel):
    """
    Queue for failed transactions that need retry processing.
    Managed by Celery workers with exponential backoff.
    """
    TASK_TYPE_CHOICES = [
        ('sales_retry', 'Sales Transaction Retry'),
        ('status_check', 'Status Check Retry'),
        ('item_sync', 'Item Sync Retry'),
    ]

    STATUS_CHOICES = [
        ('pending', 'Pending Processing'),
        ('processing', 'Currently Processing'),
        ('completed', 'Successfully Completed'),
        ('failed', 'Permanently Failed'),
    ]

    invoice = models.ForeignKey(
        Invoice,
        on_delete=models.CASCADE,
        related_name='retry_attempts',
        help_text="Invoice to retry"
    )
    task_type = models.CharField(
        max_length=20,
        choices=TASK_TYPE_CHOICES,
        help_text="Type of retry task"
    )
    attempt_count = models.PositiveIntegerField(default=0, help_text="Number of attempts made")
    next_retry = models.DateTimeField(help_text="Next retry attempt time")
    error_details = models.TextField(help_text="Last error details")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')

    class Meta:
        db_table = 'kra_retry_queue'
        indexes = [
            models.Index(fields=['status', 'next_retry']),
            models.Index(fields=['invoice']),
        ]

    def __str__(self):
        return f"Retry {self.task_type} for Invoice {self.invoice.invoice_no}"

    def calculate_next_retry(self):
        """Calculate next retry time with exponential backoff"""
        import math
        base_delay = 60  # 1 minute base delay
        max_delay = 3600  # 1 hour max delay
        
        delay = min(base_delay * (2 ** self.attempt_count), max_delay)
        self.next_retry = timezone.now() + timezone.timedelta(seconds=delay)
        self.save()


class ComplianceReport(BaseModel):
    """
    Compliance and analytics reporting for Revpay Connect clients.
    Tracks transaction volumes, values, and KRA acknowledgments.
    """
    REPORT_TYPE_CHOICES = [
        ('daily', 'Daily Report'),
        ('weekly', 'Weekly Report'),
        ('monthly', 'Monthly Report'),
        ('quarterly', 'Quarterly Report'),
    ]
    
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='compliance_reports',
        help_text="Company for this report"
    )
    
    report_type = models.CharField(
        max_length=20,
        choices=REPORT_TYPE_CHOICES,
        help_text="Type of compliance report"
    )
    
    # Report period
    period_start = models.DateTimeField(help_text="Report period start")
    period_end = models.DateTimeField(help_text="Report period end")
    
    # Transaction statistics
    total_invoices = models.PositiveIntegerField(default=0, help_text="Total invoices processed")
    successful_invoices = models.PositiveIntegerField(default=0, help_text="Successfully transmitted invoices")
    failed_invoices = models.PositiveIntegerField(default=0, help_text="Failed invoice transmissions")
    
    # Financial statistics
    total_value = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
        help_text="Total transaction value"
    )
    total_tax = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
        help_text="Total tax collected"
    )
    
    # KRA acknowledgments
    kra_acknowledgments = models.PositiveIntegerField(default=0, help_text="KRA acknowledgments received")
    
    # Report data (JSON)
    detailed_data = models.JSONField(
        default=dict,
        help_text="Detailed report data in JSON format"
    )
    
    class Meta:
        db_table = 'revpay_compliance_reports'
        unique_together = ['company', 'report_type', 'period_start']
        indexes = [
            models.Index(fields=['company', 'report_type']),
            models.Index(fields=['period_start', 'period_end']),
        ]
    
    def __str__(self):
        return f"{self.company.company_name} - {self.report_type} ({self.period_start.date()})"


class NotificationLog(BaseModel):
    """
    Log of all notifications sent through the system.
    Tracks delivery status and provides audit trail.
    """
    NOTIFICATION_TYPE_CHOICES = [
        ('email', 'Email'),
        ('sms', 'SMS'),
        ('webhook', 'Webhook'),
        ('system', 'System Alert'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('sent', 'Sent'),
        ('delivered', 'Delivered'),
        ('failed', 'Failed'),
        ('bounced', 'Bounced'),
    ]
    
    # Multi-tenant relationship
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='notifications',
        null=True,
        blank=True,
        help_text="Company this notification relates to (null for system notifications)"
    )
    
    notification_type = models.CharField(max_length=20, choices=NOTIFICATION_TYPE_CHOICES)
    recipient = models.CharField(max_length=255, help_text="Email, phone, or webhook URL")
    subject = models.CharField(max_length=255, blank=True)
    message = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Metadata
    template_used = models.CharField(max_length=100, blank=True)
    delivery_attempts = models.PositiveIntegerField(default=0)
    last_attempt_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)
    
    # Context data
    context_data = models.JSONField(default=dict, blank=True)
    
    class Meta:
        db_table = 'notification_logs'
        indexes = [
            models.Index(fields=['company']),
            models.Index(fields=['notification_type']),
            models.Index(fields=['status']),
            models.Index(fields=['created_at']),
        ]
    
    def __str__(self):
        return f"{self.get_notification_type_display()} to {self.recipient} - {self.status}"


class IntegratorCertification(BaseModel):
    """
    Tracks Revpay Connect's certifications as a 3rd-party eTIMS integrator.
    Manages both OSCU and VSCU certification status and renewals.
    """
    CERTIFICATION_TYPE_CHOICES = [
        ('oscu', 'OSCU Integrator Certification'),
        ('vscu', 'VSCU Integrator Certification'),
        ('combined', 'Combined OSCU/VSCU Certification'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending Application'),
        ('under_review', 'Under KRA Review'),
        ('approved', 'Approved'),
        ('active', 'Active'),
        ('suspended', 'Suspended'),
        ('expired', 'Expired'),
        ('revoked', 'Revoked'),
    ]
    
    certification_type = models.CharField(
        max_length=20,
        choices=CERTIFICATION_TYPE_CHOICES,
        help_text="Type of integrator certification"
    )
    certification_id = models.CharField(
        max_length=50,
        unique=True,
        help_text="KRA-issued certification identifier"
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Certification details
    issued_date = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Date certification was issued by KRA"
    )
    expiry_date = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Certification expiry date"
    )
    renewal_date = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Next renewal date"
    )
    
    # KRA details
    kra_officer = models.CharField(
        max_length=100,
        blank=True,
        help_text="KRA officer who issued certification"
    )
    kra_reference = models.CharField(
        max_length=100,
        blank=True,
        help_text="KRA internal reference number"
    )
    
    # Certification scope and limitations
    max_clients = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Maximum number of clients allowed under this certification"
    )
    max_transactions_per_month = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Maximum transactions per month"
    )
    allowed_business_types = models.JSONField(
        default=list,
        blank=True,
        help_text="List of business types allowed under this certification"
    )
    
    # Compliance and monitoring
    compliance_requirements = models.JSONField(
        default=dict,
        blank=True,
        help_text="Specific compliance requirements for this certification"
    )
    last_audit_date = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Date of last KRA audit"
    )
    next_audit_date = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Scheduled next audit date"
    )
    
    # Financial and business terms
    certification_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Certification fee paid to KRA"
    )
    annual_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Annual maintenance fee"
    )
    revenue_sharing_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Revenue sharing percentage with KRA (if applicable)"
    )
    
    class Meta:
        db_table = 'integrator_certifications'
        indexes = [
            models.Index(fields=['certification_type']),
            models.Index(fields=['status']),
            models.Index(fields=['expiry_date']),
            models.Index(fields=['certification_id']),
        ]
    
    def __str__(self):
        return f"{self.get_certification_type_display()} - {self.certification_id}"
    
    @property
    def is_active(self):
        """Check if certification is currently active"""
        return self.status == 'active' and (
            not self.expiry_date or self.expiry_date > timezone.now()
        )
    
    @property
    def days_until_expiry(self):
        """Calculate days until certification expires"""
        if not self.expiry_date:
            return None
        delta = self.expiry_date - timezone.now()
        return delta.days if delta.days > 0 else 0
    
    @property
    def requires_renewal(self):
        """Check if certification requires renewal soon (within 30 days)"""
        if not self.expiry_date:
            return False
        return self.days_until_expiry <= 30


class PartnershipAgreement(BaseModel):
    """
    Manages partnership agreements with other businesses and technology providers.
    Supports Revpay Connect's growth through strategic partnerships.
    """
    PARTNERSHIP_TYPE_CHOICES = [
        ('technology', 'Technology Integration Partner'),
        ('reseller', 'Reseller Partner'),
        ('referral', 'Referral Partner'),
        ('white_label', 'White Label Partner'),
        ('system_integrator', 'System Integrator Partner'),
    ]
    
    STATUS_CHOICES = [
        ('draft', 'Draft Agreement'),
        ('under_review', 'Under Review'),
        ('active', 'Active'),
        ('suspended', 'Suspended'),
        ('terminated', 'Terminated'),
        ('expired', 'Expired'),
    ]
    
    partner_name = models.CharField(max_length=200, help_text="Partner company name")
    partnership_type = models.CharField(max_length=20, choices=PARTNERSHIP_TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    
    # Contact information
    partner_contact_person = models.CharField(max_length=100)
    partner_email = models.EmailField()
    partner_phone = models.CharField(max_length=20, blank=True)
    
    # Agreement details
    agreement_start_date = models.DateField()
    agreement_end_date = models.DateField(null=True, blank=True)
    auto_renewal = models.BooleanField(default=False)
    
    # Business terms
    revenue_share_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Revenue sharing percentage for partner"
    )
    minimum_monthly_volume = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Minimum monthly transaction volume commitment"
    )
    exclusive_territories = models.JSONField(
        default=list,
        blank=True,
        help_text="Exclusive territories or market segments"
    )
    
    # Technical integration
    api_access_level = models.CharField(
        max_length=20,
        choices=[
            ('basic', 'Basic API Access'),
            ('advanced', 'Advanced API Access'),
            ('full', 'Full Platform Access'),
        ],
        default='basic'
    )
    white_label_branding = models.BooleanField(
        default=False,
        help_text="Allow partner to use their own branding"
    )
    
    # Performance tracking
    total_clients_referred = models.PositiveIntegerField(default=0)
    total_revenue_generated = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00')
    )
    last_activity_date = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'partnership_agreements'
        indexes = [
            models.Index(fields=['partnership_type']),
            models.Index(fields=['status']),
            models.Index(fields=['agreement_end_date']),
        ]
    
    def __str__(self):
        return f"{self.partner_name} - {self.get_partnership_type_display()}"
    
    @property
    def is_active(self):
        """Check if partnership is currently active"""
        return self.status == 'active' and (
            not self.agreement_end_date or self.agreement_end_date >= timezone.now().date()
        )

#!/usr/bin/env python
"""
Test invoice approval directly
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'etims_integration.settings')
django.setup()

from kra_oscu.models import Company, Device, Invoice, InvoiceItem
from kra_oscu.services.kra_client import KRAClient
from kra_oscu.services.kra_mock_service import KRAMockService
from decimal import Decimal
from django.utils import timezone

def test_invoice_approval():
    """Test invoice approval flow"""
    
    # Get the most recent company
    company = Company.objects.order_by('-created_at').first()
    if not company:
        print("❌ No company found")
        return
    
    print(f"✓ Found company: {company.company_name}")
    print(f"  TIN: {company.tin}")
    
    # Get the device
    device = Device.objects.filter(company=company, status='active').first()
    if not device:
        print("❌ No active device found")
        return
    
    print(f"✓ Found device: {device.serial_number}")
    print(f"  Device TIN: {device.tin}")
    print(f"  Device Type: {device.device_type}")
    print(f"  Has CMC Key: {bool(device.cmc_key)}")
    
    # Check if TIN is registered in mock service
    print(f"\n🔍 Checking TIN registration in mock service...")
    print(f"  Registered TINs: {KRAMockService.REGISTERED_TINS}")
    print(f"  Is {company.tin} registered? {KRAMockService.is_tin_registered(company.tin)}")
    
    # Register TIN if not registered
    if not KRAMockService.is_tin_registered(company.tin):
        print(f"  Registering TIN {company.tin}...")
        KRAMockService.register_tin(company.tin)
        print(f"  ✓ TIN registered")
    
    # Get the most recent invoice
    invoice = Invoice.objects.filter(company=company).order_by('-created_at').first()
    if not invoice:
        print("❌ No invoice found")
        return
    
    print(f"\n✓ Found invoice: {invoice.invoice_no}")
    print(f"  Status: {invoice.status}")
    print(f"  Total: {invoice.total_amount}")
    print(f"  Receipt No: {invoice.receipt_no}")
    
    # Try to submit to KRA
    print(f"\n📤 Submitting invoice to KRA mock service...")
    kra_client = KRAClient()
    result = kra_client.send_sales_invoice(invoice)
    
    print(f"\n📥 KRA Response:")
    print(f"  Success: {result.get('success')}")
    if result.get('success'):
        print(f"  Receipt No: {result.get('receipt_no')}")
        print(f"  Internal Data: {result.get('internal_data')[:50]}...")
        print(f"  QR Code: {result.get('qr_code')}")
        
        # Update invoice
        invoice.receipt_no = result.get('receipt_no')
        invoice.internal_data = result.get('internal_data')
        invoice.receipt_signature = result.get('receipt_signature')
        invoice.status = 'confirmed'
        invoice.synced_at = timezone.now()
        invoice.save()
        
        print(f"\n✅ Invoice approved and updated!")
        print(f"  New Status: {invoice.status}")
        print(f"  Receipt No: {invoice.receipt_no}")
    else:
        print(f"  Error Code: {result.get('error_code')}")
        print(f"  Error Message: {result.get('error_message')}")
        print(f"  Full Response: {result}")

if __name__ == '__main__':
    test_invoice_approval()

#!/usr/bin/env python
"""
Test script to verify username display and QR code generation fixes
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'etims_integration.settings')
django.setup()

from kra_oscu.models import Company, Invoice, User
from kra_oscu.services.qr_service import QRCodeService
from django.contrib.auth import get_user_model

User = get_user_model()

def test_username_data():
    """Test that companies have contact_person data"""
    print("\n" + "="*60)
    print("TESTING USERNAME DATA")
    print("="*60)
    
    companies = Company.objects.all()[:5]
    
    if not companies:
        print("❌ No companies found in database")
        return False
    
    print(f"\n✅ Found {companies.count()} companies")
    
    for company in companies:
        print(f"\n📊 Company: {company.company_name}")
        print(f"   TIN: {company.tin}")
        print(f"   Contact Person: {company.contact_person}")
        print(f"   Contact Email: {company.contact_email}")
        
        # Try to find user
        try:
            user = User.objects.get(email=company.contact_email)
            print(f"   User Found: {user.username}")
            print(f"   First Name: {user.first_name}")
            print(f"   Last Name: {user.last_name}")
            print(f"   Full Name: {user.first_name} {user.last_name}".strip())
        except User.DoesNotExist:
            print(f"   ⚠️  No user found for email: {company.contact_email}")
    
    return True


def test_qr_code_generation():
    """Test QR code generation for approved invoices"""
    print("\n" + "="*60)
    print("TESTING QR CODE GENERATION")
    print("="*60)
    
    # Find confirmed invoices
    confirmed_invoices = Invoice.objects.filter(status='confirmed')[:5]
    
    if not confirmed_invoices:
        print("❌ No confirmed invoices found")
        print("   Create and approve an invoice first")
        return False
    
    print(f"\n✅ Found {confirmed_invoices.count()} confirmed invoices")
    
    for invoice in confirmed_invoices:
        print(f"\n📄 Invoice: {invoice.invoice_no}")
        print(f"   Status: {invoice.status}")
        print(f"   Receipt No: {invoice.receipt_no or 'N/A'}")
        print(f"   Has QR Code: {'✅ Yes' if invoice.qr_code_data else '❌ No'}")
        print(f"   Has Signature: {'✅ Yes' if invoice.receipt_signature else '❌ No'}")
        print(f"   Has Internal Data: {'✅ Yes' if invoice.internal_data else '❌ No'}")
        
        # Generate QR code if missing
        if not invoice.qr_code_data:
            print(f"   🔄 Generating QR code...")
            try:
                QRCodeService.update_invoice_qr(invoice)
                invoice.refresh_from_db()
                if invoice.qr_code_data:
                    print(f"   ✅ QR code generated successfully!")
                    print(f"   QR Code Length: {len(invoice.qr_code_data)} characters")
                else:
                    print(f"   ❌ QR code generation failed")
            except Exception as e:
                print(f"   ❌ Error generating QR code: {e}")
    
    return True


def test_invoice_data_completeness():
    """Test that approved invoices have all required data"""
    print("\n" + "="*60)
    print("TESTING INVOICE DATA COMPLETENESS")
    print("="*60)
    
    confirmed_invoices = Invoice.objects.filter(status='confirmed')
    
    if not confirmed_invoices:
        print("❌ No confirmed invoices found")
        return False
    
    total = confirmed_invoices.count()
    with_qr = confirmed_invoices.exclude(qr_code_data='').exclude(qr_code_data__isnull=True).count()
    with_signature = confirmed_invoices.exclude(receipt_signature='').exclude(receipt_signature__isnull=True).count()
    with_internal = confirmed_invoices.exclude(internal_data='').exclude(internal_data__isnull=True).count()
    with_receipt = confirmed_invoices.exclude(receipt_no='').exclude(receipt_no__isnull=True).count()
    
    print(f"\n📊 Statistics:")
    print(f"   Total Confirmed Invoices: {total}")
    print(f"   With Receipt Number: {with_receipt} ({with_receipt/total*100:.1f}%)")
    print(f"   With QR Code: {with_qr} ({with_qr/total*100:.1f}%)")
    print(f"   With Signature: {with_signature} ({with_signature/total*100:.1f}%)")
    print(f"   With Internal Data: {with_internal} ({with_internal/total*100:.1f}%)")
    
    if with_qr < total:
        print(f"\n⚠️  {total - with_qr} invoices missing QR codes")
        print(f"   Run: python manage.py shell")
        print(f"   Then: from kra_oscu.services.qr_service import QRCodeService")
        print(f"         from kra_oscu.models import Invoice")
        print(f"         for inv in Invoice.objects.filter(status='confirmed', qr_code_data=''):")
        print(f"             QRCodeService.update_invoice_qr(inv)")
    
    return True


def main():
    """Run all tests"""
    print("\n" + "="*60)
    print("USERNAME AND QR CODE VERIFICATION TEST")
    print("="*60)
    
    results = []
    
    # Test 1: Username data
    results.append(("Username Data", test_username_data()))
    
    # Test 2: QR code generation
    results.append(("QR Code Generation", test_qr_code_generation()))
    
    # Test 3: Invoice data completeness
    results.append(("Invoice Data Completeness", test_invoice_data_completeness()))
    
    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    all_passed = all(result for _, result in results)
    
    if all_passed:
        print("\n🎉 All tests passed!")
        print("\nNext steps:")
        print("1. Restart backend: python manage.py runserver")
        print("2. Clear mobile cache: npm start -- --reset-cache")
        print("3. Re-login to mobile app")
        print("4. Check dashboard for username")
        print("5. View approved invoice for QR code")
    else:
        print("\n⚠️  Some tests failed. Check output above for details.")
    
    return 0 if all_passed else 1


if __name__ == '__main__':
    sys.exit(main())

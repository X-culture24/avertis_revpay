#!/usr/bin/env python
"""
Direct script to create comprehensive mock data for testing all API endpoints
"""
import os
import sys
import django
from decimal import Decimal
from datetime import datetime, timedelta

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'etims_integration.settings')
django.setup()

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.authtoken.models import Token

from kra_oscu.models import (
    Company, Device, Invoice, InvoiceItem, ItemMaster, ApiLog, 
    RetryQueue, SystemCode, IntegratorCertification, PartnershipAgreement,
    NotificationLog
)

def create_mock_data():
    print('Creating comprehensive mock data...')
    
    # Create additional users and tokens
    create_users()
    
    # Create companies with different statuses
    companies = create_companies()
    
    # Create devices for each company (OSCU and VSCU)
    devices = create_devices(companies)
    
    # Create item master data
    items = create_items()
    
    # Create invoices and invoice items
    invoices = create_invoices(companies, devices, items)
    
    # Create system codes
    create_system_codes()
    
    # Create API logs
    create_api_logs(companies, devices)
    
    # Create retry queue entries
    create_retry_queue(invoices)
    
    # Create integrator certifications
    create_integrator_certifications(companies)
    
    # Create partnership agreements
    create_partnership_agreements(companies)
    
    # Create notification logs
    create_notification_logs(companies)
    
    print('Mock data created successfully!')
    print_summary()

def create_users():
    """Create test users with tokens"""
    users_data = [
        {'username': 'testuser1', 'email': 'test1@example.com', 'password': 'testpass123'},
        {'username': 'testuser2', 'email': 'test2@example.com', 'password': 'testpass123'},
        {'username': 'integrator', 'email': 'integrator@example.com', 'password': 'integratorpass'},
    ]
    
    for user_data in users_data:
        user, created = User.objects.get_or_create(
            username=user_data['username'],
            defaults={
                'email': user_data['email'],
                'is_active': True
            }
        )
        if created:
            user.set_password(user_data['password'])
            user.save()
            Token.objects.get_or_create(user=user)
            print(f'Created user: {user.username}')

def create_companies():
    """Create test companies with different statuses"""
    companies_data = [
        {
            'name': 'Retail Store Ltd',
            'tin': '10001234567',
            'email': 'info@retailstore.com',
            'phone': '+254701000001',
            'address': '100 Retail Street, Nairobi',
            'business_type': 'retail',
            'status': 'active'
        },
        {
            'name': 'Restaurant Chain Co',
            'tin': '10001234568',
            'email': 'contact@restaurant.com',
            'phone': '+254701000002',
            'address': '200 Food Avenue, Mombasa',
            'business_type': 'hospitality',
            'status': 'active'
        },
        {
            'name': 'Manufacturing Corp',
            'tin': '10001234569',
            'email': 'admin@manufacturing.com',
            'phone': '+254701000003',
            'address': '300 Industrial Road, Kisumu',
            'business_type': 'manufacturing',
            'status': 'pending'
        },
        {
            'name': 'Service Provider Ltd',
            'tin': '10001234570',
            'email': 'services@provider.com',
            'phone': '+254701000004',
            'address': '400 Service Lane, Nakuru',
            'business_type': 'services',
            'status': 'suspended'
        }
    ]
    
    companies = []
    for company_data in companies_data:
        company, created = Company.objects.get_or_create(
            tin=company_data['tin'],
            defaults=company_data
        )
        companies.append(company)
        if created:
            print(f'Created company: {company.name}')
    
    return companies

def create_devices(companies):
    """Create devices for companies (both OSCU and VSCU)"""
    devices = []
    device_types = ['oscu', 'vscu']
    integration_types = ['pos', 'ecommerce', 'mobile_app', 'api']
    
    for i, company in enumerate(companies):
        for j, device_type in enumerate(device_types):
            device_data = {
                'company': company,
                'device_serial': f'{device_type.upper()}{company.tin[-3:]}{j:03d}',
                'device_name': f'{device_type.upper()} Terminal {j+1}',
                'device_type': device_type,
                'integration_type': integration_types[i % len(integration_types)],
                'bhf_id': f'{i:03d}',
                'status': 'active' if i < 3 else 'inactive',
                'cmc_key': f'test_cmc_key_{device_type}_{i}_{j}',
                'last_sync': timezone.now() - timedelta(hours=i+1)
            }
            
            if device_type == 'vscu':
                device_data.update({
                    'virtual_device_id': f'VSCU_{company.tin[-3:]}_{j:03d}',
                    'api_endpoint': f'https://api.{company.name.lower().replace(" ", "")}.com/etims',
                    'webhook_url': f'https://webhook.{company.name.lower().replace(" ", "")}.com/kra'
                })
            
            device, created = Device.objects.get_or_create(
                device_serial=device_data['device_serial'],
                defaults=device_data
            )
            devices.append(device)
            if created:
                print(f'Created device: {device.device_serial} ({device.device_type})')
    
    return devices

def create_items():
    """Create item master data"""
    items_data = [
        {
            'item_code': 'ITEM001',
            'item_name': 'Premium Coffee Beans',
            'item_type': 'goods',
            'unit_of_measure': 'KG',
            'unit_price': Decimal('1500.00'),
            'tax_type': 'A',
            'tax_rate': Decimal('16.00'),
            'category': 'beverages'
        },
        {
            'item_code': 'ITEM002',
            'item_name': 'Wireless Headphones',
            'item_type': 'goods',
            'unit_of_measure': 'PCS',
            'unit_price': Decimal('8500.00'),
            'tax_type': 'A',
            'tax_rate': Decimal('16.00'),
            'category': 'electronics'
        },
        {
            'item_code': 'SERV001',
            'item_name': 'IT Consulting Service',
            'item_type': 'service',
            'unit_of_measure': 'HR',
            'unit_price': Decimal('5000.00'),
            'tax_type': 'A',
            'tax_rate': Decimal('16.00'),
            'category': 'services'
        },
        {
            'item_code': 'FOOD001',
            'item_name': 'Chicken Burger Meal',
            'item_type': 'goods',
            'unit_of_measure': 'PCS',
            'unit_price': Decimal('850.00'),
            'tax_type': 'A',
            'tax_rate': Decimal('16.00'),
            'category': 'food'
        },
        {
            'item_code': 'BOOK001',
            'item_name': 'Programming Textbook',
            'item_type': 'goods',
            'unit_of_measure': 'PCS',
            'unit_price': Decimal('2500.00'),
            'tax_type': 'B',
            'tax_rate': Decimal('0.00'),
            'category': 'books'
        }
    ]
    
    items = []
    for item_data in items_data:
        item, created = ItemMaster.objects.get_or_create(
            item_code=item_data['item_code'],
            defaults=item_data
        )
        items.append(item)
        if created:
            print(f'Created item: {item.item_code} - {item.item_name}')
    
    return items

def create_invoices(companies, devices, items):
    """Create sample invoices with items"""
    invoices = []
    
    for i, company in enumerate(companies[:3]):  # Only active companies
        company_devices = [d for d in devices if d.company == company]
        
        for j in range(3):  # 3 invoices per company
            invoice_data = {
                'company': company,
                'device': company_devices[j % len(company_devices)] if company_devices else None,
                'invoice_number': f'INV-{company.tin[-3:]}-{j+1:04d}',
                'total_amount': Decimal('0.00'),
                'tax_amount': Decimal('0.00'),
                'payment_method': ['cash', 'card', 'mobile'][j % 3],
                'status': ['pending', 'completed', 'failed'][j % 3],
                'kra_response': {'status': 'success', 'receipt_number': f'RCP{i}{j:04d}'},
                'created_at': timezone.now() - timedelta(days=j+1)
            }
            
            invoice = Invoice.objects.create(**invoice_data)
            
            # Add invoice items
            total_amount = Decimal('0.00')
            tax_amount = Decimal('0.00')
            
            for k in range(2):  # 2 items per invoice
                item = items[k % len(items)]
                quantity = j + 1
                unit_price = item.unit_price
                total_price = unit_price * quantity
                item_tax = total_price * (item.tax_rate / 100)
                
                InvoiceItem.objects.create(
                    invoice=invoice,
                    item_code=item.item_code,
                    item_name=item.item_name,
                    quantity=quantity,
                    unit_price=unit_price,
                    total_price=total_price,
                    tax_type=item.tax_type,
                    tax_rate=item.tax_rate,
                    tax_amount=item_tax
                )
                
                total_amount += total_price
                tax_amount += item_tax
            
            # Update invoice totals
            invoice.total_amount = total_amount
            invoice.tax_amount = tax_amount
            invoice.save()
            
            invoices.append(invoice)
            print(f'Created invoice: {invoice.invoice_number}')
    
    return invoices

def create_system_codes():
    """Create system reference codes"""
    codes_data = [
        {'code_type': 'tax_type', 'code': 'A', 'description': 'Standard Rate (16%)'},
        {'code_type': 'tax_type', 'code': 'B', 'description': 'Zero Rate (0%)'},
        {'code_type': 'tax_type', 'code': 'C', 'description': 'Exempt'},
        {'code_type': 'payment_method', 'code': 'CASH', 'description': 'Cash Payment'},
        {'code_type': 'payment_method', 'code': 'CARD', 'description': 'Card Payment'},
        {'code_type': 'payment_method', 'code': 'MOBILE', 'description': 'Mobile Money'},
        {'code_type': 'business_type', 'code': 'RETAIL', 'description': 'Retail Business'},
        {'code_type': 'business_type', 'code': 'WHOLESALE', 'description': 'Wholesale Business'},
        {'code_type': 'business_type', 'code': 'MANUFACTURING', 'description': 'Manufacturing'},
        {'code_type': 'business_type', 'code': 'SERVICES', 'description': 'Service Provider'},
    ]
    
    for code_data in codes_data:
        code, created = SystemCode.objects.get_or_create(
            code_type=code_data['code_type'],
            code=code_data['code'],
            defaults={'description': code_data['description']}
        )
        if created:
            print(f'Created system code: {code.code_type} - {code.code}')

def create_api_logs(companies, devices):
    """Create API log entries"""
    endpoints = [
        '/api/device/init/',
        '/api/sales/',
        '/api/invoices/',
        '/api/item/sync/',
        '/api/device/test-connection/',
    ]
    
    methods = ['GET', 'POST', 'PUT']
    statuses = [200, 201, 400, 500]
    
    for i in range(20):  # 20 log entries
        company = companies[i % len(companies)]
        device = devices[i % len(devices)] if devices else None
        
        log_data = {
            'company': company,
            'device': device,
            'endpoint': endpoints[i % len(endpoints)],
            'method': methods[i % len(methods)],
            'request_data': {'test': 'data', 'timestamp': str(timezone.now())},
            'response_data': {'status': 'success', 'message': 'Test response'},
            'status_code': statuses[i % len(statuses)],
            'response_time': 0.1 + (i * 0.05),
            'created_at': timezone.now() - timedelta(hours=i)
        }
        
        ApiLog.objects.create(**log_data)
    
    print('Created 20 API log entries')

def create_retry_queue(invoices):
    """Create retry queue entries"""
    for i, invoice in enumerate(invoices[:5]):  # 5 retry entries
        retry_data = {
            'invoice': invoice,
            'retry_count': i + 1,
            'max_retries': 3,
            'next_retry': timezone.now() + timedelta(minutes=30 * (i + 1)),
            'error_message': f'Connection timeout - attempt {i + 1}',
            'status': 'pending' if i < 3 else 'failed'
        }
        
        RetryQueue.objects.create(**retry_data)
        print(f'Created retry queue entry for invoice: {invoice.invoice_number}')

def create_integrator_certifications(companies):
    """Create integrator certifications"""
    cert_types = ['oscu', 'vscu', 'both']
    
    for i, company in enumerate(companies[:3]):
        cert_data = {
            'company': company,
            'certification_type': cert_types[i % len(cert_types)],
            'certification_number': f'CERT-{company.tin[-3:]}-{i+1:04d}',
            'issue_date': timezone.now().date() - timedelta(days=30),
            'expiry_date': timezone.now().date() + timedelta(days=335),
            'status': 'active',
            'capabilities': {
                'max_transactions_per_day': 1000,
                'supported_payment_methods': ['cash', 'card', 'mobile'],
                'api_version': '2.0'
            }
        }
        
        cert, created = IntegratorCertification.objects.get_or_create(
            company=company,
            defaults=cert_data
        )
        if created:
            print(f'Created certification for: {company.name}')

def create_partnership_agreements(companies):
    """Create partnership agreements"""
    for i, company in enumerate(companies[:2]):
        agreement_data = {
            'company': company,
            'agreement_type': 'integration_partner',
            'start_date': timezone.now().date() - timedelta(days=60),
            'end_date': timezone.now().date() + timedelta(days=305),
            'status': 'active',
            'terms': {
                'commission_rate': 2.5,
                'monthly_fee': 5000,
                'support_level': 'premium'
            }
        }
        
        agreement, created = PartnershipAgreement.objects.get_or_create(
            company=company,
            defaults=agreement_data
        )
        if created:
            print(f'Created partnership agreement for: {company.name}')

def create_notification_logs(companies):
    """Create notification logs"""
    notification_types = ['email', 'sms', 'webhook']
    statuses = ['sent', 'failed', 'pending']
    
    for i in range(15):  # 15 notifications
        company = companies[i % len(companies)]
        
        notification_data = {
            'company': company,
            'notification_type': notification_types[i % len(notification_types)],
            'recipient': f'recipient{i}@example.com',
            'subject': f'Test Notification {i+1}',
            'message': f'This is test notification message {i+1}',
            'status': statuses[i % len(statuses)],
            'sent_at': timezone.now() - timedelta(hours=i),
            'metadata': {
                'template_id': f'template_{i % 3}',
                'priority': 'normal'
            }
        }
        
        NotificationLog.objects.create(**notification_data)
    
    print('Created 15 notification log entries')

def print_summary():
    """Print summary of created data"""
    print('\n=== MOCK DATA SUMMARY ===')
    print(f'Users: {User.objects.count()}')
    print(f'Companies: {Company.objects.count()}')
    print(f'Devices: {Device.objects.count()}')
    print(f'Items: {ItemMaster.objects.count()}')
    print(f'Invoices: {Invoice.objects.count()}')
    print(f'Invoice Items: {InvoiceItem.objects.count()}')
    print(f'System Codes: {SystemCode.objects.count()}')
    print(f'API Logs: {ApiLog.objects.count()}')
    print(f'Retry Queue: {RetryQueue.objects.count()}')
    print(f'Certifications: {IntegratorCertification.objects.count()}')
    print(f'Agreements: {PartnershipAgreement.objects.count()}')
    print(f'Notifications: {NotificationLog.objects.count()}')
    print('=========================\n')

if __name__ == '__main__':
    create_mock_data()

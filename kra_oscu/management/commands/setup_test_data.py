"""
Management command to set up test data for eTIMS OSCU integration.
"""
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token
from kra_oscu.models import Device, ItemMaster, SystemCode


class Command(BaseCommand):
    help = 'Set up test data for eTIMS OSCU integration'

    def add_arguments(self, parser):
        parser.add_argument(
            '--create-user',
            action='store_true',
            help='Create test user with auth token',
        )
        parser.add_argument(
            '--create-device',
            action='store_true',
            help='Create test device',
        )
        parser.add_argument(
            '--create-items',
            action='store_true',
            help='Create sample items',
        )
        parser.add_argument(
            '--all',
            action='store_true',
            help='Create all test data',
        )

    def handle(self, *args, **options):
        if options['all']:
            options['create_user'] = True
            options['create_device'] = True
            options['create_items'] = True

        if options['create_user']:
            self.create_test_user()

        if options['create_device']:
            self.create_test_device()

        if options['create_items']:
            self.create_test_items()

        self.stdout.write(
            self.style.SUCCESS('Test data setup completed successfully!')
        )

    def create_test_user(self):
        """Create test user with auth token"""
        username = 'testuser'
        email = 'test@example.com'
        password = 'testpass123'

        user, created = User.objects.get_or_create(
            username=username,
            defaults={'email': email}
        )

        if created:
            user.set_password(password)
            user.save()
            self.stdout.write(f'Created user: {username}')
        else:
            self.stdout.write(f'User already exists: {username}')

        token, created = Token.objects.get_or_create(user=user)
        
        self.stdout.write(
            self.style.SUCCESS(f'Auth Token: {token.key}')
        )
        self.stdout.write(f'Username: {username}')
        self.stdout.write(f'Password: {password}')

    def create_test_device(self):
        """Create test device for API testing"""
        device_data = {
            'tin': '12345678901',
            'bhf_id': '001',
            'serial_number': 'TEST-POS-001',
            'device_name': 'Test POS Terminal 1',
            'pos_version': '2.1.0',
            'status': 'pending'
        }

        device, created = Device.objects.get_or_create(
            tin=device_data['tin'],
            bhf_id=device_data['bhf_id'],
            serial_number=device_data['serial_number'],
            defaults=device_data
        )

        if created:
            self.stdout.write(f'Created device: {device.device_name}')
        else:
            self.stdout.write(f'Device already exists: {device.device_name}')

        self.stdout.write(f'Device ID: {device.id}')
        self.stdout.write(f'Serial Number: {device.serial_number}')

    def create_test_items(self):
        """Create sample items for testing"""
        items = [
            {
                'item_code': 'ITEM001',
                'item_name': 'Test Product 1',
                'tax_type': 'A',
                'default_price': 100.00,
                'unit_of_measure': 'PCS',
                'description': 'Sample product for testing'
            },
            {
                'item_code': 'ITEM002',
                'item_name': 'Test Service 1',
                'tax_type': 'A',
                'default_price': 500.00,
                'unit_of_measure': 'PCS',
                'description': 'Sample service for testing'
            },
            {
                'item_code': 'CASH001',
                'item_name': 'Cash Sale Item',
                'tax_type': 'A',
                'default_price': 1000.00,
                'unit_of_measure': 'PCS',
                'description': 'Cash sale test item'
            },
            {
                'item_code': 'CARD001',
                'item_name': 'Premium Service',
                'tax_type': 'A',
                'default_price': 2500.00,
                'unit_of_measure': 'PCS',
                'description': 'Premium service for card payments'
            }
        ]

        created_count = 0
        for item_data in items:
            item, created = ItemMaster.objects.get_or_create(
                item_code=item_data['item_code'],
                defaults=item_data
            )
            
            if created:
                created_count += 1
                self.stdout.write(f'Created item: {item.item_name}')
            else:
                self.stdout.write(f'Item already exists: {item.item_name}')

        self.stdout.write(f'Created {created_count} new items')

        # Create system codes
        system_codes = [
            {'code_type': 'tax_type', 'code_value': 'A', 'description': 'VAT Standard Rate (16%)'},
            {'code_type': 'tax_type', 'code_value': 'B', 'description': 'VAT Reduced Rate (8%)'},
            {'code_type': 'tax_type', 'code_value': 'C', 'description': 'VAT Zero Rate (0%)'},
            {'code_type': 'tax_type', 'code_value': 'D', 'description': 'VAT Exempt'},
            {'code_type': 'payment_type', 'code_value': '01', 'description': 'Cash'},
            {'code_type': 'payment_type', 'code_value': '02', 'description': 'Card'},
            {'code_type': 'payment_type', 'code_value': '03', 'description': 'Mobile Money'},
            {'code_type': 'unit_measure', 'code_value': 'PCS', 'description': 'Pieces'},
            {'code_type': 'unit_measure', 'code_value': 'KG', 'description': 'Kilograms'},
        ]

        codes_created = 0
        for code_data in system_codes:
            code, created = SystemCode.objects.get_or_create(
                code_type=code_data['code_type'],
                code_value=code_data['code_value'],
                defaults=code_data
            )
            
            if created:
                codes_created += 1

        self.stdout.write(f'Created {codes_created} new system codes')

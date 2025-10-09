"""
Revpay Connect system initialization management command.
Sets up initial system configuration, creates admin users, and prepares the system for operation.
"""
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from django.conf import settings
import os
import secrets
from cryptography.fernet import Fernet

from ...models import Company, SystemCode


class Command(BaseCommand):
    help = 'Initialize Revpay Connect eTIMS Gateway system'

    def add_arguments(self, parser):
        parser.add_argument(
            '--admin-email',
            type=str,
            help='Admin email address'
        )
        parser.add_argument(
            '--admin-password',
            type=str,
            help='Admin password (will be generated if not provided)'
        )
        parser.add_argument(
            '--company-name',
            type=str,
            default='Revpay Connect Ltd',
            help='System company name'
        )
        parser.add_argument(
            '--skip-encryption-key',
            action='store_true',
            help='Skip encryption key generation'
        )

    def handle(self, *args, **options):
        self.stdout.write(
            self.style.SUCCESS('🚀 Revpay Connect eTIMS Gateway - System Initialization')
        )
        self.stdout.write('=' * 70)
        
        # 1. Generate encryption key if needed
        if not options['skip_encryption_key']:
            self._setup_encryption_key()
        
        # 2. Create admin user
        admin_email = options.get('admin_email') or 'admin@revpayconnect.com'
        admin_password = options.get('admin_password') or self._generate_password()
        self._create_admin_user(admin_email, admin_password)
        
        # 3. Initialize system codes
        self._initialize_system_codes()
        
        # 4. Create system company (for internal operations)
        company_name = options.get('company_name')
        self._create_system_company(company_name)
        
        # 5. Display setup summary
        self._display_setup_summary(admin_email, admin_password)

    def _setup_encryption_key(self):
        """Generate and save encryption key for sensitive data"""
        self.stdout.write('\n🔐 Setting up encryption key...')
        
        # Check if key already exists
        if hasattr(settings, 'ENCRYPTION_KEY') and settings.ENCRYPTION_KEY:
            self.stdout.write('✅ Encryption key already configured')
            return
        
        # Generate new key
        key = Fernet.generate_key()
        
        # Save to environment file
        env_file_path = os.path.join(settings.BASE_DIR, '.env')
        
        try:
            # Read existing .env file
            env_lines = []
            if os.path.exists(env_file_path):
                with open(env_file_path, 'r') as f:
                    env_lines = f.readlines()
            
            # Remove existing ENCRYPTION_KEY line if present
            env_lines = [line for line in env_lines if not line.startswith('ENCRYPTION_KEY=')]
            
            # Add new encryption key
            env_lines.append(f'ENCRYPTION_KEY={key.decode()}\n')
            
            # Write back to file
            with open(env_file_path, 'w') as f:
                f.writelines(env_lines)
            
            self.stdout.write('✅ Encryption key generated and saved to .env file')
            self.stdout.write('⚠️  Please restart the application to load the new key')
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ Failed to save encryption key: {str(e)}'))
            self.stdout.write(f'🔑 Manual key (add to .env): ENCRYPTION_KEY={key.decode()}')

    def _generate_password(self):
        """Generate a secure random password"""
        return secrets.token_urlsafe(16)

    def _create_admin_user(self, email, password):
        """Create admin user for system management"""
        self.stdout.write('\n👤 Creating admin user...')
        
        try:
            # Check if admin user already exists
            if User.objects.filter(email=email).exists():
                self.stdout.write(f'✅ Admin user with email {email} already exists')
                return
            
            # Create superuser
            admin_user = User.objects.create_superuser(
                username='admin',
                email=email,
                password=password,
                first_name='Revpay',
                last_name='Administrator'
            )
            
            self.stdout.write(f'✅ Admin user created successfully')
            self.stdout.write(f'   📧 Email: {email}')
            self.stdout.write(f'   🔑 Password: {password}')
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ Failed to create admin user: {str(e)}'))

    def _initialize_system_codes(self):
        """Initialize default system codes"""
        self.stdout.write('\n📋 Initializing system codes...')
        
        # Default tax types
        tax_types = [
            ('A', 'VAT Standard Rate (16%)'),
            ('B', 'VAT Reduced Rate (8%)'),
            ('C', 'VAT Zero Rate (0%)'),
            ('D', 'VAT Exempt'),
            ('E', 'Special Tax'),
        ]
        
        # Default payment types
        payment_types = [
            ('CASH', 'Cash Payment'),
            ('CARD', 'Credit/Debit Card'),
            ('MOBILE', 'Mobile Money'),
            ('BANK', 'Bank Transfer'),
            ('CREDIT', 'Credit Sale'),
        ]
        
        # Default units of measure
        units_of_measure = [
            ('PCS', 'Pieces'),
            ('KG', 'Kilograms'),
            ('LTR', 'Litres'),
            ('MTR', 'Metres'),
            ('BOX', 'Boxes'),
            ('PKT', 'Packets'),
        ]
        
        # Currency codes
        currencies = [
            ('KES', 'Kenyan Shilling'),
            ('USD', 'US Dollar'),
            ('EUR', 'Euro'),
        ]
        
        created_count = 0
        
        # Create tax types
        for code, description in tax_types:
            obj, created = SystemCode.objects.get_or_create(
                code_type='tax_type',
                code_value=code,
                defaults={'description': description, 'is_active': True}
            )
            if created:
                created_count += 1
        
        # Create payment types
        for code, description in payment_types:
            obj, created = SystemCode.objects.get_or_create(
                code_type='payment_type',
                code_value=code,
                defaults={'description': description, 'is_active': True}
            )
            if created:
                created_count += 1
        
        # Create units of measure
        for code, description in units_of_measure:
            obj, created = SystemCode.objects.get_or_create(
                code_type='unit_measure',
                code_value=code,
                defaults={'description': description, 'is_active': True}
            )
            if created:
                created_count += 1
        
        # Create currencies
        for code, description in currencies:
            obj, created = SystemCode.objects.get_or_create(
                code_type='currency',
                code_value=code,
                defaults={'description': description, 'is_active': True}
            )
            if created:
                created_count += 1
        
        self.stdout.write(f'✅ System codes initialized ({created_count} new codes created)')

    def _create_system_company(self, company_name):
        """Create system company for internal operations"""
        self.stdout.write('\n🏢 Creating system company...')
        
        try:
            # Check if system company already exists
            system_tin = '00000000000'  # Special TIN for system company
            
            if Company.objects.filter(tin=system_tin).exists():
                self.stdout.write('✅ System company already exists')
                return
            
            # Create system company
            system_company = Company.objects.create(
                company_name=company_name,
                tin=system_tin,
                contact_person='System Administrator',
                contact_email='admin@revpayconnect.com',
                contact_phone='+254700000000',
                business_address='Nairobi, Kenya',
                business_type='Technology Services',
                status='active',
                is_sandbox=False,
                subscription_plan='enterprise'
            )
            
            self.stdout.write(f'✅ System company "{company_name}" created successfully')
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ Failed to create system company: {str(e)}'))

    def _display_setup_summary(self, admin_email, admin_password):
        """Display setup summary and next steps"""
        self.stdout.write('\n📋 Setup Summary')
        self.stdout.write('=' * 70)
        
        self.stdout.write(self.style.SUCCESS('🎉 Revpay Connect eTIMS Gateway initialized successfully!'))
        
        self.stdout.write('\n📊 System Information:')
        self.stdout.write(f'   🏢 Companies: {Company.objects.count()}')
        self.stdout.write(f'   📋 System Codes: {SystemCode.objects.count()}')
        self.stdout.write(f'   👥 Users: {User.objects.count()}')
        
        self.stdout.write('\n🔐 Admin Credentials:')
        self.stdout.write(f'   📧 Email: {admin_email}')
        self.stdout.write(f'   🔑 Password: {admin_password}')
        self.stdout.write('   🌐 Admin URL: /admin/')
        
        self.stdout.write('\n🚀 Next Steps:')
        self.stdout.write('   1. Start the Django development server or deploy to production')
        self.stdout.write('   2. Access the admin interface to manage the system')
        self.stdout.write('   3. Use the onboarding API to register client companies')
        self.stdout.write('   4. Configure KRA environment settings (sandbox/production)')
        self.stdout.write('   5. Set up monitoring and alerting')
        
        self.stdout.write('\n📚 API Documentation:')
        self.stdout.write('   🔗 Health Check: GET /health/')
        self.stdout.write('   🔗 Client Onboarding: POST /api/onboard/')
        self.stdout.write('   🔗 System Dashboard: GET /api/dashboard/')
        self.stdout.write('   🔗 Integration Docs: Available in README.md')
        
        self.stdout.write('\n💡 Support:')
        self.stdout.write('   📧 Email: support@revpayconnect.com')
        self.stdout.write('   📖 Documentation: Check README.md for detailed setup')
        
        self.stdout.write('\n' + '=' * 70)
        self.stdout.write(self.style.SUCCESS('✨ Welcome to Revpay Connect eTIMS Gateway! ✨'))

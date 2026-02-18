"""
Django management command to seed subscription plans
Run with: python manage.py seed_plans
"""
from django.core.management.base import BaseCommand
from kra_oscu.models import SubscriptionPlan
from decimal import Decimal


class Command(BaseCommand):
    help = 'Seed subscription plans into the database'

    def handle(self, *args, **options):
        self.stdout.write('Creating subscription plans...')
        
        plans = [
            {
                'name': 'Free Trial',
                'plan_type': 'free',
                'description': '30-day free trial with 100 invoices per month. Perfect for testing.',
                'price': Decimal('0.00'),
                'currency': 'KES',
                'billing_cycle': 'monthly',
                'invoice_limit_per_month': 100,
                'device_limit': 1,
                'user_limit': 1,
                'trial_days': 30,
                'is_active': True,
                'is_popular': False,
                'sort_order': 1,
                'features': {
                    'real_time_kra': True,
                    'mobile_app': True,
                    'basic_reports': True,
                    'email_support': True,
                }
            },
            {
                'name': 'Starter',
                'plan_type': 'starter',
                'description': 'Perfect for small businesses. 500 invoices per month.',
                'price': Decimal('2999.00'),
                'currency': 'KES',
                'billing_cycle': 'monthly',
                'invoice_limit_per_month': 500,
                'device_limit': 2,
                'user_limit': 2,
                'trial_days': 14,
                'is_active': True,
                'is_popular': False,
                'sort_order': 2,
                'features': {
                    'real_time_kra': True,
                    'mobile_app': True,
                    'basic_reports': True,
                    'advanced_reports': True,
                    'email_support': True,
                    'api_access': True,
                }
            },
            {
                'name': 'Business',
                'plan_type': 'business',
                'description': 'Most popular! Unlimited invoices, multiple devices.',
                'price': Decimal('7999.00'),
                'currency': 'KES',
                'billing_cycle': 'monthly',
                'invoice_limit_per_month': -1,
                'device_limit': 5,
                'user_limit': 5,
                'trial_days': 14,
                'is_active': True,
                'is_popular': True,
                'sort_order': 3,
                'features': {
                    'real_time_kra': True,
                    'mobile_app': True,
                    'basic_reports': True,
                    'advanced_reports': True,
                    'custom_reports': True,
                    'email_support': True,
                    'phone_support': True,
                    'api_access': True,
                    'priority_support': True,
                    'multi_branch': True,
                }
            },
        ]
        
        created_count = 0
        updated_count = 0
        
        for plan_data in plans:
            # Use get_or_create with plan_type as unique identifier
            plan, created = SubscriptionPlan.objects.get_or_create(
                plan_type=plan_data['plan_type'],
                defaults=plan_data
            )
            
            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f'✓ Created plan: {plan.name}'))
            else:
                # Update existing plan
                for key, value in plan_data.items():
                    setattr(plan, key, value)
                plan.save()
                updated_count += 1
                self.stdout.write(self.style.WARNING(f'↻ Updated plan: {plan.name}'))
        
        self.stdout.write(self.style.SUCCESS(f'\n✓ Done! Created {created_count} plans, updated {updated_count} plans'))
        self.stdout.write(f'Total plans in database: {SubscriptionPlan.objects.count()}')

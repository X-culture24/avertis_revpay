#!/usr/bin/env python3
"""
Seed subscription plans into the database
Run with: python manage.py shell < scripts/seed_subscription_plans.py
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'etims_integration.settings')
django.setup()

from kra_oscu.models import SubscriptionPlan
from decimal import Decimal

def create_subscription_plans():
    """Create default subscription plans"""
    
    plans = [
        {
            'id': 'free-plan',
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
                'api_access': False,
                'priority_support': False,
                'custom_branding': False,
                'multi_branch': False,
            }
        },
        {
            'id': 'starter-plan',
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
                'priority_support': False,
                'custom_branding': False,
                'multi_branch': False,
            }
        },
        {
            'id': 'business-plan',
            'name': 'Business',
            'plan_type': 'business',
            'description': 'Most popular! Unlimited invoices, multiple devices.',
            'price': Decimal('7999.00'),
            'currency': 'KES',
            'billing_cycle': 'monthly',
            'invoice_limit_per_month': -1,  # Unlimited
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
                'custom_branding': False,
                'multi_branch': True,
                'bulk_operations': True,
            }
        },
        {
            'id': 'enterprise-plan',
            'name': 'Enterprise',
            'plan_type': 'enterprise',
            'description': 'For large businesses. Unlimited everything + dedicated support.',
            'price': Decimal('19999.00'),
            'currency': 'KES',
            'billing_cycle': 'monthly',
            'invoice_limit_per_month': -1,  # Unlimited
            'device_limit': -1,  # Unlimited
            'user_limit': -1,  # Unlimited
            'trial_days': 30,
            'is_active': True,
            'is_popular': False,
            'sort_order': 4,
            'features': {
                'real_time_kra': True,
                'mobile_app': True,
                'basic_reports': True,
                'advanced_reports': True,
                'custom_reports': True,
                'email_support': True,
                'phone_support': True,
                'dedicated_support': True,
                'api_access': True,
                'priority_support': True,
                'custom_branding': True,
                'white_label': True,
                'multi_branch': True,
                'bulk_operations': True,
                'custom_integrations': True,
                'sla_guarantee': True,
            }
        },
    ]
    
    created_count = 0
    updated_count = 0
    
    for plan_data in plans:
        plan_id = plan_data.pop('id')
        plan, created = SubscriptionPlan.objects.update_or_create(
            id=plan_id,
            defaults=plan_data
        )
        
        if created:
            created_count += 1
            print(f"✓ Created plan: {plan.name}")
        else:
            updated_count += 1
            print(f"↻ Updated plan: {plan.name}")
    
    print(f"\n✓ Done! Created {created_count} plans, updated {updated_count} plans")
    print(f"Total plans in database: {SubscriptionPlan.objects.count()}")

if __name__ == "__main__":
    print("Creating subscription plans...")
    create_subscription_plans()

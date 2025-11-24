"""
Script to set up trial subscriptions for existing companies
Run this to initialize subscription data for testing
"""
import os
import sys
import django
from datetime import timedelta

# Setup Django environment
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'etims_integration.settings')
django.setup()

from django.utils import timezone
from kra_oscu.models import Company

def setup_trial_subscriptions():
    """Set up trial subscriptions for all companies"""
    
    companies = Company.objects.all()
    
    print(f"Found {companies.count()} companies")
    
    for company in companies:
        # Check if subscription is already set up
        if company.trial_ends_at:
            print(f"Subscription already configured for {company.company_name}")
            continue
        
        # Set up 7-day trial
        company.subscription_plan = 'free'
        company.subscription_status = 'trial'
        company.subscription_start_date = timezone.now()
        company.trial_ends_at = timezone.now() + timedelta(days=7)
        company.subscription_ends_at = None
        company.auto_renew = True
        company.last_payment_date = None
        
        company.save()
        
        print(f"✅ Set up trial for {company.company_name}")
        print(f"   - Plan: {company.subscription_plan}")
        print(f"   - Status: {company.subscription_status}")
        print(f"   - Trial ends: {company.trial_ends_at}")
    
    print("\n✅ Trial subscriptions setup complete!")

def setup_test_scenarios():
    """Set up different subscription scenarios for testing"""
    
    companies = list(Company.objects.all())
    
    if len(companies) == 0:
        print("No companies found. Create some companies first.")
        return
    
    # Scenario 1: Trial ending soon (1 day left)
    if len(companies) >= 1:
        company = companies[0]
        company.subscription_status = 'trial'
        company.subscription_plan = 'free'
        company.trial_ends_at = timezone.now() + timedelta(days=1)
        company.save()
        print(f"✅ {company.company_name}: Trial ending in 1 day")
    
    # Scenario 2: Active subscription
    if len(companies) >= 2:
        company = companies[1]
        company.subscription_status = 'active'
        company.subscription_plan = 'starter'
        company.subscription_start_date = timezone.now() - timedelta(days=15)
        company.subscription_ends_at = timezone.now() + timedelta(days=15)
        company.trial_ends_at = None
        company.last_payment_date = timezone.now() - timedelta(days=15)
        company.save()
        print(f"✅ {company.company_name}: Active starter subscription")
    
    # Scenario 3: Expired subscription
    if len(companies) >= 3:
        company = companies[2]
        company.subscription_status = 'expired'
        company.subscription_plan = 'starter'
        company.subscription_start_date = timezone.now() - timedelta(days=60)
        company.subscription_ends_at = timezone.now() - timedelta(days=5)
        company.trial_ends_at = None
        company.save()
        print(f"✅ {company.company_name}: Expired subscription")
    
    print("\n✅ Test scenarios setup complete!")

if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Setup subscription data')
    parser.add_argument('--test-scenarios', action='store_true', 
                       help='Set up different test scenarios')
    
    args = parser.parse_args()
    
    if args.test_scenarios:
        setup_test_scenarios()
    else:
        setup_trial_subscriptions()

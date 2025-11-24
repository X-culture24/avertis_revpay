"""
Subscription and Payment Management Views
Handles subscription plans, payments, billing, and M-Pesa integration
"""
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
import logging

from .models import Company
from .serializers import CompanySerializer

logger = logging.getLogger(__name__)


# Subscription Plans Configuration
SUBSCRIPTION_PLANS = {
    'free': {
        'name': 'Free',
        'price': 0,
        'currency': 'KES',
        'interval': 'monthly',
        'features': [
            'Up to 10 invoices per month',
            '1 device',
            'Basic reporting',
            'Email support',
            'VSCU mode only',
        ],
        'limits': {
            'invoices': 10,
            'devices': 1,
            'users': 1,
            'storage_mb': 100,
        }
    },
    'starter': {
        'name': 'Starter',
        'price': 2000,
        'currency': 'KES',
        'interval': 'monthly',
        'features': [
            'Up to 100 invoices per month',
            '1 device',
            'Basic reporting',
            'Email support',
            'OSCU & VSCU modes',
        ],
        'limits': {
            'invoices': 100,
            'devices': 1,
            'users': 1,
            'storage_mb': 500,
        }
    },
    'business': {
        'name': 'Business',
        'price': 5000,
        'currency': 'KES',
        'interval': 'monthly',
        'features': [
            'Up to 500 invoices per month',
            'Up to 3 devices',
            'Advanced reporting',
            'Priority email support',
            'OSCU & VSCU modes',
            'Compliance reports',
            'Data export',
        ],
        'limits': {
            'invoices': 500,
            'devices': 3,
            'users': 3,
            'storage_mb': 2000,
        }
    },
    'enterprise': {
        'name': 'Enterprise',
        'price': 15000,
        'currency': 'KES',
        'interval': 'monthly',
        'features': [
            'Unlimited invoices',
            'Unlimited devices',
            'Custom reporting',
            '24/7 phone & email support',
            'OSCU & VSCU modes',
            'Compliance reports',
            'Data export',
            'API access',
            'Dedicated account manager',
            'Custom integrations',
        ],
        'limits': {
            'invoices': -1,  # -1 means unlimited
            'devices': 999,
            'users': 10,
            'storage_mb': 10000,
        }
    },
}


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_subscription_plans(request):
    """Get available subscription plans"""
    return Response({
        'plans': SUBSCRIPTION_PLANS
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_current_subscription(request):
    """Get current subscription details"""
    try:
        company = Company.objects.get(contact_email=request.user.email)
        
        # Get current plan details
        plan_id = company.subscription_plan or 'free'
        plan_details = SUBSCRIPTION_PLANS.get(plan_id, SUBSCRIPTION_PLANS['free'])
        
        # Calculate usage
        from .models import Invoice
        current_month_start = timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        invoices_this_month = Invoice.objects.filter(
            company=company,
            created_at__gte=current_month_start
        ).count()
        
        # Calculate days remaining
        days_remaining = 0
        if company.subscription_ends_at:
            days_remaining = (company.subscription_ends_at - timezone.now()).days
        
        # Determine if in trial
        is_trial = company.subscription_status == 'trial'
        trial_days_left = 0
        if is_trial and company.trial_ends_at:
            trial_days_left = (company.trial_ends_at - timezone.now()).days
        
        return Response({
            'subscription': {
                'plan': plan_id,
                'plan_name': plan_details['name'],
                'status': company.subscription_status,
                'price': plan_details['price'],
                'currency': plan_details['currency'],
                'start_date': company.subscription_start_date.isoformat() if company.subscription_start_date else None,
                'end_date': company.subscription_ends_at.isoformat() if company.subscription_ends_at else None,
                'trial_ends_at': company.trial_ends_at.isoformat() if company.trial_ends_at else None,
                'auto_renew': True,  # TODO: Add auto_renew field to Company model
                'days_remaining': days_remaining,
                'is_trial': is_trial,
                'trial_days_left': trial_days_left,
                'invoices_used': invoices_this_month,
                'invoices_limit': plan_details['limits']['invoices'],
                'devices_used': company.devices.count(),
                'devices_limit': plan_details['limits']['devices'],
                'features': plan_details['features'],
                'limits': plan_details['limits'],
            }
        })
        
    except Company.DoesNotExist:
        return Response(
            {'error': 'Company not found'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def upgrade_subscription(request):
    """Upgrade or change subscription plan"""
    try:
        company = Company.objects.get(contact_email=request.user.email)
        new_plan = request.data.get('plan')
        
        if new_plan not in SUBSCRIPTION_PLANS:
            return Response(
                {'error': 'Invalid plan selected'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        plan_details = SUBSCRIPTION_PLANS[new_plan]
        
        # For free plan, just update
        if plan_details['price'] == 0:
            company.subscription_plan = new_plan
            company.subscription_status = 'active'
            company.save()
            
            return Response({
                'message': f'Successfully changed to {plan_details["name"]} plan',
                'plan': new_plan
            })
        
        # For paid plans, initiate payment
        payment_data = {
            'plan': new_plan,
            'plan_name': plan_details['name'],
            'amount': plan_details['price'],
            'currency': plan_details['currency'],
            'payment_required': True,
            'payment_methods': ['mpesa', 'card', 'bank_transfer'],
        }
        
        return Response(payment_data)
        
    except Company.DoesNotExist:
        return Response(
            {'error': 'Company not found'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def initiate_mpesa_payment(request):
    """Initiate M-Pesa STK Push payment"""
    try:
        company = Company.objects.get(contact_email=request.user.email)
        amount = request.data.get('amount')
        phone_number = request.data.get('phone_number')
        plan = request.data.get('plan', 'starter')
        
        if not amount or not phone_number:
            return Response(
                {'error': 'Amount and phone number required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # TODO: Integrate with actual M-Pesa API (Daraja API)
        # For now, simulate payment initiation
        
        logger.info(f"M-Pesa payment initiated: {amount} KES for {company.company_name}")
        
        return Response({
            'message': 'Payment initiated. Please check your phone for M-Pesa prompt.',
            'transaction_id': f'MOCK_TXN_{timezone.now().timestamp()}',
            'amount': amount,
            'phone_number': phone_number,
            'status': 'pending',
        })
        
    except Company.DoesNotExist:
        return Response(
            {'error': 'Company not found'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['POST'])
@permission_classes([permissions.AllowAny])  # Webhook from M-Pesa
def mpesa_callback(request):
    """Handle M-Pesa payment callback"""
    try:
        # TODO: Verify M-Pesa signature
        # TODO: Extract payment data from callback
        
        transaction_id = request.data.get('transaction_id')
        result_code = request.data.get('result_code', '0')
        
        if result_code == '0':  # Success
            # Update subscription status
            # Find company by transaction_id
            # company.subscription_status = 'active'
            # company.subscription_start_date = timezone.now()
            # company.subscription_ends_at = timezone.now() + timedelta(days=30)
            # company.save()
            
            logger.info(f"M-Pesa payment successful: {transaction_id}")
            
        return Response({'message': 'Callback received'})
        
    except Exception as e:
        logger.error(f"M-Pesa callback error: {str(e)}")
        return Response(
            {'error': 'Callback processing failed'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def cancel_subscription(request):
    """Cancel subscription"""
    try:
        company = Company.objects.get(contact_email=request.user.email)
        
        # Mark as cancelled but keep active until end date
        company.subscription_status = 'cancelled'
        company.save()
        
        return Response({
            'message': f'Subscription cancelled. Access will continue until {company.subscription_ends_at}',
            'end_date': company.subscription_ends_at.isoformat() if company.subscription_ends_at else None
        })
        
    except Company.DoesNotExist:
        return Response(
            {'error': 'Company not found'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_billing_history(request):
    """Get billing and payment history"""
    try:
        company = Company.objects.get(contact_email=request.user.email)
        
        # TODO: Implement actual payment history from database
        # For now, return mock data
        mock_history = [
            {
                'id': '1',
                'date': (timezone.now() - timedelta(days=30)).isoformat(),
                'description': f'{company.subscription_plan} Plan - Monthly',
                'amount': SUBSCRIPTION_PLANS.get(company.subscription_plan or 'free', {}).get('price', 0),
                'currency': 'KES',
                'status': 'paid',
                'payment_method': 'M-Pesa',
            }
        ]
        
        return Response({
            'billing_history': mock_history
        })
        
    except Company.DoesNotExist:
        return Response(
            {'error': 'Company not found'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def check_subscription_limits(request):
    """Check if action is within subscription limits"""
    try:
        company = Company.objects.get(contact_email=request.user.email)
        action = request.data.get('action')  # 'create_invoice', 'add_device', etc.
        
        plan_id = company.subscription_plan or 'free'
        plan_limits = SUBSCRIPTION_PLANS[plan_id]['limits']
        
        # Check subscription status
        if company.subscription_status in ['expired', 'cancelled']:
            return Response({
                'allowed': False,
                'reason': 'subscription_expired',
                'message': 'Your subscription has expired. Please renew to continue.'
            })
        
        # Check specific limits
        if action == 'create_invoice':
            from .models import Invoice
            current_month_start = timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            invoices_count = Invoice.objects.filter(
                company=company,
                created_at__gte=current_month_start
            ).count()
            
            invoice_limit = plan_limits['invoices']
            if invoice_limit != -1 and invoices_count >= invoice_limit:
                return Response({
                    'allowed': False,
                    'reason': 'invoice_limit_reached',
                    'message': f'Monthly invoice limit reached ({invoice_limit}). Upgrade to create more.',
                    'current_usage': invoices_count,
                    'limit': invoice_limit
                })
        
        elif action == 'add_device':
            devices_count = company.devices.count()
            device_limit = plan_limits['devices']
            
            if devices_count >= device_limit:
                return Response({
                    'allowed': False,
                    'reason': 'device_limit_reached',
                    'message': f'Device limit reached ({device_limit}). Upgrade to add more devices.',
                    'current_usage': devices_count,
                    'limit': device_limit
                })
        
        return Response({
            'allowed': True,
            'message': 'Action allowed'
        })
        
    except Company.DoesNotExist:
        return Response(
            {'error': 'Company not found'},
            status=status.HTTP_404_NOT_FOUND
        )

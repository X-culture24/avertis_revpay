"""
Mobile API Views for Revpay Connect eTIMS Integration
Provides mobile-optimized endpoints for the React Native app
"""

from django.shortcuts import render
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from django.db.models import Sum, Count, Q, Max
from django.utils import timezone
from decimal import Decimal
import uuid
import logging

from .models import Company, Device, Invoice, InvoiceItem, ApiLog
from .serializers import InvoiceSerializer, DeviceSerializer
from .api_views import dashboard_stats
from .services.digitax_service import DigiTaxService

logger = logging.getLogger(__name__)

@api_view(['POST'])
@permission_classes([AllowAny])
def mobile_login(request):
    """Mobile login endpoint - returns JWT tokens"""
    try:
        username = request.data.get('username')
        password = request.data.get('password')
        
        if not username or not password:
            return Response({
                'error': 'Username and password are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        user = authenticate(username=username, password=password)
        if not user:
            return Response({
                'error': 'Invalid credentials'
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        # Generate JWT tokens (using existing JWT setup)
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken.for_user(user)
        
        # Get user's company info
        try:
            company = Company.objects.get(contact_email=user.email)
            user_data = {
                'id': user.id,
                'email': user.email,
                'businessName': company.business_name,
                'company': {
                    'tin': company.tin,
                    'business_name': company.business_name,
                }
            }
        except Company.DoesNotExist:
            user_data = {
                'id': user.id,
                'email': user.email,
                'businessName': user.email,
            }
        
        return Response({
            'tokens': {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            },
            'user': user_data
        })
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def mobile_dashboard_stats(request):
    """Mobile dashboard statistics - reuses existing dashboard_stats"""
    return dashboard_stats(request)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def mobile_invoices_handler(request):
    """Handle both GET (list) and POST (create) for invoices"""
    if request.method == 'GET':
        return mobile_invoices_list(request)
    elif request.method == 'POST':
        return mobile_create_invoice(request)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def mobile_invoices_list(request):
    """List invoices for mobile app"""
    try:
        company = Company.objects.get(contact_email=request.user.email)
        
        # Get pagination parameters
        page = int(request.GET.get('page', 1))
        limit = int(request.GET.get('limit', 20))
        offset = (page - 1) * limit
        
        # Get invoices
        invoices = Invoice.objects.filter(company=company).order_by('-created_at')
        
        # Filter by status if provided
        status_filter = request.GET.get('status')
        if status_filter:
            invoices = invoices.filter(status=status_filter)
        
        total_count = invoices.count()
        invoices_page = invoices[offset:offset + limit]
        
        # Serialize invoices
        serializer = InvoiceSerializer(invoices_page, many=True)
        
        return Response({
            'results': serializer.data,
            'count': total_count,
            'page': page,
            'total_pages': (total_count + limit - 1) // limit,
        })
        
    except Company.DoesNotExist:
        return Response({
            'error': 'Company not found'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mobile_create_invoice(request):
    """Create invoice via mobile app"""
    try:
        company = Company.objects.get(contact_email=request.user.email)
        
        # Get the first active device for this company
        device = Device.objects.filter(company=company, status='active').first()
        if not device:
            return Response({
                'error': 'No active device found for this company'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Basic validation - simplified for DigiTax integration
        if not request.data.get('items') or len(request.data.get('items', [])) == 0:
            return Response({
                'error': 'At least one item is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Generate sequential invoice number
        invoice_no = device.get_next_receipt_number()
        
        # Create invoice data
        invoice_data = {
            'company': company,
            'device': device,
            'tin': request.data.get('tin', company.tin),
            'invoice_no': invoice_no,
            'customer_name': request.data.get('customer_name', ''),
            'customer_tin': request.data.get('customer_tin', ''),
            'total_amount': Decimal(str(request.data.get('total_amount', 0))),
            'tax_amount': Decimal(str(request.data.get('tax_amount', 0))),
            'currency': request.data.get('currency', 'KES'),
            'payment_type': request.data.get('payment_type', 'CASH'),
            'receipt_type': request.data.get('receipt_type', 'normal'),
            'transaction_type': request.data.get('transaction_type', 'sale'),
            'transaction_date': timezone.now(),
            'device_serial_number': request.data.get('device_serial_number', device.serial_number),
            'status': 'pending'
        }
        
        # Create invoice
        invoice = Invoice.objects.create(**invoice_data)
        
        # Create invoice items
        items_data = request.data.get('items', [])
        for item_data in items_data:
            InvoiceItem.objects.create(
                invoice=invoice,
                item_code=item_data.get('item_code', 'ITEM001'),
                item_name=item_data.get('item_name', ''),
                quantity=Decimal(str(item_data.get('quantity', 0))),
                unit_price=Decimal(str(item_data.get('unit_price', 0))),
                tax_type=item_data.get('tax_type', 'B'),
                tax_rate=Decimal(str(item_data.get('tax_rate', 16))),
                unit_of_measure=item_data.get('unit_of_measure', 'EA')
            )
        
        # Submit to KRA via DigiTax in real-time
        digitax_service = DigiTaxService()
        success, message, response_data = digitax_service.submit_invoice_realtime(invoice)
        
        # Return response with KRA submission status
        serializer = InvoiceSerializer(invoice)
        response_status = status.HTTP_201_CREATED if success else status.HTTP_207_MULTI_STATUS
        
        return Response({
            'message': message,
            'invoice': serializer.data,
            'kra_status': 'confirmed' if success else 'failed',
            'etr_number': invoice.receipt_no if success else None,
            'digitax_response': response_data
        }, status=response_status)
        
    except Company.DoesNotExist:
        return Response({
            'error': 'Company not found'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def mobile_invoice_details(request, invoice_id):
    """Get invoice details for mobile app"""
    try:
        company = Company.objects.get(contact_email=request.user.email)
        invoice = Invoice.objects.get(id=invoice_id, company=company)
        
        serializer = InvoiceSerializer(invoice)
        return Response(serializer.data)
        
    except (Company.DoesNotExist, Invoice.DoesNotExist):
        return Response({
            'error': 'Invoice not found'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mobile_resync_invoice(request, invoice_id):
    """Resync invoice for mobile app"""
    try:
        company = Company.objects.get(contact_email=request.user.email)
        invoice = Invoice.objects.get(id=invoice_id, company=company)
        
        # Submit to retry queue
        from .tasks import submit_invoice_to_kra
        submit_invoice_to_kra.delay(str(invoice.id))
        
        return Response({
            'message': 'Invoice queued for resync'
        })
        
    except (Company.DoesNotExist, Invoice.DoesNotExist):
        return Response({
            'error': 'Invoice not found'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def mobile_receipt_data(request, invoice_id):
    """Get receipt data for mobile app"""
    try:
        company = Company.objects.get(contact_email=request.user.email)
        invoice = Invoice.objects.get(id=invoice_id, company=company)
        
        receipt_data = {
            'invoice_no': invoice.invoice_no,
            'receipt_no': invoice.receipt_no,
            'customer_name': invoice.customer_name,
            'total_amount': str(invoice.total_amount),
            'tax_amount': str(invoice.tax_amount),
            'transaction_date': invoice.transaction_date,
            'status': invoice.status,
        }
        
        return Response(receipt_data)
        
    except (Company.DoesNotExist, Invoice.DoesNotExist):
        return Response({
            'error': 'Invoice not found'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def mobile_notifications(request):
    """Get notifications for mobile app"""
    try:
        # Return empty notifications for now
        return Response({
            'notifications': []
        })
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def digitax_callback(request):
    """Handle DigiTax webhook callbacks for real-time KRA updates"""
    try:
        from .services.digitax_service import handle_digitax_callback
        
        logger.info(f"DigiTax callback received: {request.data}")
        
        success = handle_digitax_callback(request.data)
        
        if success:
            return Response({'status': 'success'}, status=status.HTTP_200_OK)
        else:
            return Response({'status': 'error'}, status=status.HTTP_400_BAD_REQUEST)
            
    except Exception as e:
        logger.error(f"DigiTax callback error: {e}")
        return Response({'status': 'error', 'message': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

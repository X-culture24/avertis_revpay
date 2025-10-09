"""
Revpay Connect integration layer for POS/ERP systems.
Provides standardized endpoints for external system integration.
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db import transaction
from django.utils import timezone
from django.conf import settings
import json
import logging
from decimal import Decimal

from .models import Company, Device, Invoice, InvoiceItem, ItemMaster, ApiLog
from .serializers import (
    InvoiceSerializer, DeviceSerializer, ItemMasterSerializer,
    SalesRequestSerializer, SalesResponseSerializer
)
from .services.kra_client import KRAClient
from .tasks import retry_sales_invoice, send_notification_task

logger = logging.getLogger(__name__)


class IntegrationPayloadValidator:
    """Validates integration payloads from POS/ERP systems"""
    
    @staticmethod
    def validate_sales_payload(data):
        """Validate sales transaction payload"""
        required_fields = [
            'company_id', 'device_serial', 'invoice_number', 'transaction_date',
            'customer_info', 'payment_info', 'items'
        ]
        
        errors = []
        
        # Check required fields
        for field in required_fields:
            if field not in data:
                errors.append(f"Missing required field: {field}")
        
        # Validate items
        if 'items' in data:
            if not isinstance(data['items'], list) or len(data['items']) == 0:
                errors.append("Items must be a non-empty list")
            else:
                for i, item in enumerate(data['items']):
                    item_errors = IntegrationPayloadValidator._validate_item(item, i)
                    errors.extend(item_errors)
        
        # Validate amounts
        if 'payment_info' in data:
            payment_info = data['payment_info']
            if 'total_amount' not in payment_info:
                errors.append("payment_info.total_amount is required")
            else:
                try:
                    total = Decimal(str(payment_info['total_amount']))
                    if total <= 0:
                        errors.append("total_amount must be greater than 0")
                except (ValueError, TypeError):
                    errors.append("total_amount must be a valid number")
        
        return errors
    
    @staticmethod
    def _validate_item(item, index):
        """Validate individual item in sales payload"""
        errors = []
        required_item_fields = ['item_code', 'item_name', 'quantity', 'unit_price', 'tax_type']
        
        for field in required_item_fields:
            if field not in item:
                errors.append(f"Item {index}: Missing required field '{field}'")
        
        # Validate numeric fields
        if 'quantity' in item:
            try:
                qty = Decimal(str(item['quantity']))
                if qty <= 0:
                    errors.append(f"Item {index}: quantity must be greater than 0")
            except (ValueError, TypeError):
                errors.append(f"Item {index}: quantity must be a valid number")
        
        if 'unit_price' in item:
            try:
                price = Decimal(str(item['unit_price']))
                if price < 0:
                    errors.append(f"Item {index}: unit_price cannot be negative")
            except (ValueError, TypeError):
                errors.append(f"Item {index}: unit_price must be a valid number")
        
        return errors


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def process_sales_transaction(request):
    """
    Process sales transaction from POS/ERP system.
    
    Expected payload format:
    {
        "company_id": "uuid",
        "device_serial": "string",
        "invoice_number": "string",
        "transaction_date": "ISO datetime",
        "customer_info": {
            "tin": "string (optional)",
            "name": "string (optional)"
        },
        "payment_info": {
            "type": "CASH|CARD|MOBILE|BANK|CREDIT",
            "total_amount": "decimal",
            "tax_amount": "decimal",
            "currency": "KES"
        },
        "items": [
            {
                "item_code": "string",
                "item_name": "string",
                "quantity": "decimal",
                "unit_price": "decimal",
                "tax_type": "A|B|C|D|E",
                "tax_rate": "decimal",
                "unit_of_measure": "string"
            }
        ]
    }
    """
    try:
        # Validate payload structure
        validation_errors = IntegrationPayloadValidator.validate_sales_payload(request.data)
        if validation_errors:
            return Response({
                'success': False,
                'error': 'Payload validation failed',
                'details': validation_errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        data = request.data
        
        # Get company and device
        try:
            company = Company.objects.get(id=data['company_id'], status='active')
            device = Device.objects.get(
                serial_number=data['device_serial'],
                company=company,
                status='active'
            )
        except Company.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Company not found or not active'
            }, status=status.HTTP_404_NOT_FOUND)
        except Device.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Device not found or not active for this company'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Check environment compatibility
        environment = getattr(settings, 'KRA_ENVIRONMENT', 'sandbox')
        if company.is_sandbox and environment == 'production':
            return Response({
                'success': False,
                'error': 'Company is in sandbox mode but system is in production'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        with transaction.atomic():
            # Create invoice
            customer_info = data.get('customer_info', {})
            payment_info = data['payment_info']
            
            invoice = Invoice.objects.create(
                company=company,
                device=device,
                invoice_no=data['invoice_number'],
                tin=company.tin,
                total_amount=Decimal(str(payment_info['total_amount'])),
                tax_amount=Decimal(str(payment_info.get('tax_amount', '0.00'))),
                currency=payment_info.get('currency', 'KES'),
                customer_tin=customer_info.get('tin', ''),
                customer_name=customer_info.get('name', ''),
                payment_type=payment_info['type'],
                transaction_date=timezone.now(),
                status='pending'
            )
            
            # Create invoice items
            for item_data in data['items']:
                InvoiceItem.objects.create(
                    invoice=invoice,
                    item_code=item_data['item_code'],
                    item_name=item_data['item_name'],
                    quantity=Decimal(str(item_data['quantity'])),
                    unit_price=Decimal(str(item_data['unit_price'])),
                    tax_type=item_data['tax_type'],
                    tax_rate=Decimal(str(item_data.get('tax_rate', '0.00'))),
                    unit_of_measure=item_data.get('unit_of_measure', 'PCS')
                )
            
            # Log the integration request
            ApiLog.objects.create(
                company=company,
                device=device,
                endpoint='/api/integration/sales/',
                request_type='sales',
                request_payload=json.dumps(request.data),
                response_payload='Invoice created, sending to KRA',
                status_code=201,
                response_time=0.0,
                severity='info',
                user_agent=request.META.get('HTTP_USER_AGENT', ''),
                ip_address=request.META.get('REMOTE_ADDR'),
                environment=environment
            )
            
            # Send to KRA
            try:
                kra_client = KRAClient()
                result = kra_client.send_sales_invoice(invoice)
                
                if result['success']:
                    # Success - update invoice
                    invoice.receipt_no = result.get('receipt_no')
                    invoice.internal_data = result.get('internal_data')
                    invoice.receipt_signature = result.get('receipt_signature')
                    invoice.status = 'confirmed'
                    invoice.save()
                    
                    return Response({
                        'success': True,
                        'invoice_id': str(invoice.id),
                        'receipt_no': invoice.receipt_no,
                        'status': 'confirmed',
                        'message': 'Transaction processed successfully',
                        'kra_response': {
                            'internal_data': invoice.internal_data,
                            'receipt_signature': invoice.receipt_signature
                        }
                    }, status=status.HTTP_201_CREATED)
                    
                else:
                    # KRA submission failed - queue for retry if retryable
                    if result.get('is_retryable', False):
                        invoice.status = 'retry'
                        invoice.save()
                        
                        # Queue retry task
                        retry_sales_invoice.delay(str(invoice.id))
                        
                        return Response({
                            'success': False,
                            'invoice_id': str(invoice.id),
                            'status': 'retry',
                            'message': 'KRA submission failed, queued for retry',
                            'error': result.get('error_message'),
                            'retry_queued': True
                        }, status=status.HTTP_202_ACCEPTED)
                    else:
                        # Permanent failure
                        invoice.status = 'failed'
                        invoice.save()
                        
                        return Response({
                            'success': False,
                            'invoice_id': str(invoice.id),
                            'status': 'failed',
                            'message': 'KRA submission failed permanently',
                            'error': result.get('error_message')
                        }, status=status.HTTP_400_BAD_REQUEST)
                        
            except Exception as e:
                logger.error(f"KRA submission error for invoice {invoice.id}: {str(e)}")
                
                # Queue for retry
                invoice.status = 'retry'
                invoice.save()
                retry_sales_invoice.delay(str(invoice.id))
                
                return Response({
                    'success': False,
                    'invoice_id': str(invoice.id),
                    'status': 'retry',
                    'message': 'KRA submission encountered an error, queued for retry',
                    'error': str(e),
                    'retry_queued': True
                }, status=status.HTTP_202_ACCEPTED)
                
    except Exception as e:
        logger.error(f"Sales transaction processing error: {str(e)}")
        return Response({
            'success': False,
            'error': 'Internal server error',
            'message': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_transaction_status(request, invoice_id):
    """Get the status of a specific transaction"""
    try:
        invoice = Invoice.objects.get(id=invoice_id)
        
        # Check if user has access to this invoice
        # In a real implementation, you'd check user permissions
        
        return Response({
            'invoice_id': str(invoice.id),
            'invoice_number': invoice.invoice_no,
            'status': invoice.status,
            'receipt_no': invoice.receipt_no,
            'total_amount': invoice.total_amount,
            'transaction_date': invoice.transaction_date,
            'created_at': invoice.created_at,
            'updated_at': invoice.updated_at,
            'company': {
                'id': str(invoice.company.id),
                'name': invoice.company.company_name,
                'tin': invoice.company.tin
            },
            'device': {
                'id': str(invoice.device.id),
                'name': invoice.device.device_name,
                'serial': invoice.device.serial_number
            },
            'kra_data': {
                'internal_data': invoice.internal_data,
                'receipt_signature': invoice.receipt_signature
            } if invoice.status == 'confirmed' else None
        })
        
    except Invoice.DoesNotExist:
        return Response({
            'error': 'Transaction not found'
        }, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def sync_item_catalog(request):
    """
    Sync item catalog from POS/ERP system.
    
    Expected payload format:
    {
        "company_id": "uuid",
        "items": [
            {
                "item_code": "string",
                "item_name": "string",
                "item_type": "string (optional)",
                "tax_type": "A|B|C|D|E",
                "default_price": "decimal (optional)",
                "unit_of_measure": "string",
                "description": "string (optional)",
                "category": "string (optional)"
            }
        ]
    }
    """
    try:
        data = request.data
        
        if 'company_id' not in data or 'items' not in data:
            return Response({
                'success': False,
                'error': 'company_id and items are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get company
        try:
            company = Company.objects.get(id=data['company_id'], status='active')
        except Company.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Company not found or not active'
            }, status=status.HTTP_404_NOT_FOUND)
        
        items_data = data['items']
        if not isinstance(items_data, list):
            return Response({
                'success': False,
                'error': 'items must be a list'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        created_count = 0
        updated_count = 0
        errors = []
        
        for i, item_data in enumerate(items_data):
            try:
                # Validate required fields
                required_fields = ['item_code', 'item_name', 'tax_type', 'unit_of_measure']
                missing_fields = [field for field in required_fields if field not in item_data]
                
                if missing_fields:
                    errors.append(f"Item {i}: Missing fields: {missing_fields}")
                    continue
                
                # Create or update item
                item, created = ItemMaster.objects.get_or_create(
                    item_code=item_data['item_code'],
                    defaults={
                        'item_name': item_data['item_name'],
                        'item_type': item_data.get('item_type', ''),
                        'tax_type': item_data['tax_type'],
                        'default_price': Decimal(str(item_data['default_price'])) if item_data.get('default_price') else None,
                        'unit_of_measure': item_data['unit_of_measure'],
                        'description': item_data.get('description', ''),
                        'category': item_data.get('category', ''),
                        'is_active': True
                    }
                )
                
                if created:
                    created_count += 1
                else:
                    # Update existing item
                    item.item_name = item_data['item_name']
                    item.item_type = item_data.get('item_type', '')
                    item.tax_type = item_data['tax_type']
                    if item_data.get('default_price'):
                        item.default_price = Decimal(str(item_data['default_price']))
                    item.unit_of_measure = item_data['unit_of_measure']
                    item.description = item_data.get('description', '')
                    item.category = item_data.get('category', '')
                    item.is_active = True
                    item.save()
                    updated_count += 1
                    
            except Exception as e:
                errors.append(f"Item {i}: {str(e)}")
        
        # Log the sync operation
        ApiLog.objects.create(
            company=company,
            endpoint='/api/integration/items/sync/',
            request_type='item_sync',
            request_payload=json.dumps(request.data),
            response_payload=f'Synced {len(items_data)} items: {created_count} created, {updated_count} updated',
            status_code=200,
            response_time=0.0,
            severity='info',
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
            ip_address=request.META.get('REMOTE_ADDR'),
            environment=getattr(settings, 'KRA_ENVIRONMENT', 'sandbox')
        )
        
        return Response({
            'success': True,
            'message': 'Item catalog sync completed',
            'summary': {
                'total_items': len(items_data),
                'created': created_count,
                'updated': updated_count,
                'errors': len(errors)
            },
            'errors': errors if errors else None
        })
        
    except Exception as e:
        logger.error(f"Item catalog sync error: {str(e)}")
        return Response({
            'success': False,
            'error': 'Internal server error',
            'message': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_company_devices(request, company_id):
    """Get all devices for a company"""
    try:
        company = Company.objects.get(id=company_id, status='active')
        devices = Device.objects.filter(company=company).order_by('-created_at')
        
        serializer = DeviceSerializer(devices, many=True)
        
        return Response({
            'company': {
                'id': str(company.id),
                'name': company.company_name,
                'tin': company.tin
            },
            'devices': serializer.data
        })
        
    except Company.DoesNotExist:
        return Response({
            'error': 'Company not found or not active'
        }, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_item_catalog(request, company_id):
    """Get item catalog for integration purposes"""
    try:
        company = Company.objects.get(id=company_id, status='active')
        
        # Get query parameters for filtering
        category = request.query_params.get('category')
        tax_type = request.query_params.get('tax_type')
        is_active = request.query_params.get('is_active', 'true').lower() == 'true'
        
        items = ItemMaster.objects.filter(is_active=is_active)
        
        if category:
            items = items.filter(category__icontains=category)
        
        if tax_type:
            items = items.filter(tax_type=tax_type)
        
        # Pagination
        page_size = min(int(request.query_params.get('page_size', 100)), 500)
        page = int(request.query_params.get('page', 1))
        start = (page - 1) * page_size
        end = start + page_size
        
        total_count = items.count()
        items_page = items[start:end]
        
        serializer = ItemMasterSerializer(items_page, many=True)
        
        return Response({
            'company': {
                'id': str(company.id),
                'name': company.company_name
            },
            'items': serializer.data,
            'pagination': {
                'page': page,
                'page_size': page_size,
                'total_count': total_count,
                'total_pages': (total_count + page_size - 1) // page_size
            }
        })
        
    except Company.DoesNotExist:
        return Response({
            'error': 'Company not found or not active'
        }, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def webhook_endpoint(request, company_id):
    """
    Webhook endpoint for receiving notifications from external systems.
    Can be used by POS/ERP systems to notify about events.
    """
    try:
        company = Company.objects.get(id=company_id, status='active')
        
        # Log the webhook request
        ApiLog.objects.create(
            company=company,
            endpoint=f'/api/integration/webhook/{company_id}/',
            request_type='webhook',
            request_payload=json.dumps(request.data),
            response_payload='Webhook received',
            status_code=200,
            response_time=0.0,
            severity='info',
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
            ip_address=request.META.get('REMOTE_ADDR'),
            environment=getattr(settings, 'KRA_ENVIRONMENT', 'sandbox')
        )
        
        # Process webhook based on event type
        event_type = request.data.get('event_type')
        
        if event_type == 'system_status':
            # Handle system status updates from POS/ERP
            logger.info(f"System status update from {company.company_name}: {request.data}")
            
        elif event_type == 'transaction_update':
            # Handle transaction status updates
            logger.info(f"Transaction update from {company.company_name}: {request.data}")
            
        elif event_type == 'error_report':
            # Handle error reports from POS/ERP systems
            logger.warning(f"Error report from {company.company_name}: {request.data}")
            
            # Send notification to company
            send_notification_task.delay(
                str(company.id),
                'email',
                company.contact_email,
                'Error Report from POS System',
                f"Error report received from your POS system:\n\n{json.dumps(request.data, indent=2)}",
                'pos_error_report'
            )
        
        return Response({
            'success': True,
            'message': 'Webhook processed successfully',
            'event_type': event_type
        })
        
    except Company.DoesNotExist:
        return Response({
            'error': 'Company not found or not active'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Webhook processing error: {str(e)}")
        return Response({
            'success': False,
            'error': 'Webhook processing failed',
            'message': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

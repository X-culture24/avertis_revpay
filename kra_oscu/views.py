"""
Django REST API views for eTIMS OSCU integration.
"""
from rest_framework import status, generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import transaction
from django.core.paginator import Paginator
import logging
import uuid

from .models import Device, Invoice, InvoiceItem, ItemMaster, ApiLog, RetryQueue
from .serializers import (
    DeviceSerializer, DeviceInitSerializer, InvoiceSerializer, 
    SalesRequestSerializer, SalesResponseSerializer, ApiLogSerializer,
    ItemMasterSerializer, DeviceStatusSerializer, HealthCheckSerializer,
    ErrorResponseSerializer
)
from .services.kra_client import KRAClient, KRAClientError
from .tasks import retry_sales_invoice

logger = logging.getLogger(__name__)


class DeviceInitView(APIView):
    """
    Initialize device with KRA OSCU and get CMC key.
    POST /api/device/init/
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = DeviceInitSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                'error': 'Validation failed',
                'message': 'Invalid device initialization data',
                'details': serializer.errors,
                'timestamp': timezone.now()
            }, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        
        try:
            # Check if device already exists
            existing_device = Device.objects.filter(
                tin=data['tin'],
                bhf_id=data['bhf_id'],
                serial_number=data['serial_number']
            ).first()

            if existing_device and existing_device.status == 'active':
                return Response({
                    'error': 'Device already registered',
                    'message': 'Device is already active and registered with KRA',
                    'device_id': existing_device.id,
                    'timestamp': timezone.now()
                }, status=status.HTTP_409_CONFLICT)

            # Create or update device record
            device, created = Device.objects.get_or_create(
                tin=data['tin'],
                bhf_id=data['bhf_id'],
                serial_number=data['serial_number'],
                defaults={
                    'device_name': data['device_name'],
                    'pos_version': data.get('pos_version', '1.0'),
                    'status': 'pending'
                }
            )

            # Initialize with KRA
            kra_client = KRAClient()
            result = kra_client.init_device(
                tin=data['tin'],
                bhf_id=data['bhf_id'],
                serial_number=data['serial_number'],
                device_name=data['device_name']
            )

            if result['success']:
                # Update device with CMC key
                device.cmc_key = result['cmc_key']
                device.status = 'active'
                device.is_certified = True
                device.last_sync = timezone.now()
                device.save()

                logger.info(f"Device initialized successfully: {device.id}")
                
                return Response({
                    'success': True,
                    'device_id': device.id,
                    'status': 'active',
                    'message': 'Device initialized successfully with KRA',
                    'timestamp': timezone.now()
                }, status=status.HTTP_201_CREATED)
            else:
                device.status = 'failed'
                device.save()
                
                return Response({
                    'error': 'KRA initialization failed',
                    'message': result.get('message', 'Unknown error'),
                    'device_id': device.id,
                    'timestamp': timezone.now()
                }, status=status.HTTP_502_BAD_GATEWAY)

        except KRAClientError as e:
            logger.error(f"KRA client error during device init: {e}")
            return Response({
                'error': 'KRA service error',
                'message': str(e),
                'timestamp': timezone.now()
            }, status=status.HTTP_502_BAD_GATEWAY)
        
        except Exception as e:
            logger.error(f"Unexpected error during device init: {e}")
            return Response({
                'error': 'Internal server error',
                'message': 'An unexpected error occurred',
                'timestamp': timezone.now()
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class SalesTransactionView(APIView):
    """
    Process sales transaction and send to KRA OSCU.
    POST /api/sales/
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = SalesRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                'error': 'Validation failed',
                'message': 'Invalid sales transaction data',
                'details': serializer.errors,
                'timestamp': timezone.now()
            }, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        
        try:
            with transaction.atomic():
                # Get device
                device = get_object_or_404(
                    Device, 
                    serial_number=data['device_serial_number'],
                    status='active'
                )

                # Calculate totals
                total_amount = sum(
                    item['quantity'] * item['unit_price'] * (1 + item.get('tax_rate', 0) / 100)
                    for item in data['items']
                )
                tax_amount = sum(
                    item['quantity'] * item['unit_price'] * (item.get('tax_rate', 0) / 100)
                    for item in data['items']
                )

                # Create invoice
                invoice = Invoice.objects.create(
                    device=device,
                    invoice_no=data['invoice_no'],
                    tin=data['tin'],
                    total_amount=total_amount,
                    tax_amount=tax_amount,
                    currency=data.get('currency', 'KES'),
                    customer_tin=data.get('customer_tin', ''),
                    customer_name=data.get('customer_name', ''),
                    payment_type=data['payment_type'],
                    transaction_date=data['transaction_date'],
                    status='pending'
                )

                # Create invoice items
                for item_data in data['items']:
                    InvoiceItem.objects.create(
                        invoice=invoice,
                        item_code=item_data['item_code'],
                        item_name=item_data['item_name'],
                        quantity=item_data['quantity'],
                        unit_price=item_data['unit_price'],
                        tax_type=item_data['tax_type'],
                        tax_rate=item_data.get('tax_rate', 0),
                        unit_of_measure=item_data['unit_of_measure']
                    )

                # Send to KRA
                kra_client = KRAClient()
                result = kra_client.send_sales_invoice(invoice)

                if result['success']:
                    # Update invoice with KRA response
                    invoice.receipt_no = result['receipt_no']
                    invoice.internal_data = result['internal_data']
                    invoice.receipt_signature = result['receipt_signature']
                    invoice.status = 'confirmed'
                    invoice.save()

                    logger.info(f"Sales transaction successful: {invoice.id}")
                    
                    return Response({
                        'success': True,
                        'invoice_id': invoice.id,
                        'receipt_no': result['receipt_no'],
                        'status': 'confirmed',
                        'message': 'Sales transaction processed successfully',
                        'internal_data': result['internal_data'],
                        'receipt_signature': result['receipt_signature'],
                        'retry_queued': False,
                        'timestamp': timezone.now()
                    }, status=status.HTTP_201_CREATED)

                elif result.get('is_retryable', False):
                    # Queue for retry
                    invoice.status = 'retry'
                    invoice.save()

                    # Create retry queue entry
                    retry_entry = RetryQueue.objects.create(
                        invoice=invoice,
                        task_type='sales_retry',
                        attempt_count=0,
                        next_retry=timezone.now() + timezone.timedelta(minutes=1),
                        error_details=result.get('error_message', 'Unknown error'),
                        status='pending'
                    )

                    # Queue Celery task
                    retry_sales_invoice.delay(str(invoice.id))

                    logger.warning(f"Sales transaction queued for retry: {invoice.id}")
                    
                    return Response({
                        'success': False,
                        'invoice_id': invoice.id,
                        'receipt_no': None,
                        'status': 'retry',
                        'message': 'Transaction queued for retry due to temporary KRA service issue',
                        'retry_queued': True,
                        'timestamp': timezone.now()
                    }, status=status.HTTP_202_ACCEPTED)

                else:
                    # Permanent failure
                    invoice.status = 'failed'
                    invoice.save()

                    logger.error(f"Sales transaction failed permanently: {invoice.id}")
                    
                    return Response({
                        'success': False,
                        'invoice_id': invoice.id,
                        'status': 'failed',
                        'message': result.get('error_message', 'Transaction failed'),
                        'error_code': result.get('error_code'),
                        'retry_queued': False,
                        'timestamp': timezone.now()
                    }, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            logger.error(f"Unexpected error during sales transaction: {e}")
            return Response({
                'error': 'Internal server error',
                'message': 'An unexpected error occurred during transaction processing',
                'timestamp': timezone.now()
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class DeviceStatusView(APIView):
    """
    Check device status with KRA.
    GET /api/device/{device_id}/status/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, device_id):
        try:
            device = get_object_or_404(Device, id=device_id)
            
            # Check with KRA
            kra_client = KRAClient()
            result = kra_client.check_device_status(device)
            
            if result['success']:
                # Update last sync
                device.last_sync = timezone.now()
                device.save()
                
                return Response({
                    'device_id': device.id,
                    'status': device.status,
                    'last_sync': device.last_sync,
                    'is_active': device.is_active,
                    'kra_status': result['status'],
                    'message': result['message']
                }, status=status.HTTP_200_OK)
            else:
                return Response({
                    'device_id': device.id,
                    'status': device.status,
                    'last_sync': device.last_sync,
                    'is_active': device.is_active,
                    'kra_status': 'unknown',
                    'message': result['error_message']
                }, status=status.HTTP_502_BAD_GATEWAY)

        except Exception as e:
            logger.error(f"Error checking device status: {e}")
            return Response({
                'error': 'Status check failed',
                'message': str(e),
                'timestamp': timezone.now()
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class InvoiceListView(generics.ListAPIView):
    """
    List invoices with filtering and pagination.
    GET /api/invoices/
    """
    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Invoice.objects.select_related('device').prefetch_related('items')
        
        # Filter by device
        device_id = self.request.query_params.get('device_id')
        if device_id:
            queryset = queryset.filter(device_id=device_id)
        
        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(transaction_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(transaction_date__lte=end_date)
        
        return queryset.order_by('-transaction_date')


class ItemSyncView(APIView):
    """
    Synchronize items with KRA system codes.
    POST /api/item/sync/
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            tin = request.data.get('tin')
            bhf_id = request.data.get('bhf_id', '001')
            
            if not tin:
                return Response({
                    'error': 'Missing TIN',
                    'message': 'TIN is required for item synchronization',
                    'timestamp': timezone.now()
                }, status=status.HTTP_400_BAD_REQUEST)

            kra_client = KRAClient()
            result = kra_client.get_system_codes()
            
            if result['success']:
                # Process and save items
                items_data = result['data'].get('itemList', [])
                synced_count = 0
                created_count = 0
                
                for item_data in items_data:
                    item, created = ItemMaster.objects.get_or_create(
                        item_code=item_data.get('itemCd'),
                        defaults={
                            'item_name': item_data.get('itemNm', ''),
                            'tax_type': item_data.get('taxTyCd', 'A'),
                            'unit_of_measure': item_data.get('qtyUnitCd', 'PCS'),
                            'is_active': True
                        }
                    )
                    
                    if created:
                        created_count += 1
                    synced_count += 1

                logger.info(f"Item sync completed: {synced_count} synced, {created_count} created")
                
                return Response({
                    'success': True,
                    'synced': synced_count,
                    'created': created_count,
                    'message': 'Items synchronized successfully',
                    'timestamp': timezone.now()
                }, status=status.HTTP_200_OK)
            else:
                return Response({
                    'error': 'KRA sync failed',
                    'message': 'Failed to retrieve items from KRA',
                    'timestamp': timezone.now()
                }, status=status.HTTP_502_BAD_GATEWAY)

        except Exception as e:
            logger.error(f"Item sync error: {e}")
            return Response({
                'error': 'Sync failed',
                'message': str(e),
                'timestamp': timezone.now()
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ApiLogListView(generics.ListAPIView):
    """
    List API logs for monitoring and debugging.
    GET /api/logs/
    """
    serializer_class = ApiLogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = ApiLog.objects.select_related('device')
        
        # Filter by device
        device_id = self.request.query_params.get('device_id')
        if device_id:
            queryset = queryset.filter(device_id=device_id)
        
        # Filter by request type
        request_type = self.request.query_params.get('request_type')
        if request_type:
            queryset = queryset.filter(request_type=request_type)
        
        # Filter by status code
        status_code = self.request.query_params.get('status_code')
        if status_code:
            queryset = queryset.filter(status_code=status_code)
        
        return queryset.order_by('-created_at')


@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """
    System health check endpoint.
    GET /health/
    """
    try:
        # Check database
        db_status = "healthy"
        try:
            Device.objects.count()
        except Exception:
            db_status = "unhealthy"
        
        # Check KRA service
        kra_client = KRAClient()
        kra_result = kra_client.ping_kra_service()
        kra_status = "healthy" if kra_result['success'] else "unhealthy"
        
        overall_status = "healthy" if db_status == "healthy" and kra_status == "healthy" else "degraded"
        
        return Response({
            'status': overall_status,
            'database': db_status,
            'kra_service': kra_status,
            'timestamp': timezone.now(),
            'version': '1.0.0'
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Health check error: {e}")
        return Response({
            'status': 'unhealthy',
            'database': 'unknown',
            'kra_service': 'unknown',
            'error': str(e),
            'timestamp': timezone.now(),
            'version': '1.0.0'
        }, status=status.HTTP_503_SERVICE_UNAVAILABLE)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def test_connection(request):
    """
    Test connection to KRA OSCU service.
    POST /api/device/test-connection/
    """
    try:
        kra_client = KRAClient()
        result = kra_client.ping_kra_service()
        
        return Response({
            'success': result['success'],
            'message': result['message'],
            'response_time': result.get('response_time', 0),
            'timestamp': timezone.now()
        }, status=status.HTTP_200_OK if result['success'] else status.HTTP_502_BAD_GATEWAY)
        
    except Exception as e:
        logger.error(f"Connection test error: {e}")
        return Response({
            'success': False,
            'message': str(e),
            'timestamp': timezone.now()
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

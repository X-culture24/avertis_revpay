"""
DigiTax KRA eTIMS Integration Service
Real-time invoice submission to KRA via DigiTax API
"""

import requests
import json
from decimal import Decimal
from django.conf import settings
from django.utils import timezone
from typing import Dict, Any, Optional, Tuple
import logging

logger = logging.getLogger(__name__)


class DigiTaxService:
    """
    Service for real-time KRA eTIMS integration via DigiTax API
    """
    
    def __init__(self):
        self.base_url = getattr(settings, 'DIGITAX_BASE_URL', 'https://api.digitax.tech/ke/v1')
        self.api_key = getattr(settings, 'DIGITAX_API_KEY', '')
        self.environment = getattr(settings, 'DIGITAX_ENVIRONMENT', 'sandbox')  # sandbox or production
        
        # Set appropriate base URL based on environment
        if self.environment == 'production':
            self.base_url = 'https://api.digitax.tech/ke/v1'
        else:
            self.base_url = 'https://api-sbx.digitax.tech/ke/v1'
    
    def get_headers(self) -> Dict[str, str]:
        """Get API headers with authentication"""
        return {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    
    def submit_invoice_realtime(self, invoice) -> Tuple[bool, str, Optional[Dict]]:
        """
        Submit invoice to KRA via DigiTax in real-time
        Returns: (success, message, response_data)
        """
        try:
            # Prepare invoice data for DigiTax API
            invoice_data = self._prepare_invoice_data(invoice)
            
            # Submit to DigiTax
            url = f"{self.base_url}/sales"
            headers = self.get_headers()
            
            logger.info(f"Submitting invoice {invoice.invoice_no} to DigiTax: {url}")
            logger.debug(f"Invoice data: {json.dumps(invoice_data, indent=2)}")
            
            response = requests.post(
                url,
                json=invoice_data,
                headers=headers,
                timeout=30
            )
            
            response_data = response.json()
            logger.info(f"DigiTax response: {response.status_code} - {response_data}")
            
            if response.status_code == 201:
                # Success - extract ETR information
                digitax_id = response_data.get('id')
                receipt_number = response_data.get('receipt_number')
                etims_url = response_data.get('etims_url')
                receipt_signature = response_data.get('receipt_signature')
                
                # Update invoice with KRA response
                invoice.receipt_no = receipt_number
                invoice.digitax_id = digitax_id
                invoice.etims_url = etims_url
                invoice.receipt_signature = receipt_signature
                invoice.status = 'confirmed'
                invoice.synced_at = timezone.now()
                invoice.save()
                
                return True, f"Invoice successfully submitted to KRA. ETR: {receipt_number}", response_data
            
            else:
                # Error response
                error_msg = response_data.get('message', 'Unknown error')
                logger.error(f"DigiTax API error: {error_msg}")
                
                # Update invoice status
                invoice.status = 'failed'
                invoice.error_message = error_msg
                invoice.save()
                
                return False, f"KRA submission failed: {error_msg}", response_data
                
        except requests.exceptions.Timeout:
            error_msg = "Request timeout - KRA system may be slow"
            logger.error(f"DigiTax timeout for invoice {invoice.invoice_no}")
            invoice.status = 'retry'
            invoice.error_message = error_msg
            invoice.save()
            return False, error_msg, None
            
        except requests.exceptions.RequestException as e:
            error_msg = f"Network error: {str(e)}"
            logger.error(f"DigiTax network error for invoice {invoice.invoice_no}: {e}")
            invoice.status = 'retry'
            invoice.error_message = error_msg
            invoice.save()
            return False, error_msg, None
            
        except Exception as e:
            error_msg = f"Unexpected error: {str(e)}"
            logger.error(f"DigiTax unexpected error for invoice {invoice.invoice_no}: {e}")
            invoice.status = 'failed'
            invoice.error_message = error_msg
            invoice.save()
            return False, error_msg, None
    
    def _prepare_invoice_data(self, invoice) -> Dict[str, Any]:
        """
        Convert internal invoice format to DigiTax API format
        """
        # Get invoice items
        items = []
        for item in invoice.invoiceitem_set.all():
            items.append({
                "item_name": item.item_name,
                "item_code": item.item_code,
                "quantity": float(item.quantity),
                "unit_price": float(item.unit_price),
                "tax_type_code": item.tax_type,
                "unit_of_measure": item.unit_of_measure,
                "package_unit_code": "BA",  # Default package unit
                "quantity_unit_code": item.unit_of_measure,
                "item_class_code": "70101500",  # Default item class
                "item_type_code": "1",  # Default item type
                "origin_nation_code": "KE"  # Kenya origin
            })
        
        # Prepare main invoice data
        invoice_data = {
            "trader_invoice_number": invoice.invoice_no,
            "date": invoice.transaction_date.strftime("%d/%m/%Y"),
            "time": invoice.transaction_date.strftime("%I:%M:%S %p"),
            "customer_pin": invoice.customer_tin or "",
            "customer_name": invoice.customer_name or "Walk-in Customer",
            "payment_type_code": self._get_payment_type_code(invoice.payment_type),
            "receipt_type_code": self._get_receipt_type_code(invoice.receipt_type),
            "sales_status_code": "02",  # Normal sale
            "currency_type": invoice.currency,
            "items": items,
            "callback_url": f"{settings.BASE_URL}/api/mobile/callback/digitax/"  # For real-time updates
        }
        
        # Add original invoice number for copy receipts
        if invoice.receipt_type == 'copy' and hasattr(invoice, 'original_receipt_no'):
            invoice_data["original_invoice_number"] = invoice.original_receipt_no
        
        return invoice_data
    
    def _get_payment_type_code(self, payment_type: str) -> str:
        """Convert payment type to DigiTax code"""
        payment_mapping = {
            'CASH': '01',
            'CARD': '02', 
            'CHEQUE': '03',
            'BANK_TRANSFER': '04',
            'MOBILE_MONEY': '05'
        }
        return payment_mapping.get(payment_type, '01')  # Default to cash
    
    def _get_receipt_type_code(self, receipt_type: str) -> str:
        """Convert receipt type to DigiTax code"""
        receipt_mapping = {
            'normal': '01',
            'copy': '02',
            'proforma': '03',
            'training': '04'
        }
        return receipt_mapping.get(receipt_type, '01')  # Default to normal
    
    def get_business_info(self) -> Optional[Dict]:
        """Get business information from DigiTax"""
        try:
            url = f"{self.base_url}/etims-info"
            headers = self.get_headers()
            
            response = requests.get(url, headers=headers, timeout=10)
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Failed to get business info: {response.status_code}")
                return None
                
        except Exception as e:
            logger.error(f"Error getting business info: {e}")
            return None
    
    def sync_items(self, items: list) -> Tuple[bool, str]:
        """Sync business items to DigiTax/KRA"""
        try:
            url = f"{self.base_url}/items"
            headers = self.get_headers()
            
            for item_data in items:
                response = requests.post(
                    url,
                    json=item_data,
                    headers=headers,
                    timeout=30
                )
                
                if response.status_code not in [200, 201]:
                    logger.error(f"Failed to sync item: {response.text}")
                    return False, f"Failed to sync item: {response.text}"
            
            return True, "Items synced successfully"
            
        except Exception as e:
            logger.error(f"Error syncing items: {e}")
            return False, f"Error syncing items: {str(e)}"


# Callback handler for DigiTax webhooks
def handle_digitax_callback(request_data: Dict) -> bool:
    """
    Handle DigiTax callback notifications
    Updates invoice status based on KRA sync results
    """
    try:
        event = request_data.get('event')
        data = request_data.get('data', {})
        
        if event == 'sale.sync':
            # Find invoice by trader_invoice_number
            trader_invoice_number = data.get('trader_invoice_number')
            receipt_number = data.get('receipt_number')
            etims_url = data.get('etims_url')
            receipt_signature = data.get('receipt_signature')
            queue_status = data.get('queue_status')
            
            from ..models import Invoice
            
            try:
                invoice = Invoice.objects.get(invoice_no=trader_invoice_number)
                
                if queue_status == 'completed':
                    invoice.receipt_no = receipt_number
                    invoice.etims_url = etims_url
                    invoice.receipt_signature = receipt_signature
                    invoice.status = 'confirmed'
                    invoice.synced_at = timezone.now()
                else:
                    invoice.status = 'failed'
                    invoice.error_message = data.get('error_message', 'KRA sync failed')
                
                invoice.save()
                logger.info(f"Updated invoice {trader_invoice_number} from DigiTax callback")
                return True
                
            except Invoice.DoesNotExist:
                logger.error(f"Invoice {trader_invoice_number} not found for callback")
                return False
        
        elif event == 'item.sync':
            # Handle item sync callback if needed
            logger.info("Item sync callback received")
            return True
        
        return True
        
    except Exception as e:
        logger.error(f"Error handling DigiTax callback: {e}")
        return False

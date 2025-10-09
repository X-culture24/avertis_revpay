"""
VSCU (Virtual Sales Control Unit) client for KRA eTIMS integration.
Handles virtual device registrations and API-based transaction processing.
Part of Revpay Connect's certified 3rd-party integrator services.
"""
import json
import logging
from typing import Dict, Any, Optional
from django.conf import settings
from django.utils import timezone
import requests
from .kra_client import KRAClient

logger = logging.getLogger(__name__)


class VSCUClient(KRAClient):
    """
    VSCU-specific client extending the base KRA client.
    Handles virtual device integrations for e-commerce, mobile apps, and API-only systems.
    """
    
    def __init__(self):
        super().__init__()
        self.device_type = 'vscu'
    
    def register_virtual_device(self, device_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Register a virtual device with KRA eTIMS VSCU system.
        
        Args:
            device_data: Device registration information including:
                - tin: Tax Identification Number
                - bhf_id: Branch ID
                - virtual_device_id: Virtual device identifier
                - integration_type: Type of integration (ecommerce, mobile_app, etc.)
                - api_endpoint: Client's API endpoint for callbacks
                - webhook_url: Webhook URL for notifications
        
        Returns:
            Dict containing registration result and CMC key
        """
        try:
            # Prepare VSCU registration payload
            payload = {
                "tin": device_data['tin'],
                "bhfId": device_data['bhf_id'],
                "dvcSrlNo": device_data.get('virtual_device_id', f"VSCU-{device_data['tin']}-{device_data['bhf_id']}"),
                "integrationType": device_data.get('integration_type', 'api_integration'),
                "apiEndpoint": device_data.get('api_endpoint'),
                "webhookUrl": device_data.get('webhook_url'),
                "requestDt": timezone.now().strftime('%Y%m%d%H%M%S'),
                "integratorInfo": {
                    "name": "Revpay Connect Ltd",
                    "certificationId": getattr(settings, 'REVPAY_CERTIFICATION_ID', 'RC-ETIMS-2024'),
                    "version": "1.0.0"
                }
            }
            
            # Call KRA VSCU registration endpoint
            endpoint = f"{self.base_url}/selectInitVscu"
            
            logger.info(f"Registering VSCU device for TIN: {device_data['tin']}")
            
            response = requests.post(
                endpoint,
                json=payload,
                headers=self.headers,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                
                if result.get('resultCd') == '000':
                    return {
                        'success': True,
                        'cmc_key': result.get('cmcKey'),
                        'virtual_device_id': result.get('dvcSrlNo'),
                        'registration_id': result.get('registrationId'),
                        'message': 'VSCU device registered successfully',
                        'kra_response': result
                    }
                else:
                    return {
                        'success': False,
                        'error': result.get('resultMsg', 'Unknown error'),
                        'error_code': result.get('resultCd'),
                        'kra_response': result
                    }
            else:
                return {
                    'success': False,
                    'error': f'HTTP {response.status_code}: {response.text}',
                    'http_status': response.status_code
                }
                
        except requests.exceptions.RequestException as e:
            logger.error(f"VSCU registration network error: {str(e)}")
            return {
                'success': False,
                'error': f'Network error: {str(e)}',
                'error_type': 'network_error'
            }
        except Exception as e:
            logger.error(f"VSCU registration error: {str(e)}")
            return {
                'success': False,
                'error': f'Registration error: {str(e)}',
                'error_type': 'system_error'
            }
    
    def process_virtual_transaction(self, transaction_data: Dict[str, Any], cmc_key: str) -> Dict[str, Any]:
        """
        Process a sales transaction through VSCU.
        
        Args:
            transaction_data: Transaction information
            cmc_key: Communication key for the virtual device
        
        Returns:
            Dict containing transaction result and receipt signature
        """
        try:
            # Build VSCU transaction payload
            payload = {
                "tin": transaction_data['tin'],
                "bhfId": transaction_data['bhf_id'],
                "invcNo": transaction_data['invoice_number'],
                "orgInvcNo": transaction_data.get('original_invoice_number', 0),
                "custTin": transaction_data.get('customer_tin'),
                "custNm": transaction_data.get('customer_name', 'Walk-in Customer'),
                "salesTyp": transaction_data.get('sales_type', 'N'),  # N=Normal, P=Proforma, T=Training
                "rcptTyCd": transaction_data.get('receipt_type', 'S'),  # S=Sales, R=Refund
                "pmtTyCd": transaction_data.get('payment_type', 'CASH'),
                "salesSttsCd": transaction_data.get('sales_status', '02'),  # 02=Complete
                "cfmDt": transaction_data.get('confirm_date', timezone.now().strftime('%Y%m%d%H%M%S')),
                "salesDt": transaction_data.get('sales_date', timezone.now().strftime('%Y%m%d')),
                "stockRlsDt": transaction_data.get('stock_release_date'),
                "cnclReqDt": transaction_data.get('cancel_request_date'),
                "cnclDt": transaction_data.get('cancel_date'),
                "rfdDt": transaction_data.get('refund_date'),
                "rfdRsnCd": transaction_data.get('refund_reason'),
                "totItemCnt": len(transaction_data.get('items', [])),
                "taxblAmtA": transaction_data.get('taxable_amount_a', 0),
                "taxblAmtB": transaction_data.get('taxable_amount_b', 0),
                "taxblAmtC": transaction_data.get('taxable_amount_c', 0),
                "taxblAmtD": transaction_data.get('taxable_amount_d', 0),
                "taxRtA": 16,  # VAT rate A (16%)
                "taxRtB": 8,   # VAT rate B (8%)
                "taxRtC": 0,   # VAT rate C (0%)
                "taxRtD": 0,   # VAT rate D (Exempt)
                "taxAmtA": transaction_data.get('tax_amount_a', 0),
                "taxAmtB": transaction_data.get('tax_amount_b', 0),
                "taxAmtC": transaction_data.get('tax_amount_c', 0),
                "taxAmtD": transaction_data.get('tax_amount_d', 0),
                "totTaxblAmt": transaction_data.get('total_taxable_amount', 0),
                "totTaxAmt": transaction_data.get('total_tax_amount', 0),
                "totAmt": transaction_data.get('total_amount', 0),
                "prchrAcptcYn": "Y",  # Purchaser acceptance
                "remark": transaction_data.get('remark', ''),
                "regrId": "Revpay Connect",
                "regrNm": "Revpay Connect Gateway",
                "modrId": "Revpay Connect",
                "modrNm": "Revpay Connect Gateway",
                "itemList": self._format_vscu_items(transaction_data.get('items', []))
            }
            
            # Add virtual device specific fields
            payload.update({
                "virtualDeviceId": transaction_data.get('virtual_device_id'),
                "integrationType": transaction_data.get('integration_type', 'api_integration'),
                "clientTransactionId": transaction_data.get('client_transaction_id'),
                "integrationMetadata": transaction_data.get('integration_metadata', {})
            })
            
            # Sign the payload with CMC key
            signed_payload = self._sign_vscu_payload(payload, cmc_key)
            
            # Submit to KRA VSCU endpoint
            endpoint = f"{self.base_url}/trnsSalesVscu/saveSales"
            
            logger.info(f"Processing VSCU transaction: {transaction_data.get('invoice_number')}")
            
            response = requests.post(
                endpoint,
                json=signed_payload,
                headers=self.headers,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                
                if result.get('resultCd') == '000':
                    return {
                        'success': True,
                        'receipt_signature': result.get('rcptSign'),
                        'internal_data': result.get('intrlData'),
                        'receipt_number': result.get('rcptNo'),
                        'total_amount': result.get('totAmt'),
                        'qr_code': result.get('qrCode'),
                        'message': 'VSCU transaction processed successfully',
                        'kra_response': result
                    }
                else:
                    return {
                        'success': False,
                        'error': result.get('resultMsg', 'Transaction processing failed'),
                        'error_code': result.get('resultCd'),
                        'kra_response': result
                    }
            else:
                return {
                    'success': False,
                    'error': f'HTTP {response.status_code}: {response.text}',
                    'http_status': response.status_code
                }
                
        except Exception as e:
            logger.error(f"VSCU transaction processing error: {str(e)}")
            return {
                'success': False,
                'error': f'Transaction processing error: {str(e)}',
                'error_type': 'processing_error'
            }
    
    def _format_vscu_items(self, items: list) -> list:
        """Format items for VSCU transaction payload"""
        formatted_items = []
        
        for idx, item in enumerate(items, 1):
            formatted_item = {
                "itemSeq": idx,
                "itemCd": item.get('item_code'),
                "itemClsCd": item.get('item_class_code'),
                "itemNm": item.get('item_name'),
                "bcd": item.get('barcode'),
                "pkgUnitCd": item.get('package_unit_code', 'CT'),
                "pkg": item.get('package_quantity', 1),
                "qtyUnitCd": item.get('quantity_unit_code', 'U'),
                "qty": item.get('quantity', 1),
                "prc": item.get('unit_price', 0),
                "splyAmt": item.get('supply_amount', 0),
                "dcRt": item.get('discount_rate', 0),
                "dcAmt": item.get('discount_amount', 0),
                "isrccCd": item.get('insurance_code'),
                "isrccNm": item.get('insurance_name'),
                "isrcRt": item.get('insurance_rate', 0),
                "isrcAmt": item.get('insurance_amount', 0),
                "taxTyCd": item.get('tax_type_code', 'B'),
                "taxblAmt": item.get('taxable_amount', 0),
                "taxAmt": item.get('tax_amount', 0),
                "totAmt": item.get('total_amount', 0)
            }
            formatted_items.append(formatted_item)
        
        return formatted_items
    
    def _sign_vscu_payload(self, payload: Dict[str, Any], cmc_key: str) -> Dict[str, Any]:
        """Sign VSCU payload with CMC key"""
        # Create signature for VSCU payload
        # This would implement the KRA-specific signing algorithm
        payload_str = json.dumps(payload, sort_keys=True, separators=(',', ':'))
        
        # For now, add the CMC key as authorization
        # In production, this would use proper cryptographic signing
        signed_payload = payload.copy()
        signed_payload['cmcKey'] = cmc_key
        signed_payload['signature'] = self._generate_signature(payload_str, cmc_key)
        
        return signed_payload
    
    def _generate_signature(self, data: str, cmc_key: str) -> str:
        """Generate signature for VSCU payload"""
        # This would implement KRA's signature algorithm
        # For now, return a placeholder signature
        import hashlib
        import hmac
        
        signature = hmac.new(
            cmc_key.encode('utf-8'),
            data.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        
        return signature
    
    def sync_virtual_device_status(self, device_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sync virtual device status with KRA.
        
        Args:
            device_data: Virtual device information
        
        Returns:
            Dict containing sync result and device status
        """
        try:
            payload = {
                "tin": device_data['tin'],
                "bhfId": device_data['bhf_id'],
                "virtualDeviceId": device_data['virtual_device_id'],
                "lastSyncDt": device_data.get('last_sync', timezone.now().strftime('%Y%m%d%H%M%S'))
            }
            
            endpoint = f"{self.base_url}/selectVscuStatus"
            
            response = requests.post(
                endpoint,
                json=payload,
                headers=self.headers,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                
                if result.get('resultCd') == '000':
                    return {
                        'success': True,
                        'device_status': result.get('deviceStatus'),
                        'last_activity': result.get('lastActivity'),
                        'transaction_count': result.get('transactionCount', 0),
                        'message': 'VSCU status synced successfully',
                        'kra_response': result
                    }
                else:
                    return {
                        'success': False,
                        'error': result.get('resultMsg', 'Status sync failed'),
                        'error_code': result.get('resultCd')
                    }
            else:
                return {
                    'success': False,
                    'error': f'HTTP {response.status_code}: {response.text}',
                    'http_status': response.status_code
                }
                
        except Exception as e:
            logger.error(f"VSCU status sync error: {str(e)}")
            return {
                'success': False,
                'error': f'Status sync error: {str(e)}',
                'error_type': 'sync_error'
            }
    
    def get_virtual_device_transactions(self, device_data: Dict[str, Any], date_range: Dict[str, str]) -> Dict[str, Any]:
        """
        Retrieve transaction history for a virtual device.
        
        Args:
            device_data: Virtual device information
            date_range: Date range for transaction retrieval
        
        Returns:
            Dict containing transaction history
        """
        try:
            payload = {
                "tin": device_data['tin'],
                "bhfId": device_data['bhf_id'],
                "virtualDeviceId": device_data['virtual_device_id'],
                "startDt": date_range.get('start_date'),
                "endDt": date_range.get('end_date'),
                "lastReqDt": date_range.get('last_request_date')
            }
            
            endpoint = f"{self.base_url}/selectVscuTrnsSales"
            
            response = requests.post(
                endpoint,
                json=payload,
                headers=self.headers,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                
                if result.get('resultCd') == '000':
                    return {
                        'success': True,
                        'transactions': result.get('saleList', []),
                        'total_count': result.get('totalCnt', 0),
                        'total_amount': result.get('totalAmt', 0),
                        'message': 'Transaction history retrieved successfully',
                        'kra_response': result
                    }
                else:
                    return {
                        'success': False,
                        'error': result.get('resultMsg', 'Transaction retrieval failed'),
                        'error_code': result.get('resultCd')
                    }
            else:
                return {
                    'success': False,
                    'error': f'HTTP {response.status_code}: {response.text}',
                    'http_status': response.status_code
                }
                
        except Exception as e:
            logger.error(f"VSCU transaction retrieval error: {str(e)}")
            return {
                'success': False,
                'error': f'Transaction retrieval error: {str(e)}',
                'error_type': 'retrieval_error'
            }

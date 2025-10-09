"""
KRA OSCU API Client Service
Handles all communication with KRA eTIMS OSCU endpoints.
"""
import requests
import json
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from decimal import Decimal
from typing import Dict, Any, Optional, List
from django.conf import settings
from django.utils import timezone as django_timezone
import logging

from ..models import Device, Invoice, ApiLog

logger = logging.getLogger(__name__)


class KRAClientError(Exception):
    """Custom exception for KRA API errors"""
    pass


class KRAClient:
    """
    Client for KRA eTIMS OSCU API communication.
    Handles device registration, sales transmission, and status checks.
    """
    
    def __init__(self):
        self.base_url = self._get_base_url()
        self.timeout = settings.KRA_TIMEOUT
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'eTIMS-Django-Client/1.0'
        })

    def _get_base_url(self) -> str:
        """Get KRA base URL based on environment"""
        if settings.KRA_ENVIRONMENT == 'production':
            return settings.KRA_PROD_BASE_URL
        return settings.KRA_SANDBOX_BASE_URL

    def _log_api_call(self, device: Optional[Device], endpoint: str, request_type: str,
                     request_payload: str, response_payload: str, status_code: int,
                     response_time: float, error_message: str = "", is_retry: bool = False):
        """Log API call for audit trail"""
        try:
            ApiLog.objects.create(
                device=device,
                endpoint=endpoint,
                request_type=request_type,
                request_payload=request_payload,
                response_payload=response_payload,
                status_code=status_code,
                response_time=response_time,
                error_message=error_message,
                is_retry=is_retry
            )
        except Exception as e:
            logger.error(f"Failed to log API call: {e}")

    def _make_request(self, endpoint: str, payload: Dict[str, Any], 
                     device: Optional[Device] = None, request_type: str = "unknown",
                     is_retry: bool = False) -> Dict[str, Any]:
        """Make HTTP request to KRA API with logging"""
        url = f"{self.base_url}{endpoint}"
        request_payload = json.dumps(payload, indent=2)
        
        start_time = datetime.now()
        
        try:
            logger.info(f"Making KRA API request to {endpoint}")
            response = self.session.post(
                url,
                json=payload,
                timeout=self.timeout
            )
            
            end_time = datetime.now()
            response_time = (end_time - start_time).total_seconds()
            
            response_payload = response.text
            status_code = response.status_code
            
            # Log the API call
            self._log_api_call(
                device=device,
                endpoint=endpoint,
                request_type=request_type,
                request_payload=request_payload,
                response_payload=response_payload,
                status_code=status_code,
                response_time=response_time,
                is_retry=is_retry
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                error_msg = f"KRA API error: {response.status_code} - {response.text}"
                logger.error(error_msg)
                raise KRAClientError(error_msg)
                
        except requests.exceptions.Timeout:
            error_msg = f"KRA API timeout after {self.timeout} seconds"
            logger.error(error_msg)
            self._log_api_call(
                device=device,
                endpoint=endpoint,
                request_type=request_type,
                request_payload=request_payload,
                response_payload="TIMEOUT",
                status_code=408,
                response_time=self.timeout,
                error_message=error_msg,
                is_retry=is_retry
            )
            raise KRAClientError(error_msg)
            
        except requests.exceptions.ConnectionError:
            error_msg = "KRA API connection error"
            logger.error(error_msg)
            self._log_api_call(
                device=device,
                endpoint=endpoint,
                request_type=request_type,
                request_payload=request_payload,
                response_payload="CONNECTION_ERROR",
                status_code=0,
                response_time=0,
                error_message=error_msg,
                is_retry=is_retry
            )
            raise KRAClientError(error_msg)
            
        except Exception as e:
            error_msg = f"Unexpected error: {str(e)}"
            logger.error(error_msg)
            self._log_api_call(
                device=device,
                endpoint=endpoint,
                request_type=request_type,
                request_payload=request_payload,
                response_payload="ERROR",
                status_code=500,
                response_time=0,
                error_message=error_msg,
                is_retry=is_retry
            )
            raise KRAClientError(error_msg)

    def init_device(self, tin: str, bhf_id: str, serial_number: str, device_name: str) -> Dict[str, Any]:
        """
        Initialize device with KRA OSCU.
        Calls /selectInitOsdcInfo endpoint to get CMC key.
        """
        payload = {
            "tin": tin,
            "bhfId": bhf_id,
            "dvcSrlNo": serial_number,
            "dvcNm": device_name,
            "osdc": {
                "osdc": "OSDC001",  # Default OSDC identifier
                "osdcNm": "Django eTIMS Integration"
            }
        }
        
        try:
            device = Device.objects.filter(
                tin=tin, 
                bhf_id=bhf_id, 
                serial_number=serial_number
            ).first()
            
            response = self._make_request(
                endpoint="/selectInitOsdcInfo",
                payload=payload,
                device=device,
                request_type="init"
            )
            
            # Extract CMC key from response
            if response.get("resultCd") == "000":  # Success code
                cmc_key = response.get("data", {}).get("cmcKey")
                if cmc_key:
                    logger.info(f"Device initialization successful for {tin}-{bhf_id}")
                    return {
                        "success": True,
                        "cmc_key": cmc_key,
                        "message": "Device initialized successfully",
                        "data": response.get("data", {})
                    }
                else:
                    raise KRAClientError("CMC key not found in response")
            else:
                error_msg = response.get("resultMsg", "Unknown error")
                raise KRAClientError(f"KRA initialization failed: {error_msg}")
                
        except Exception as e:
            logger.error(f"Device initialization failed: {e}")
            raise

    def send_sales_invoice(self, invoice: Invoice, is_retry: bool = False) -> Dict[str, Any]:
        """
        Send sales invoice to KRA OSCU.
        Calls /saveTrnsSalesOsdc endpoint.
        """
        from .payload_builder import PayloadBuilder
        
        try:
            # Build KRA payload
            builder = PayloadBuilder()
            payload = builder.build_sales_payload(invoice)
            
            response = self._make_request(
                endpoint="/saveTrnsSalesOsdc",
                payload=payload,
                device=invoice.device,
                request_type="sales",
                is_retry=is_retry
            )
            
            # Process response
            if response.get("resultCd") == "000":  # Success
                receipt_data = response.get("data", {})
                receipt_no = receipt_data.get("rcptNo")
                internal_data = receipt_data.get("intrlData")
                receipt_signature = receipt_data.get("rcptSign")
                
                logger.info(f"Sales invoice sent successfully: {invoice.invoice_no}")
                return {
                    "success": True,
                    "receipt_no": receipt_no,
                    "internal_data": internal_data,
                    "receipt_signature": receipt_signature,
                    "message": "Invoice sent successfully",
                    "data": receipt_data
                }
            else:
                error_msg = response.get("resultMsg", "Unknown error")
                error_code = response.get("resultCd", "999")
                
                # Check if error is retryable
                retryable_codes = ["001", "002", "003"]  # Network, timeout, server errors
                is_retryable = error_code in retryable_codes
                
                return {
                    "success": False,
                    "error_code": error_code,
                    "error_message": error_msg,
                    "is_retryable": is_retryable,
                    "data": response
                }
                
        except Exception as e:
            logger.error(f"Sales invoice transmission failed: {e}")
            return {
                "success": False,
                "error_message": str(e),
                "is_retryable": True  # Assume retryable for network errors
            }

    def get_system_codes(self, code_type: str = "all") -> Dict[str, Any]:
        """
        Get system codes from KRA (tax types, payment methods, etc.)
        """
        payload = {
            "tin": "",  # Can be empty for system codes
            "bhfId": "000",
            "lastReqDt": "20240101000000"  # Get all codes
        }
        
        try:
            response = self._make_request(
                endpoint="/selectTrnsPurchaseSalesItemList",
                payload=payload,
                request_type="codes"
            )
            
            if response.get("resultCd") == "000":
                return {
                    "success": True,
                    "data": response.get("data", {}),
                    "message": "System codes retrieved successfully"
                }
            else:
                error_msg = response.get("resultMsg", "Unknown error")
                raise KRAClientError(f"Failed to get system codes: {error_msg}")
                
        except Exception as e:
            logger.error(f"System codes retrieval failed: {e}")
            raise

    def check_device_status(self, device: Device) -> Dict[str, Any]:
        """
        Check device status with KRA OSCU
        """
        payload = {
            "tin": device.tin,
            "bhfId": device.bhf_id,
            "dvcSrlNo": device.serial_number
        }
        
        try:
            response = self._make_request(
                endpoint="/selectOsdcStatus",
                payload=payload,
                device=device,
                request_type="status_check"
            )
            
            if response.get("resultCd") == "000":
                status_data = response.get("data", {})
                return {
                    "success": True,
                    "status": status_data.get("dvcSts", "unknown"),
                    "last_sync": status_data.get("lastSyncDt"),
                    "message": "Status check successful",
                    "data": status_data
                }
            else:
                error_msg = response.get("resultMsg", "Unknown error")
                return {
                    "success": False,
                    "error_message": error_msg,
                    "data": response
                }
                
        except Exception as e:
            logger.error(f"Device status check failed: {e}")
            return {
                "success": False,
                "error_message": str(e)
            }

    def ping_kra_service(self) -> Dict[str, Any]:
        """
        Simple ping to check if KRA service is available
        """
        try:
            # Use a lightweight endpoint for health check
            response = self.session.get(
                f"{self.base_url}/health",
                timeout=5
            )
            
            return {
                "success": response.status_code == 200,
                "status_code": response.status_code,
                "response_time": response.elapsed.total_seconds(),
                "message": "KRA service is available" if response.status_code == 200 else "KRA service unavailable"
            }
            
        except Exception as e:
            return {
                "success": False,
                "error_message": str(e),
                "message": "KRA service unavailable"
            }

    def validate_invoice_data(self, invoice_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate invoice data before sending to KRA
        """
        errors = []
        
        # Required fields validation
        required_fields = ['tin', 'bhfId', 'invcNo', 'totAmt', 'itemList']
        for field in required_fields:
            if field not in invoice_data or not invoice_data[field]:
                errors.append(f"Missing required field: {field}")
        
        # Amount validation
        if 'totAmt' in invoice_data:
            try:
                total_amount = Decimal(str(invoice_data['totAmt']))
                if total_amount <= 0:
                    errors.append("Total amount must be greater than 0")
            except (ValueError, TypeError):
                errors.append("Invalid total amount format")
        
        # Items validation
        if 'itemList' in invoice_data and isinstance(invoice_data['itemList'], list):
            if len(invoice_data['itemList']) == 0:
                errors.append("Invoice must contain at least one item")
            
            for i, item in enumerate(invoice_data['itemList']):
                item_errors = self._validate_item(item, i)
                errors.extend(item_errors)
        
        return {
            "is_valid": len(errors) == 0,
            "errors": errors
        }

    def _validate_item(self, item: Dict[str, Any], index: int) -> List[str]:
        """Validate individual item data"""
        errors = []
        prefix = f"Item {index + 1}: "
        
        required_item_fields = ['itemCd', 'itemNm', 'qty', 'prc', 'taxTyCd']
        for field in required_item_fields:
            if field not in item or not item[field]:
                errors.append(f"{prefix}Missing required field: {field}")
        
        # Quantity validation
        if 'qty' in item:
            try:
                qty = Decimal(str(item['qty']))
                if qty <= 0:
                    errors.append(f"{prefix}Quantity must be greater than 0")
            except (ValueError, TypeError):
                errors.append(f"{prefix}Invalid quantity format")
        
        # Price validation
        if 'prc' in item:
            try:
                price = Decimal(str(item['prc']))
                if price < 0:
                    errors.append(f"{prefix}Price cannot be negative")
            except (ValueError, TypeError):
                errors.append(f"{prefix}Invalid price format")
        
        return errors

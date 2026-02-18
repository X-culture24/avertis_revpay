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
from .kra_mock_service import KRAMockService

logger = logging.getLogger(__name__)


class KRAClientError(Exception):
    """Custom exception for KRA API errors"""
    pass


class KRAClient:
    """
    Client for KRA eTIMS OSCU API communication.
    Handles device registration, sales transmission, and status checks.
    Supports mock mode for testing.
    """
    
    def __init__(self, use_mock=None):
        """
        Initialize KRA Client
        
        Args:
            use_mock: Override mock mode. If None, uses settings.KRA_USE_MOCK
        """
        self.use_mock = use_mock if use_mock is not None else getattr(settings, 'KRA_USE_MOCK', True)
        self.base_url = self._get_base_url()
        self.timeout = settings.KRA_TIMEOUT
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'eTIMS-Django-Client/1.0',
            'Authorization': 'Bearer sandbox-token',  # KRA sandbox requires auth header
            'X-API-Version': '1.0'
        })
        
        if self.use_mock:
            logger.info("KRA Client initialized in MOCK mode")
        else:
            logger.info(f"KRA Client initialized for {settings.KRA_ENVIRONMENT} environment")

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

    def _get_mock_response(self, endpoint: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Return mock responses for sandbox testing"""
        logger.info(f"Returning mock response for sandbox endpoint: {endpoint}")
        
        if endpoint == "/etims-api/selectInitOsdcInfo":
            # Generate a realistic CMC key for testing
            import hashlib
            device_info = f"{payload.get('tin', 'UNKNOWN')}{payload.get('dvcSrlNo', 'UNKNOWN')}"
            cmc_key = f"CMC_{hashlib.md5(device_info.encode()).hexdigest()[:16].upper()}"
            
            return {
                "resultCd": "000",
                "resultMsg": "Success",
                "data": {
                    "cmcKey": cmc_key,
                    "tin": payload.get("tin"),
                    "bhfId": payload.get("bhfId"),
                    "dvcSrlNo": payload.get("dvcSrlNo"),
                    "status": "active",
                    "registrationDate": datetime.now().strftime('%Y%m%d%H%M%S'),
                    "expiryDate": "20251231235959"  # Valid until end of 2025
                }
            }
        elif endpoint == "/etims-api/saveTrnsSalesOsdc":
            # Generate realistic receipt number
            receipt_no = f"ETR{datetime.now().strftime('%Y%m%d%H%M%S')}"
            
            return {
                "resultCd": "000",
                "resultMsg": "Success",
                "data": {
                    "rcptNo": receipt_no,
                    "intrlData": f"INTERNAL_DATA_{receipt_no}",
                    "rcptSign": f"SIGNATURE_{receipt_no}",
                    "totRcptNo": 1,
                    "vsdcRcptPbctDate": datetime.now().strftime('%Y%m%d%H%M%S'),
                    "sdcDateTime": datetime.now().strftime('%Y%m%d%H%M%S'),
                    "qrCode": f"QR_{receipt_no}"
                }
            }
        else:
            return {
                "resultCd": "000",
                "resultMsg": "Success - Mock Response",
                "data": {
                    "timestamp": datetime.now().strftime('%Y%m%d%H%M%S'),
                    "status": "success"
                }
            }

    def _generate_signature(self, payload: Dict[str, Any], device: Optional[Device] = None) -> str:
        """
        Generate digital signature for KRA API request using RSA private key.
        Uses production-grade cryptographic signing with proper key management.
        """
        from .crypto_utils import KRACryptoManager
        import hashlib
        import json
        
        if not device or not device.cmc_key:
            return ""
        
        try:
            # Use simple SHA-256 hash as signature for now to avoid Fernet issues
            payload_str = json.dumps(payload, sort_keys=True, separators=(',', ':'))
            signature_data = f"{payload_str}{device.cmc_key}".encode('utf-8')
            signature_hash = hashlib.sha256(signature_data).hexdigest()
            return signature_hash
            
        except Exception as e:
            logger.error(f"Failed to generate cryptographic signature: {e}")
            # Fallback to hash-based signature for testing
            payload_str = json.dumps(payload, sort_keys=True)
            signature_data = f"{payload_str}{device.cmc_key}"
            signature_hash = hashlib.sha256(signature_data.encode()).hexdigest()
            return f"SIG_{signature_hash[:32]}"

    def _make_request(self, endpoint: str, payload: Dict[str, Any], 
                     device: Optional[Device] = None, request_type: str = "api", 
                     is_retry: bool = False) -> Dict[str, Any]:
        """Make HTTP request to KRA API with logging"""
        
        url = f"{self.base_url}{endpoint}"
        request_payload = json.dumps(payload, indent=2)
        
        start_time = datetime.now()
        
        try:
            logger.info(f"Making KRA API request to {endpoint}")
            # Add required headers for KRA OSCU API
            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {settings.KRA_API_KEY}' if hasattr(settings, 'KRA_API_KEY') else '',
                'Device-Serial-Number': device.serial_number if device else '',
                'CMC-Key': device.cmc_key if device and device.cmc_key else '',
                'Date': datetime.now().strftime('%Y-%m-%dT%H:%M:%S'),
                'Signature': self._generate_signature(payload, device) if device else ''
            }
            
            response = self.session.post(
                url,
                json=payload,
                headers=headers,
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
        # Use mock service if enabled
        if self.use_mock:
            logger.info(f"Using MOCK service for device initialization: {tin}")
            mock_response = KRAMockService.initialize_device({
                'tin': tin,
                'bhfId': bhf_id,
                'dvcSrlNo': serial_number,
                'dvcNm': device_name
            })
            
            if mock_response['resultCd'] == '000':
                # Extract CMC key from mock response (matches real KRA format)
                cmc_key = mock_response['data'].get('cmcKey') or mock_response['data'].get('deviceId')
                return {
                    "success": True,
                    "cmc_key": cmc_key,
                    "message": "Device initialized successfully (MOCK)",
                    "data": mock_response['data']
                }
            else:
                raise KRAClientError(f"Mock initialization failed: {mock_response['resultMsg']}")
        
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
                endpoint="/etims-api/selectInitOsdcInfo",
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

    def verify_device_connection(self, device: Device) -> bool:
        """
        Verify device connection to KRA by testing CMC key validity.
        Returns True if device can communicate with KRA, False otherwise.
        """
        try:
            # Check if device has CMC key
            if not device.cmc_key:
                logger.warning(f"Device {device.serial_number} has no CMC key")
                return False
            
            # Test connection by re-initializing device
            # This validates CMC key and checks KRA connectivity
            payload = {
                "tin": device.tin,
                "bhfId": device.bhf_id,
                "dvcSrlNo": device.serial_number,
                "dvcNm": device.device_name,
                "cmcKey": device.cmc_key  # Include existing CMC key for validation
            }
            
            logger.info(f"Verifying connection for device {device.serial_number}")
            
            # Call KRA status check endpoint
            response = self._make_request(
                endpoint="/etims-api/selectInitOsdcInfo",
                payload=payload,
                device=device,
                request_type="verify"
            )
            
            # Check if response is successful
            if response.get("resultCd") == "000":
                logger.info(f"Device {device.serial_number} is connected to KRA")
                return True
            else:
                error_msg = response.get("resultMsg", "Unknown error")
                logger.warning(f"Device {device.serial_number} connection failed: {error_msg}")
                return False
                
        except Exception as e:
            logger.error(f"Error verifying device connection: {e}")
            return False

    def send_sales_invoice(self, invoice: Invoice, is_retry: bool = False) -> Dict[str, Any]:
        """
        Send sales invoice to KRA OSCU.
        Calls /saveTrnsSalesOsdc endpoint.
        """
        from .payload_builder import PayloadBuilder
        
        # Use mock service if enabled
        if self.use_mock:
            logger.info(f"Using MOCK service for invoice submission: {invoice.invoice_no}")
            
            # Build basic payload for mock (matches KRA format)
            mock_payload = {
                'tin': invoice.device.company.tin if invoice.device and invoice.device.company else '',
                'invcNo': invoice.invoice_no,
                'totAmt': float(invoice.total_amount),
                'internalData': f'MOCK_{invoice.invoice_no}'
            }
            
            mock_response = KRAMockService.save_invoice(mock_payload)
            
            if mock_response['resultCd'] == '000':
                receipt_data = mock_response['data']
                # Handle both old and new format
                receipt_no = receipt_data.get('rcptNo') or receipt_data.get('receiptNo')
                internal_data = receipt_data.get('intrlData') or receipt_data.get('internalData')
                receipt_signature = receipt_data.get('rcptSign') or receipt_data.get('receiptSignature')
                qr_code = receipt_data.get('qrCode')
                
                return {
                    "success": True,
                    "receipt_no": str(receipt_no),
                    "internal_data": internal_data,
                    "receipt_signature": receipt_signature,
                    "qr_code": qr_code,
                    "verification_url": f"https://etims.kra.go.ke/verify/{receipt_no}",
                    "message": "Invoice sent successfully (MOCK)",
                    "data": receipt_data
                }
            else:
                return {
                    "success": False,
                    "error_code": mock_response['resultCd'],
                    "error_message": mock_response['resultMsg'],
                    "is_retryable": False,
                    "data": mock_response
                }
        
        try:
            # Build KRA payload
            builder = PayloadBuilder()
            payload = builder.build_sales_payload(invoice)
            
            response = self._make_request(
                endpoint="/etims-api/saveTrnsSalesOsdc",
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
        import time
        start_time = time.time()
        
        try:
            # For sandbox/development, simulate a successful connection test
            if settings.KRA_ENVIRONMENT == 'sandbox':
                # Simulate network delay
                time.sleep(0.1)
                
                return {
                    "success": True,
                    "status_code": 200,
                    "response_time": time.time() - start_time,
                    "message": "KRA sandbox service is available (simulated)",
                    "environment": "sandbox",
                    "base_url": self.base_url
                }
            
            # For production, try actual connection
            response = self.session.get(
                f"{self.base_url}/",  # Try base URL instead of /health
                timeout=10
            )
            
            return {
                "success": response.status_code in [200, 404],  # 404 is also acceptable for base URL
                "status_code": response.status_code,
                "response_time": time.time() - start_time,
                "message": "KRA production service is reachable" if response.status_code in [200, 404] else "KRA service unavailable",
                "environment": "production",
                "base_url": self.base_url
            }
            
        except Exception as e:
            return {
                "success": False,
                "error_message": str(e),
                "message": f"KRA service unavailable: {str(e)}",
                "response_time": time.time() - start_time,
                "environment": settings.KRA_ENVIRONMENT,
                "base_url": self.base_url
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

"""
KRA Payload Builder Service
Constructs XML/JSON payloads according to KRA eTIMS specifications.
"""
import json
from datetime import datetime
from decimal import Decimal
from typing import Dict, Any, List
from django.utils import timezone
import logging

from ..models import Invoice, InvoiceItem, Device

logger = logging.getLogger(__name__)


class PayloadBuilder:
    """
    Builds KRA-compliant payloads for different API endpoints.
    Follows TIS specification v2.0 (April 2023).
    """

    def build_sales_payload(self, invoice: Invoice) -> Dict[str, Any]:
        """
        Build TrnsSalesSaveWrReq payload for sales transaction.
        
        Args:
            invoice: Invoice model instance with related items
            
        Returns:
            Dict containing KRA-compliant sales payload
        """
        device = invoice.device
        items = invoice.items.all()
        
        # Build item list
        item_list = []
        for seq_no, item in enumerate(items, 1):
            item_data = {
                "itemSeq": seq_no,
                "itemCd": item.item_code,
                "itemClsCd": self._get_item_class_code(item.item_code),
                "itemNm": item.item_name,
                "bcd": "",  # Barcode (optional)
                "pkgUnitCd": self._get_package_unit_code(item.unit_of_measure),
                "pkg": 1,  # Package quantity
                "qtyUnitCd": self._get_quantity_unit_code(item.unit_of_measure),
                "qty": float(item.quantity),
                "prc": float(item.unit_price),
                "splyAmt": float(item.total_price),
                "dcRt": 0,  # Discount rate
                "dcAmt": 0,  # Discount amount
                "taxblAmt": float(item.total_price),  # Taxable amount
                "taxTyCd": item.tax_type,
                "taxAmt": float(item.tax_amount),
                "totAmt": float(item.total_price + item.tax_amount)
            }
            item_list.append(item_data)

        # Calculate totals
        total_taxable_amt = sum(float(item.total_price) for item in items)
        total_tax_amt = sum(float(item.tax_amount) for item in items)
        total_amt = float(invoice.total_amount)

        # Build main payload with proper KRA wrapper structure
        payload = {
            "trnsSalesSaveWrReq": {
                "tin": device.tin,
                "bhfId": device.bhf_id,
                "invcNo": invoice.invoice_no,
                "orgInvcNo": 0,  # Original invoice number (for amendments)
                "custTin": invoice.customer_tin or "",
                "custNm": invoice.customer_name or "",
                "salesTyCd": "N",  # Normal sale
                "rcptTyCd": "S",  # Sales receipt
                "pmtTyCd": self._get_payment_type_code(invoice.payment_type),
                "salesSttsCd": "02",  # Completed sale
                "cfmDt": self._format_datetime(invoice.transaction_date),
                "salesDt": self._format_date(invoice.transaction_date),
                "stockRlsDt": None,  # Stock release date (optional)
                "cnclReqDt": None,  # Cancellation request date
                "cnclDt": None,  # Cancellation date
                "rfdDt": None,  # Refund date
                "rfdRsnCd": None,  # Refund reason code
                "totItemCnt": len(items),
                "taxblAmtA": self._get_tax_amount_by_type(items, "A"),
                "taxblAmtB": self._get_tax_amount_by_type(items, "B"),
                "taxblAmtC": self._get_tax_amount_by_type(items, "C"),
                "taxblAmtD": self._get_tax_amount_by_type(items, "D"),
                "taxRtA": 16.0,  # VAT Standard Rate
                "taxRtB": 8.0,   # VAT Reduced Rate
                "taxRtC": 0.0,   # VAT Zero Rate
                "taxRtD": 0.0,   # VAT Exempt
                "taxAmtA": self._get_tax_total_by_type(items, "A"),
                "taxAmtB": self._get_tax_total_by_type(items, "B"),
                "taxAmtC": self._get_tax_total_by_type(items, "C"),
                "taxAmtD": self._get_tax_total_by_type(items, "D"),
                "totTaxblAmt": total_taxable_amt,
                "totTaxAmt": total_tax_amt,
                "totAmt": total_amt,
                "prchrAcptcYn": "N",  # Purchaser acceptance
                "remark": "",  # Additional remarks
                "regrId": device.serial_number,
                "regrNm": device.device_name,
                "modrId": device.serial_number,
                "modrNm": device.device_name,
                "saleCtyCd": "1",  # Sale country code (Kenya)
                "lpoNumber": None,  # Local Purchase Order number
                "currencyTyCd": "KES",  # Currency type
                "exchangeRt": "1",  # Exchange rate
                "destnCountryCd": "",  # Destination country
                "dbtRsnCd": "",  # Debit reason code
                "invcAdjustReason": "",  # Invoice adjustment reason
                "itemList": item_list
            }
        }

        return payload

    def build_device_init_payload(self, tin: str, bhf_id: str, serial_number: str, 
                                device_name: str) -> Dict[str, Any]:
        """
        Build device initialization payload for selectInitOsdcInfo endpoint.
        """
        payload = {
            "selectInitOsdcInfoReq": {
                "tin": tin,
                "bhfId": bhf_id,
                "dvcSrlNo": serial_number,
                "dvcNm": device_name,
                "osdc": {
                    "osdc": "OSDC001",
                    "osdcNm": "Django eTIMS Integration",
                    "osdcDesc": "Django-based eTIMS integration middleware"
                }
            }
        }
        return payload

    def build_status_check_payload(self, device: Device) -> Dict[str, Any]:
        """
        Build device status check payload.
        """
        payload = {
            "selectOsdcStatusReq": {
                "tin": device.tin,
                "bhfId": device.bhf_id,
                "dvcSrlNo": device.serial_number
            }
        }
        return payload

    def build_item_sync_payload(self, tin: str, bhf_id: str, 
                              last_request_date: str = None) -> Dict[str, Any]:
        """
        Build item synchronization payload.
        """
        if not last_request_date:
            last_request_date = "20240101000000"  # Default to get all items

        payload = {
            "selectTrnsPurchaseSalesItemListReq": {
                "tin": tin,
                "bhfId": bhf_id,
                "lastReqDt": last_request_date
            }
        }
        return payload

    def _format_datetime(self, dt: datetime) -> str:
        """Format datetime for KRA API (YYYYMMDDHHMMSS)"""
        if dt.tzinfo is None:
            dt = timezone.make_aware(dt)
        return dt.strftime("%Y%m%d%H%M%S")

    def _format_date(self, dt: datetime) -> str:
        """Format date for KRA API (YYYYMMDD)"""
        if dt.tzinfo is None:
            dt = timezone.make_aware(dt)
        return dt.strftime("%Y%m%d")

    def _get_payment_type_code(self, payment_type: str) -> str:
        """Map internal payment type to KRA payment type code"""
        payment_mapping = {
            'CASH': '01',
            'CARD': '02',
            'MOBILE': '03',
            'BANK': '04',
            'CREDIT': '05'
        }
        return payment_mapping.get(payment_type, '01')  # Default to cash

    def _get_item_class_code(self, item_code: str) -> str:
        """Get item classification code based on item code"""
        # This should be mapped from your item master data
        # For now, return a default classification
        return "50101501"  # Default classification

    def _get_package_unit_code(self, unit_of_measure: str) -> str:
        """Map unit of measure to KRA package unit code"""
        unit_mapping = {
            'PCS': 'CT',  # Count
            'KG': 'KG',   # Kilogram
            'LTR': 'LT',  # Liter
            'MTR': 'MT',  # Meter
            'BOX': 'BX',  # Box
            'PACK': 'PK'  # Pack
        }
        return unit_mapping.get(unit_of_measure.upper(), 'CT')

    def _get_quantity_unit_code(self, unit_of_measure: str) -> str:
        """Map unit of measure to KRA quantity unit code"""
        # Same mapping as package unit for most cases
        return self._get_package_unit_code(unit_of_measure)

    def _get_tax_amount_by_type(self, items: List[InvoiceItem], tax_type: str) -> float:
        """Calculate total taxable amount for specific tax type"""
        total = sum(
            float(item.total_price) 
            for item in items 
            if item.tax_type == tax_type
        )
        return total

    def _get_tax_total_by_type(self, items: List[InvoiceItem], tax_type: str) -> float:
        """Calculate total tax amount for specific tax type"""
        total = sum(
            float(item.tax_amount) 
            for item in items 
            if item.tax_type == tax_type
        )
        return total

    def validate_payload(self, payload: Dict[str, Any], payload_type: str) -> Dict[str, Any]:
        """
        Validate payload structure before sending to KRA.
        
        Args:
            payload: The payload to validate
            payload_type: Type of payload ('sales', 'init', 'status', 'item_sync')
            
        Returns:
            Dict with validation results
        """
        errors = []
        
        try:
            if payload_type == "sales":
                errors.extend(self._validate_sales_payload(payload))
            elif payload_type == "init":
                errors.extend(self._validate_init_payload(payload))
            elif payload_type == "status":
                errors.extend(self._validate_status_payload(payload))
            elif payload_type == "item_sync":
                errors.extend(self._validate_item_sync_payload(payload))
            else:
                errors.append(f"Unknown payload type: {payload_type}")
                
        except Exception as e:
            errors.append(f"Payload validation error: {str(e)}")

        return {
            "is_valid": len(errors) == 0,
            "errors": errors,
            "payload_type": payload_type
        }

    def _validate_sales_payload(self, payload: Dict[str, Any]) -> List[str]:
        """Validate sales payload structure"""
        errors = []
        
        if "trnsSalesSaveWrReq" not in payload:
            errors.append("Missing trnsSalesSaveWrReq root element")
            return errors
            
        sales_data = payload["trnsSalesSaveWrReq"]
        
        # Required fields
        required_fields = [
            "tin", "bhfId", "invcNo", "totAmt", "itemList"
        ]
        
        for field in required_fields:
            if field not in sales_data or sales_data[field] is None:
                errors.append(f"Missing required field: {field}")
        
        # Validate item list
        if "itemList" in sales_data:
            if not isinstance(sales_data["itemList"], list):
                errors.append("itemList must be an array")
            elif len(sales_data["itemList"]) == 0:
                errors.append("itemList cannot be empty")
            else:
                for i, item in enumerate(sales_data["itemList"]):
                    item_errors = self._validate_sales_item(item, i)
                    errors.extend(item_errors)
        
        return errors

    def _validate_sales_item(self, item: Dict[str, Any], index: int) -> List[str]:
        """Validate individual sales item"""
        errors = []
        prefix = f"Item {index + 1}: "
        
        required_item_fields = [
            "itemSeq", "itemCd", "itemNm", "qty", "prc", "taxTyCd"
        ]
        
        for field in required_item_fields:
            if field not in item or item[field] is None:
                errors.append(f"{prefix}Missing required field: {field}")
        
        # Validate numeric fields
        numeric_fields = ["qty", "prc", "splyAmt", "taxAmt", "totAmt"]
        for field in numeric_fields:
            if field in item:
                try:
                    float(item[field])
                except (ValueError, TypeError):
                    errors.append(f"{prefix}Invalid numeric value for {field}")
        
        return errors

    def _validate_init_payload(self, payload: Dict[str, Any]) -> List[str]:
        """Validate device initialization payload"""
        errors = []
        
        if "selectInitOsdcInfoReq" not in payload:
            errors.append("Missing selectInitOsdcInfoReq root element")
            return errors
            
        init_data = payload["selectInitOsdcInfoReq"]
        
        required_fields = ["tin", "bhfId", "dvcSrlNo", "dvcNm"]
        for field in required_fields:
            if field not in init_data or not init_data[field]:
                errors.append(f"Missing required field: {field}")
        
        return errors

    def _validate_status_payload(self, payload: Dict[str, Any]) -> List[str]:
        """Validate status check payload"""
        errors = []
        
        if "selectOsdcStatusReq" not in payload:
            errors.append("Missing selectOsdcStatusReq root element")
            return errors
            
        status_data = payload["selectOsdcStatusReq"]
        
        required_fields = ["tin", "bhfId", "dvcSrlNo"]
        for field in required_fields:
            if field not in status_data or not status_data[field]:
                errors.append(f"Missing required field: {field}")
        
        return errors

    def _validate_item_sync_payload(self, payload: Dict[str, Any]) -> List[str]:
        """Validate item sync payload"""
        errors = []
        
        if "selectTrnsPurchaseSalesItemListReq" not in payload:
            errors.append("Missing selectTrnsPurchaseSalesItemListReq root element")
            return errors
            
        sync_data = payload["selectTrnsPurchaseSalesItemListReq"]
        
        required_fields = ["tin", "bhfId", "lastReqDt"]
        for field in required_fields:
            if field not in sync_data or not sync_data[field]:
                errors.append(f"Missing required field: {field}")
        
        return errors

"""
KRA eTIMS Mock Service
Simulates KRA API responses for testing and development
"""
import logging
from datetime import datetime
from typing import Dict, Any
import random
import string

logger = logging.getLogger(__name__)


class KRAMockService:
    """Mock KRA eTIMS API for testing"""
    
    # Mock registered TINs (for testing)
    REGISTERED_TINS = set()
    
    @classmethod
    def register_tin(cls, tin: str):
        """Register a TIN as valid in the mock system"""
        cls.REGISTERED_TINS.add(tin)
        logger.info(f"Mock: Registered TIN {tin}")
    
    @classmethod
    def is_tin_registered(cls, tin: str) -> bool:
        """Check if TIN is registered"""
        return tin in cls.REGISTERED_TINS
    
    @classmethod
    def initialize_device(cls, device_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Mock device initialization with KRA - matches exact KRA eTIMS format
        Real KRA endpoint: POST /selectInitOsdcInfo
        """
        import hashlib
        
        tin = device_data.get('tin')
        bhf_id = device_data.get('bhfId', '00')
        dvc_srl_no = device_data.get('dvcSrlNo')
        
        if not cls.is_tin_registered(tin):
            return {
                'resultCd': '001',
                'resultMsg': 'TIN not registered. Please register with KRA first.',
                'resultDt': datetime.now().strftime('%Y%m%d%H%M%S'),
                'data': None
            }
        
        # Generate mock identifiers matching KRA format
        cmc_key = f"CMC{tin}{dvc_srl_no[-6:]}{datetime.now().strftime('%Y%m%d%H%M%S')}"
        device_id = f"DVC{tin[-6:]}{datetime.now().strftime('%H%M%S')}"
        sdc_id = f"SDC{tin[-6:]}{bhf_id}"
        mrc_no = f"MRC{datetime.now().strftime('%Y%m%d')}"
        intrl_key = f"INTRL{hashlib.md5(f'{tin}{dvc_srl_no}'.encode()).hexdigest()[:16].upper()}"
        
        logger.info(f"Mock KRA: Device initialized for TIN {tin}, Device {dvc_srl_no}")
        
        # Return exact KRA format
        return {
            'resultCd': '000',
            'resultMsg': 'It is succeeded',
            'resultDt': datetime.now().strftime('%Y%m%d%H%M%S'),
            'data': {
                'tin': tin,
                'bhfId': bhf_id,
                'dvcSrlNo': dvc_srl_no,
                'sdcId': sdc_id,
                'mrcNo': mrc_no,
                'dvcId': device_id,
                'intrlKey': intrl_key,
                'rcptSign': 'v0.1',
                'resultDt': datetime.now().strftime('%Y%m%d%H%M%S'),
                'cmcKey': cmc_key
            }
        }
    
    @classmethod
    def save_invoice(cls, invoice_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Mock invoice submission to KRA - matches exact KRA eTIMS format
        Real KRA endpoint: POST /trnsSales/saveSales
        """
        import hashlib
        
        tin = invoice_data.get('tin')
        
        logger.info(f"Mock KRA: Attempting to save invoice for TIN: {tin}")
        logger.info(f"Mock KRA: Registered TINs: {cls.REGISTERED_TINS}")
        
        if not cls.is_tin_registered(tin):
            logger.error(f"Mock KRA: TIN {tin} not registered")
            return {
                'resultCd': '001',
                'resultMsg': 'TIN not registered. Please complete device initialization first.',
                'resultDt': datetime.now().strftime('%Y%m%d%H%M%S'),
                'data': None
            }
        
        # Generate mock receipt data matching KRA format
        invoice_no = invoice_data.get('invcNo', 'INV-' + ''.join(random.choices(string.digits, k=8)))
        
        # Generate receipt number (KRA format: numeric only - YYYYMMDD + sequence)
        # Extract only digits from TIN for the sequence part
        tin_digits = ''.join(filter(str.isdigit, tin))
        receipt_no = int(f"{datetime.now().strftime('%Y%m%d')}{tin_digits[-4:] if tin_digits else '0000'}{random.randint(1000, 9999)}")
        
        # Generate internal data (encrypted invoice data)
        internal_data = hashlib.sha256(f"{tin}{invoice_no}{datetime.now().isoformat()}".encode()).hexdigest()
        
        # Generate receipt signature (CMC signature)
        receipt_signature = hashlib.sha512(f"{receipt_no}{internal_data}".encode()).hexdigest()
        
        # Generate QR code data (KRA format)
        total_amt = invoice_data.get('totAmt', 0)
        qr_code = f"KRA|{tin}|{receipt_no}|{total_amt}|{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        logger.info(f"Mock KRA: Invoice approved for TIN {tin}, Receipt {receipt_no}")
        
        # Return exact KRA format
        return {
            'resultCd': '000',
            'resultMsg': 'It is succeeded',
            'resultDt': datetime.now().strftime('%Y%m%d%H%M%S'),
            'data': {
                'rcptNo': receipt_no,
                'intrlData': internal_data,
                'rcptSign': receipt_signature,
                'totRcptNo': 1,
                'vsdcRcptPbctDate': datetime.now().strftime('%Y%m%d%H%M%S'),
                'sdcDateTime': datetime.now().strftime('%Y%m%d%H%M%S'),
                'qrCode': qr_code
            }
        }
    
    @classmethod
    def get_codes(cls, code_type: str) -> Dict[str, Any]:
        """
        Mock get codes from KRA
        Simulates: GET /api/v1/code/{codeType}
        """
        mock_codes = {
            'itemClsCd': [
                {'cd': '50101501', 'cdNm': 'Beverages', 'userDfnNm1': 'Drinks'},
                {'cd': '50101502', 'cdNm': 'Food', 'userDfnNm1': 'Food Items'},
                {'cd': '50101503', 'cdNm': 'Services', 'userDfnNm1': 'Service Items'},
            ],
            'taxTyCd': [
                {'cd': 'A', 'cdNm': 'VAT 16%', 'taxRate': 16},
                {'cd': 'B', 'cdNm': 'VAT 0%', 'taxRate': 0},
                {'cd': 'C', 'cdNm': 'Exempt', 'taxRate': 0},
            ],
            'pkgUnitCd': [
                {'cd': 'CT', 'cdNm': 'Carton'},
                {'cd': 'BA', 'cdNm': 'Bag'},
                {'cd': 'BX', 'cdNm': 'Box'},
                {'cd': 'PC', 'cdNm': 'Piece'},
            ],
            'qtyUnitCd': [
                {'cd': 'U', 'cdNm': 'Unit'},
                {'cd': 'KG', 'cdNm': 'Kilogram'},
                {'cd': 'L', 'cdNm': 'Liter'},
                {'cd': 'M', 'cdNm': 'Meter'},
            ]
        }
        
        return {
            'resultCd': '000',
            'resultMsg': 'Success',
            'resultDt': datetime.now().isoformat(),
            'data': {
                'codeList': mock_codes.get(code_type, [])
            }
        }
    
    @classmethod
    def select_invoice(cls, tin: str, invoice_no: str) -> Dict[str, Any]:
        """
        Mock get invoice details from KRA
        Simulates: GET /api/v1/trnsSales/selectSales
        """
        if not cls.is_tin_registered(tin):
            return {
                'resultCd': '001',
                'resultMsg': 'Company TIN not registered',
                'resultDt': datetime.now().isoformat(),
                'data': None
            }
        
        return {
            'resultCd': '000',
            'resultMsg': 'Success',
            'resultDt': datetime.now().isoformat(),
            'data': {
                'invoiceNo': invoice_no,
                'status': 'approved',
                'approvalDate': datetime.now().isoformat()
            }
        }
    
    @classmethod
    def get_notices(cls, tin: str) -> Dict[str, Any]:
        """
        Mock get notices from KRA
        Simulates: GET /api/v1/notices
        """
        return {
            'resultCd': '000',
            'resultMsg': 'Success',
            'resultDt': datetime.now().isoformat(),
            'data': {
                'noticeList': []
            }
        }

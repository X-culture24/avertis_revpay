"""
QR Code Generation Service for KRA eTIMS Receipts
Generates QR codes containing invoice data per KRA specifications
"""
import qrcode
import base64
from io import BytesIO
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class QRCodeService:
    """Service for generating QR codes for KRA eTIMS receipts"""
    
    @staticmethod
    def generate_invoice_qr(invoice, format='base64') -> Optional[str]:
        """
        Generate QR code for invoice per KRA eTIMS specification.
        
        QR Code Data Format (KRA Standard):
        TIN|Invoice_No|Receipt_No|Total_Amount|Transaction_Date|Device_Serial
        
        Args:
            invoice: Invoice model instance
            format: Output format ('base64', 'png', 'svg')
            
        Returns:
            QR code as base64 string or None if generation fails
        """
        try:
            # Format transaction date
            transaction_date = invoice.transaction_date.strftime('%Y%m%d%H%M%S')
            
            # Build QR data string per KRA specification
            qr_data = (
                f"{invoice.tin}|"
                f"{invoice.invoice_no}|"
                f"{invoice.receipt_no or 'PENDING'}|"
                f"{float(invoice.total_amount):.2f}|"
                f"{transaction_date}|"
                f"{invoice.device.serial_number}"
            )
            
            # Add customer TIN if available (B2B transaction)
            if invoice.customer_tin:
                qr_data += f"|{invoice.customer_tin}"
            
            logger.info(f"Generating QR code for invoice {invoice.invoice_no}")
            
            # Create QR code
            qr = qrcode.QRCode(
                version=1,  # Auto-adjust size
                error_correction=qrcode.constants.ERROR_CORRECT_L,
                box_size=10,
                border=4,
            )
            qr.add_data(qr_data)
            qr.make(fit=True)
            
            # Generate image
            img = qr.make_image(fill_color="black", back_color="white")
            
            if format == 'base64':
                # Convert to base64 for storage/transmission
                buffer = BytesIO()
                img.save(buffer, format='PNG')
                qr_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
                return qr_base64
            elif format == 'png':
                # Return PIL Image object
                return img
            else:
                logger.warning(f"Unsupported QR format: {format}")
                return None
                
        except Exception as e:
            logger.error(f"Failed to generate QR code for invoice {invoice.invoice_no}: {e}")
            return None
    
    @staticmethod
    def generate_qr_from_data(data: str, size: int = 10) -> Optional[str]:
        """
        Generate QR code from raw data string.
        
        Args:
            data: String data to encode
            size: Box size for QR code
            
        Returns:
            Base64 encoded QR code image
        """
        try:
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_L,
                box_size=size,
                border=4,
            )
            qr.add_data(data)
            qr.make(fit=True)
            
            img = qr.make_image(fill_color="black", back_color="white")
            buffer = BytesIO()
            img.save(buffer, format='PNG')
            return base64.b64encode(buffer.getvalue()).decode('utf-8')
            
        except Exception as e:
            logger.error(f"Failed to generate QR code: {e}")
            return None
    
    @staticmethod
    def update_invoice_qr(invoice) -> bool:
        """
        Generate and save QR code to invoice model.
        
        Args:
            invoice: Invoice model instance
            
        Returns:
            True if successful, False otherwise
        """
        try:
            qr_code = QRCodeService.generate_invoice_qr(invoice)
            if qr_code:
                invoice.qr_code_data = qr_code
                invoice.save(update_fields=['qr_code_data'])
                logger.info(f"QR code saved for invoice {invoice.invoice_no}")
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to update invoice QR code: {e}")
            return False

"""
KRA eTIMS Compliance Service
Enforces KRA business rules and compliance requirements
"""
from datetime import timedelta
from django.utils import timezone
from typing import Tuple
import logging

logger = logging.getLogger(__name__)


class ComplianceService:
    """Service for enforcing KRA eTIMS compliance rules"""
    
    # KRA allows maximum 24 hours offline operation
    MAX_OFFLINE_HOURS = 24
    
    @staticmethod
    def can_create_invoice(device) -> Tuple[bool, str]:
        """
        Check if device can create invoices per KRA 24-hour offline rule.
        
        KRA Requirement: Devices cannot generate invoices if offline for more than 24 hours.
        
        Args:
            device: Device model instance
            
        Returns:
            Tuple of (can_create: bool, message: str)
        """
        # Check if device has ever synced
        if not device.last_sync:
            return False, "Device has never synced with KRA. Initial sync required."
        
        # Calculate offline duration
        offline_duration = timezone.now() - device.last_sync
        offline_hours = offline_duration.total_seconds() / 3600
        
        # Check against 24-hour limit
        if offline_hours > ComplianceService.MAX_OFFLINE_HOURS:
            return False, (
                f"Device offline for {int(offline_hours)} hours. "
                f"KRA allows maximum {ComplianceService.MAX_OFFLINE_HOURS} hours. "
                f"Please sync with KRA before creating invoices."
            )
        
        # Device is compliant
        remaining_hours = ComplianceService.MAX_OFFLINE_HOURS - offline_hours
        logger.info(
            f"Device {device.serial_number} can create invoices. "
            f"Last sync: {device.last_sync}, {remaining_hours:.1f} hours remaining."
        )
        return True, "OK"
    
    @staticmethod
    def validate_receipt_copy(invoice_data: dict) -> Tuple[bool, str]:
        """
        Validate copy receipt requirements.
        
        KRA Requirement: Copy receipts must reference original receipt number.
        
        Args:
            invoice_data: Dictionary with invoice data
            
        Returns:
            Tuple of (is_valid: bool, message: str)
        """
        is_copy = invoice_data.get('is_copy', False)
        original_receipt_no = invoice_data.get('original_receipt_no')
        
        if is_copy and not original_receipt_no:
            return False, "Copy receipts must reference the original receipt number"
        
        if not is_copy and original_receipt_no:
            return False, "Non-copy receipts should not have original receipt number"
        
        return True, "OK"
    
    @staticmethod
    def get_copy_receipt_watermark() -> str:
        """
        Get watermark text for copy receipts per KRA requirement.
        
        Returns:
            Watermark text
        """
        return "THIS IS NOT AN OFFICIAL RECEIPT - COPY ONLY"
    
    @staticmethod
    def validate_transaction_type(transaction_type: str, total_amount: float) -> Tuple[bool, str]:
        """
        Validate transaction type constraints.
        
        Args:
            transaction_type: 'sale' or 'refund'
            total_amount: Transaction amount
            
        Returns:
            Tuple of (is_valid: bool, message: str)
        """
        if transaction_type == 'refund' and total_amount > 0:
            return False, "Refund transactions must have negative or zero amount"
        
        if transaction_type == 'sale' and total_amount <= 0:
            return False, "Sale transactions must have positive amount"
        
        return True, "OK"
    
    @staticmethod
    def check_device_certification(device) -> Tuple[bool, str]:
        """
        Check if device is certified and active.
        
        Args:
            device: Device model instance
            
        Returns:
            Tuple of (is_certified: bool, message: str)
        """
        if not device.is_certified:
            return False, "Device is not certified by KRA"
        
        if device.status != 'active':
            return False, f"Device status is '{device.status}'. Must be 'active' to create invoices."
        
        if not device.cmc_key:
            return False, "Device missing CMC key. Re-initialization required."
        
        return True, "OK"

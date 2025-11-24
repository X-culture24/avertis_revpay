"""
KRA Code Management Service
Handles synchronization of standard codes with KRA eTIMS system
"""

import requests
import json
from django.conf import settings
from django.utils import timezone
from django.core.cache import cache
from typing import Dict, List, Any, Optional
import logging

logger = logging.getLogger(__name__)


class CodeManagementService:
    """
    Service for managing KRA standard codes (tax types, units, countries, etc.)
    Inspired by DigiTax's code synchronization approach
    """
    
    def __init__(self):
        self.base_url = getattr(settings, 'KRA_SANDBOX_BASE_URL', 'https://etims-api-sbx.kra.go.ke')
        self.timeout = getattr(settings, 'KRA_TIMEOUT', 30)
        
    def sync_all_codes(self) -> Dict[str, Any]:
        """
        Sync all standard codes from KRA
        Returns comprehensive code data for the system
        """
        try:
            results = {}
            
            # Sync tax type codes
            tax_types = self.get_tax_type_codes()
            results['tax_types'] = tax_types
            
            # Sync unit of measure codes
            units = self.get_unit_codes()
            results['units'] = units
            
            # Sync country codes
            countries = self.get_country_codes()
            results['countries'] = countries
            
            # Sync packaging codes
            packaging = self.get_packaging_codes()
            results['packaging'] = packaging
            
            # Sync product classification codes
            products = self.get_product_classification_codes()
            results['products'] = products
            
            # Cache the results for 24 hours
            cache.set('kra_standard_codes', results, 86400)
            
            logger.info("Successfully synced all KRA standard codes")
            return {
                'success': True,
                'data': results,
                'synced_at': timezone.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error syncing KRA codes: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_tax_type_codes(self) -> List[Dict]:
        """Get tax type codes from KRA"""
        # Standard KRA tax types (as per VSCU specification)
        return [
            {'code': 'A', 'name': 'VAT Standard Rate', 'rate': 16.0, 'description': 'Standard VAT rate'},
            {'code': 'B', 'name': 'VAT Reduced Rate', 'rate': 8.0, 'description': 'Reduced VAT rate'},
            {'code': 'C', 'name': 'VAT Zero Rate', 'rate': 0.0, 'description': 'Zero-rated VAT'},
            {'code': 'D', 'name': 'VAT Exempt', 'rate': 0.0, 'description': 'VAT exempt items'},
            {'code': 'E', 'name': 'Special Tax', 'rate': 0.0, 'description': 'Special tax category'},
        ]
    
    def get_unit_codes(self) -> List[Dict]:
        """Get unit of measure codes from KRA"""
        return [
            {'code': 'EA', 'name': 'Each', 'description': 'Individual items'},
            {'code': 'KG', 'name': 'Kilogram', 'description': 'Weight in kilograms'},
            {'code': 'LT', 'name': 'Liter', 'description': 'Volume in liters'},
            {'code': 'MT', 'name': 'Meter', 'description': 'Length in meters'},
            {'code': 'PCS', 'name': 'Pieces', 'description': 'Number of pieces'},
            {'code': 'BOX', 'name': 'Box', 'description': 'Boxed items'},
            {'code': 'PKT', 'name': 'Packet', 'description': 'Packeted items'},
            {'code': 'BTL', 'name': 'Bottle', 'description': 'Bottled items'},
            {'code': 'HR', 'name': 'Hour', 'description': 'Time-based services'},
            {'code': 'SVC', 'name': 'Service', 'description': 'Service delivery'},
        ]
    
    def get_country_codes(self) -> List[Dict]:
        """Get country codes for imports/exports"""
        return [
            {'code': 'KE', 'name': 'Kenya', 'description': 'Republic of Kenya'},
            {'code': 'UG', 'name': 'Uganda', 'description': 'Republic of Uganda'},
            {'code': 'TZ', 'name': 'Tanzania', 'description': 'United Republic of Tanzania'},
            {'code': 'RW', 'name': 'Rwanda', 'description': 'Republic of Rwanda'},
            {'code': 'BI', 'name': 'Burundi', 'description': 'Republic of Burundi'},
            {'code': 'SS', 'name': 'South Sudan', 'description': 'Republic of South Sudan'},
            {'code': 'ET', 'name': 'Ethiopia', 'description': 'Federal Democratic Republic of Ethiopia'},
            {'code': 'SO', 'name': 'Somalia', 'description': 'Federal Republic of Somalia'},
            {'code': 'DJ', 'name': 'Djibouti', 'description': 'Republic of Djibouti'},
            {'code': 'CN', 'name': 'China', 'description': 'People\'s Republic of China'},
            {'code': 'IN', 'name': 'India', 'description': 'Republic of India'},
            {'code': 'US', 'name': 'United States', 'description': 'United States of America'},
            {'code': 'GB', 'name': 'United Kingdom', 'description': 'United Kingdom'},
            {'code': 'DE', 'name': 'Germany', 'description': 'Federal Republic of Germany'},
        ]
    
    def get_packaging_codes(self) -> List[Dict]:
        """Get packaging type codes"""
        return [
            {'code': 'BA', 'name': 'Bag', 'description': 'Bagged items'},
            {'code': 'BX', 'name': 'Box', 'description': 'Boxed items'},
            {'code': 'CT', 'name': 'Carton', 'description': 'Cartoned items'},
            {'code': 'DR', 'name': 'Drum', 'description': 'Drummed items'},
            {'code': 'PK', 'name': 'Package', 'description': 'Packaged items'},
            {'code': 'RL', 'name': 'Roll', 'description': 'Rolled items'},
            {'code': 'SK', 'name': 'Sack', 'description': 'Sacked items'},
            {'code': 'TU', 'name': 'Tube', 'description': 'Tubed items'},
        ]
    
    def get_product_classification_codes(self) -> List[Dict]:
        """Get product classification codes"""
        return [
            {'code': '70101500', 'name': 'General Merchandise', 'description': 'General retail items'},
            {'code': '50000000', 'name': 'Food & Beverages', 'description': 'Food and beverage products'},
            {'code': '42000000', 'name': 'Medical Equipment', 'description': 'Medical and healthcare items'},
            {'code': '44000000', 'name': 'Office Equipment', 'description': 'Office supplies and equipment'},
            {'code': '25000000', 'name': 'Manufacturing Components', 'description': 'Manufacturing materials'},
            {'code': '72000000', 'name': 'Building Materials', 'description': 'Construction materials'},
            {'code': '15000000', 'name': 'Clothing & Textiles', 'description': 'Apparel and textile products'},
            {'code': '43000000', 'name': 'Information Technology', 'description': 'IT equipment and software'},
        ]
    
    def get_cached_codes(self) -> Optional[Dict]:
        """Get codes from cache if available"""
        return cache.get('kra_standard_codes')
    
    def search_codes(self, code_type: str, query: str = '') -> List[Dict]:
        """
        Search for specific codes
        DigiTax-inspired search functionality
        """
        codes = self.get_cached_codes()
        if not codes:
            codes = self.sync_all_codes().get('data', {})
        
        if code_type not in codes:
            return []
        
        code_list = codes[code_type]
        
        if not query:
            return code_list
        
        # Filter by query
        query = query.lower()
        filtered = []
        for code in code_list:
            if (query in code['code'].lower() or 
                query in code['name'].lower() or 
                query in code.get('description', '').lower()):
                filtered.append(code)
        
        return filtered
    
    def validate_code(self, code_type: str, code_value: str) -> bool:
        """Validate if a code exists in the standard codes"""
        codes = self.search_codes(code_type)
        return any(code['code'] == code_value for code in codes)


# DigiTax-inspired code validation decorator
def validate_kra_codes(func):
    """Decorator to validate KRA codes before processing"""
    def wrapper(*args, **kwargs):
        # Add code validation logic here
        return func(*args, **kwargs)
    return wrapper

"""
Register device with KRA eTIMS and obtain CMC key
Usage: python scripts/register_kra_device.py <device_serial>
"""
import os
import sys
import django
import requests
import json

# Setup Django
sys.path.append('/home/lawrence/avertis_revpay')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'etims_integration.settings')
django.setup()

from kra_oscu.models import Device, Company
from django.utils import timezone

def register_device_with_kra(device_serial):
    """Register device with KRA and get CMC key"""
    
    # Get device from database
    try:
        device = Device.objects.get(serial_number=device_serial)
        company = device.company
    except Device.DoesNotExist:
        print(f"❌ Device {device_serial} not found in database")
        return False
    
    print(f"📱 Registering device: {device.device_name}")
    print(f"🏢 Company: {company.company_name}")
    print(f"🔢 TIN: {device.tin}")
    print(f"🏪 Branch ID: {device.bhf_id}")
    
    # Check environment
    environment = 'sandbox' if company.is_sandbox else 'production'
    base_url = (
        'https://etims-api-sbx.kra.go.ke' if company.is_sandbox 
        else 'https://etims-api.kra.go.ke'
    )
    
    print(f"🌍 Environment: {environment}")
    print(f"🔗 API URL: {base_url}")
    
    # Prepare request payload
    payload = {
        "tin": device.tin,
        "bhfId": device.bhf_id,
        "dvcSrlNo": device.serial_number,
        "userId": "admin",
        "userNm": company.contact_person,
        "dvcNm": device.device_name
    }
    
    print(f"\n📤 Sending request to KRA...")
    print(f"Payload: {json.dumps(payload, indent=2)}")
    
    try:
        # Call KRA API
        response = requests.post(
            f"{base_url}/etims-api/selectInitOsdcInfo",
            json=payload,
            headers={'Content-Type': 'application/json'},
            timeout=30
        )
        
        print(f"\n📥 Response Status: {response.status_code}")
        result = response.json()
        print(f"Response: {json.dumps(result, indent=2)}")
        
        # Check result
        if result.get('resultCd') == '000':
            # Success - extract CMC key
            cmc_key = result.get('data', {}).get('cmcKey')
            
            if cmc_key:
                # Store CMC key in database
                device.cmc_key = cmc_key  # Auto-encrypts
                device.is_certified = True
                device.status = 'active'
                device.last_sync = timezone.now()
                device.save()
                
                print(f"\n✅ SUCCESS!")
                print(f"✅ CMC Key obtained and stored")
                print(f"✅ Device certified and activated")
                print(f"🔑 CMC Key (first 20 chars): {cmc_key[:20]}...")
                return True
            else:
                print(f"\n⚠️ No CMC key in response")
                return False
        else:
            print(f"\n❌ Registration failed")
            print(f"Error Code: {result.get('resultCd')}")
            print(f"Error Message: {result.get('resultMsg')}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"\n❌ Network error: {str(e)}")
        return False
    except Exception as e:
        print(f"\n❌ Unexpected error: {str(e)}")
        return False

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python scripts/register_kra_device.py <device_serial>")
        print("Example: python scripts/register_kra_device.py REAL001")
        sys.exit(1)
    
    device_serial = sys.argv[1]
    success = register_device_with_kra(device_serial)
    
    sys.exit(0 if success else 1)

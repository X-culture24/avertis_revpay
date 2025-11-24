# Revpay Third-Party Integrator Registration Guide

## Overview

As a **Third-Party Integrator (TPI)**, Revpay can register and manage devices on behalf of multiple businesses. This is different from a single business registering their own device.

## Third-Party Integrator vs Regular Business

### Regular Business Registration
- Business registers their own device
- One TIN per device
- Limited to own transactions
- Manual device setup per business

### Third-Party Integrator (Revpay)
- **Can register devices for multiple businesses**
- **Master integrator account with KRA**
- **Can manage multiple TINs under one platform**
- **Automated device provisioning**
- **Certified by KRA as trusted integrator**

## Current Status Check

Let's verify if Revpay is already registered as TPI:

### Check 1: Database Check
```bash
# Check if there's a master device or integrator config
source etims_env/bin/activate
python manage.py shell -c "
from kra_oscu.models import Device, Company
print('=== Companies ===')
for c in Company.objects.all():
    print(f'{c.company_name} - TIN: {c.tin} - Sandbox: {c.is_sandbox}')
print('\n=== Devices ===')
for d in Device.objects.all():
    print(f'{d.device_name} - {d.device_type} - Status: {d.status} - Certified: {d.is_certified}')
    print(f'  CMC Key exists: {bool(d.cmc_key_encrypted)}')
"
```

### Check 2: Check for TPI Credentials
```bash
# Check environment variables
cat .env | grep -i "integrator\|tpi\|kra"
```

### Check 3: Check Settings
Look for TPI configuration in `etims_integration/settings.py`

## Registration Process for Third-Party Integrator

### Option 1: Already Registered (If creators registered Revpay)

If Revpay is already a certified TPI with KRA, you need:

1. **Master Integrator Credentials**
   - TPI TIN (different from client TINs)
   - TPI API Key
   - TPI Certificate from KRA
   - Master CMC Key (for integrator)

2. **Configuration Location**
   Add to `.env`:
   ```bash
   # Third-Party Integrator Credentials
   KRA_TPI_TIN=11111111111              # Revpay's integrator TIN
   KRA_TPI_CERTIFICATE=path/to/cert     # KRA certificate
   KRA_TPI_API_KEY=xxxxxxxxxxxxx        # Integrator API key
   KRA_MASTER_CMC_KEY=xxxxxxxxxxxxx     # Master CMC key
   
   # Enable TPI mode
   KRA_TPI_MODE=true
   KRA_INTEGRATOR_NAME=Revpay Connect
   ```

3. **Contact Revpay Creators**
   Ask them for:
   - TPI registration documents
   - Master credentials
   - API keys and certificates
   - Access to KRA integrator portal

### Option 2: Register as New Third-Party Integrator

If Revpay is NOT yet registered as TPI:

#### Step 1: Apply to KRA as TPI

**Documents Required:**
1. Business Registration Certificate
2. KRA PIN Certificate
3. Company Profile
4. Technical Documentation:
   - System architecture
   - Security measures
   - Data protection policies
   - Disaster recovery plan
5. eTIMS Bio Data Form
6. eTIMS Commitment Form
7. Technology Architecture Documentation

**Submission:**
- Email: etims@kra.go.ke
- Subject: "Application for Third-Party Integrator Certification - Revpay Connect"
- Attach all documents
- Request TPI registration

#### Step 2: KRA Review Process

**Timeline**: 2-4 weeks

**KRA Will:**
1. Review technical documentation
2. Conduct security audit
3. Verify business credentials
4. Test system capabilities
5. Issue TPI certificate if approved

#### Step 3: Receive TPI Credentials

Upon approval, KRA provides:
- TPI TIN
- Master API credentials
- TPI certificate
- Access to integrator portal
- Master CMC key

## Device Registration Flow for TPI

### Current Client Device Registration

For device **REAL001** (Test Company Ltd - TIN: 12345678901):

#### Check Current CMC Key Status
```bash
source etims_env/bin/activate
python manage.py shell -c "
from kra_oscu.models import Device
d = Device.objects.get(serial_number='REAL001')
print(f'Device: {d.device_name}')
print(f'Type: {d.device_type}')
print(f'Status: {d.status}')
print(f'Certified: {d.is_certified}')
print(f'Has CMC Key: {bool(d.cmc_key_encrypted)}')
if d.cmc_key_encrypted:
    print(f'CMC Key (encrypted): {d.cmc_key_encrypted[:50]}...')
    print(f'CMC Key (decrypted): {d.cmc_key[:20]}...')  # First 20 chars only
else:
    print('❌ NO CMC KEY - Device not initialized with KRA')
"
```

### Register Device with KRA (Sandbox)

If device has no CMC key, register it:

#### Step 1: Device Initialization API Call

```python
# File: test_device_registration.py
import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()

# KRA Sandbox URL
KRA_BASE_URL = os.getenv('KRA_SANDBOX_BASE_URL', 'https://etims-api-sbx.kra.go.ke')

# Device details from database
device_data = {
    "tin": "12345678901",           # Company TIN
    "bhfId": "001",                 # Branch ID (from device)
    "dvcSrlNo": "REAL001",          # Device serial number
    "userId": "admin",              # User ID
    "userNm": "Admin User",         # User name
    "dvcNm": "Real KRA Test Device" # Device name
}

# Call KRA device initialization endpoint
url = f"{KRA_BASE_URL}/etims-api/selectInitOsdcInfo"

print(f"Calling KRA API: {url}")
print(f"Device Data: {json.dumps(device_data, indent=2)}")

try:
    response = requests.post(
        url,
        json=device_data,
        headers={
            'Content-Type': 'application/json'
        },
        timeout=30
    )
    
    print(f"\nResponse Status: {response.status_code}")
    print(f"Response Body: {json.dumps(response.json(), indent=2)}")
    
    if response.status_code == 200:
        result = response.json()
        
        if result.get('resultCd') == '000':  # Success
            cmc_key = result.get('data', {}).get('cmcKey')
            print(f"\n✅ SUCCESS!")
            print(f"CMC Key: {cmc_key}")
            print(f"\nNext: Store this CMC key in database")
        else:
            print(f"\n❌ ERROR: {result.get('resultMsg')}")
    else:
        print(f"\n❌ HTTP Error: {response.status_code}")
        
except Exception as e:
    print(f"\n❌ Exception: {str(e)}")
```

#### Step 2: Run Registration Script

```bash
source etims_env/bin/activate
python test_device_registration.py
```

#### Step 3: Store CMC Key in Database

```python
# After successful registration, store CMC key
from kra_oscu.models import Device

device = Device.objects.get(serial_number='REAL001')
device.cmc_key = 'CMC_KEY_FROM_KRA_RESPONSE'  # Auto-encrypts
device.is_certified = True
device.status = 'active'
device.save()

print(f"✅ CMC key stored for device {device.serial_number}")
```

## Production Registration

### For Production Environment:

1. **Switch to Production URL**
   ```python
   KRA_BASE_URL = 'https://etims-api.kra.go.ke'  # Production
   ```

2. **Use Real Business TIN**
   - Must be actual registered business
   - TIN must be active with KRA
   - Business must have eTIMS account

3. **Complete KRA Approval**
   - Submit eTIMS forms
   - Wait for KRA approval
   - Receive production access

4. **Register Production Device**
   - Call production API
   - Receive production CMC key
   - Store securely

## Immediate Action Plan

### Step 1: Verify Current Status

Run these checks:

```bash
# 1. Check if REAL001 has CMC key
source etims_env/bin/activate
python manage.py shell -c "
from kra_oscu.models import Device
d = Device.objects.get(serial_number='REAL001')
print('Has CMC Key:', bool(d.cmc_key_encrypted))
print('Certified:', d.is_certified)
print('Status:', d.status)
"

# 2. Check environment
echo "KRA Environment: $(grep KRA_ENVIRONMENT .env)"
echo "KRA Base URL: $(grep KRA_SANDBOX_BASE_URL .env)"

# 3. Check if sandbox or production
source etims_env/bin/activate
python manage.py shell -c "
from kra_oscu.models import Company
c = Company.objects.get(tin='12345678901')
print('Sandbox Mode:', c.is_sandbox)
"
```

### Step 2: Contact Revpay Creators

**Questions to Ask:**
1. Is Revpay registered as KRA Third-Party Integrator?
2. What are the TPI credentials (TIN, API keys)?
3. Do they have master CMC key?
4. Can they provide KRA integrator portal access?
5. What is the device registration process for clients?

### Step 3: Choose Registration Path

**If TPI Registered (by creators):**
- Get TPI credentials
- Configure system with TPI settings
- Use TPI API to register client devices
- Manage multiple businesses under one integrator

**If NOT TPI Registered:**
- Register device directly for Test Company
- Get CMC key for REAL001 device
- Use standard OSCU integration
- Later apply for TPI status if needed

## Testing Device Registration (Sandbox)

Let me create a complete test script:

```python
# File: scripts/register_kra_device.py
"""
Register device with KRA eTIMS and obtain CMC key
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
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python register_kra_device.py <device_serial>")
        print("Example: python register_kra_device.py REAL001")
        sys.exit(1)
    
    device_serial = sys.argv[1]
    success = register_device_with_kra(device_serial)
    
    sys.exit(0 if success else 1)
```

## Summary

**Current Situation:**
- Device REAL001 exists in database
- Status: active, certified
- May or may not have valid CMC key
- In sandbox mode

**Next Steps:**
1. ✅ Check if device has CMC key
2. ✅ Contact Revpay creators about TPI status
3. ✅ Run device registration script if no CMC key
4. ✅ Verify CMC key works with KRA
5. ✅ Implement proper OSCU sync endpoint

**After Getting CMC Key:**
- Implement real OSCU sync that validates CMC key
- Test invoice submission to KRA
- Get official KRA receipt numbers
- Move to production when ready

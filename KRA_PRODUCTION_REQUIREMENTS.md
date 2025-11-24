# KRA eTIMS Production Environment Requirements

## Summary of Current Issues & Solutions

### ✅ FIXED ISSUES
1. **ngrok URL Updated**: Changed from expired URL to `https://2ec64400f7cf.ngrok-free.app`
2. **Invoice Creation Fixed**: Added missing required fields (`tin`, `transaction_date`)
3. **Device Sync Updated**: Updated REAL001 device `last_sync` timestamp
4. **Invoice Successfully Created**: Invoice `REAL001-20251124-000001` created with status "pending"

### ⚠️ CURRENT STATUS
- **Environment**: SANDBOX (test mode)
- **Device Type**: OSCU (Online Sales Control Unit)
- **Device Status**: Active, Certified: True
- **Invoice Status**: Pending (waiting for KRA approval)
- **Issue**: VSCU sync endpoint doesn't work with OSCU devices

---

## KRA Production Environment Requirements

### 1. DEVICE REGISTRATION PROCESS

#### Step 1: Business Registration with KRA
**Required Before Device Registration:**
- ✅ Valid TIN (Tax Identification Number) - 11 digits
- ✅ Active KRA PIN
- ✅ Business registered with KRA
- ✅ KRA eTIMS account created

#### Step 2: Device Registration & CMC Key
**This is the CRITICAL requirement for production:**

**What is CMC Key?**
- CMC (Communication Message Code) Key is a unique encryption key
- Issued by KRA for each registered device
- Used to secure all communications between your system and KRA
- Required for BOTH OSCU and VSCU devices
- Cannot create invoices without a valid CMC key

**How to Get CMC Key:**

1. **For OSCU Devices:**
   - Register physical device with KRA
   - Device must be KRA-certified hardware
   - Submit device serial number and TIN to KRA
   - KRA validates and issues CMC key
   - CMC key returned via `/etims-api/selectInitOsdcInfo` API

2. **For VSCU Devices:**
   - Register virtual device with KRA
   - No physical hardware required
   - Submit TIN, Branch ID, device serial number
   - Complete KRA certification process
   - Receive CMC key for API integration

**Current System Implementation:**
```python
# Your system already supports CMC key storage
# Location: kra_oscu/models.py
class Device(BaseModel):
    cmc_key_encrypted = models.TextField(blank=True)  # Encrypted CMC key
    
    @property
    def cmc_key(self):
        return self.decrypt_data(self.cmc_key_encrypted)
```

#### Step 3: Device Initialization API Call
```python
# Endpoint: /etims-api/selectInitOsdcInfo
# Method: POST
# Payload:
{
    "tin": "12345678901",           # Your business TIN
    "bhfId": "000",                 # Branch ID (3 digits)
    "deviceSerial": "DEVICE001"     # Device serial number
}

# Response:
{
    "resultCd": "000",              # Success code
    "resultMsg": "Success",
    "cmcKey": "xxxxxxxxxxxxx"       # CMC Key (store encrypted)
}
```

### 2. SANDBOX VS PRODUCTION

#### Sandbox Environment (Current Setup)
- **URL**: `https://etims-api-sbx.kra.go.ke`
- **Purpose**: Testing and development
- **CMC Keys**: Test keys with relaxed validation
- **Data**: No legal implications
- **Device Certification**: Simplified process
- **KRA Validation**: Limited

#### Production Environment (Required for Live)
- **URL**: `https://etims-api.kra.go.ke`
- **Purpose**: Live business operations
- **CMC Keys**: Official production keys from KRA
- **Data**: Legal tax documents
- **Device Certification**: Full KRA certification required
- **KRA Validation**: Strict validation
- **Compliance**: Full KRA compliance mandatory

### 3. PRODUCTION CHECKLIST

#### A. Business Requirements
- [ ] Active KRA PIN/TIN
- [ ] Business registered with KRA
- [ ] KRA eTIMS portal account created
- [ ] Submit eTIMS Commitment Form to KRA
- [ ] Complete eTIMS Bio Data Form
- [ ] KRA approval received

#### B. Technical Requirements
- [ ] Device registered with KRA
- [ ] CMC key obtained and stored securely
- [ ] Production environment configured
- [ ] SSL/HTTPS certificate installed
- [ ] Production database setup
- [ ] Backup and recovery procedures

#### C. Compliance Requirements
- [ ] 24-hour offline rule implemented
- [ ] Sequential receipt numbers enforced
- [ ] QR code generation working
- [ ] Receipt printing configured
- [ ] Tax calculations validated
- [ ] Z-Report/X-Report generation ready

### 4. SWITCHING TO PRODUCTION

#### Configuration Changes Required:

**1. Environment Variables (.env file):**
```bash
# Change from sandbox to production
KRA_ENVIRONMENT=production
KRA_BASE_URL=https://etims-api.kra.go.ke

# Update Django settings
DEBUG=False
ALLOWED_HOSTS=your-domain.com
```

**2. Database Flag:**
```python
# Update company record
company.is_sandbox = False
company.save()
```

**3. Device Certification:**
```python
# Ensure device is certified for production
device.is_certified = True
device.status = 'active'
device.cmc_key_encrypted = encrypt_cmc_key(production_cmc_key)
device.save()
```

### 5. DEVICE REGISTRATION STEPS (DETAILED)

#### For New Production Device:

**Step 1: Register with KRA eTIMS Portal**
1. Login to https://etims.kra.go.ke
2. Navigate to Device Management
3. Click "Register New Device"
4. Fill in device details:
   - Device Name
   - Device Serial Number
   - Branch ID (bhfId)
   - Device Type (OSCU/VSCU)
5. Submit registration request

**Step 2: KRA Approval**
- KRA reviews your device registration
- Verification process (1-5 business days)
- Approval notification via email/portal

**Step 3: Initialize Device via API**
```bash
curl -X POST "https://etims-api.kra.go.ke/etims-api/selectInitOsdcInfo" \
  -H "Content-Type: application/json" \
  -d '{
    "tin": "12345678901",
    "bhfId": "000",
    "deviceSerial": "PROD001"
  }'
```

**Step 4: Store CMC Key**
```python
# In your Django application
device = Device.objects.get(serial_number='PROD001')
device.cmc_key = response['cmcKey']  # Automatically encrypted
device.is_certified = True
device.status = 'active'
device.save()
```

### 6. INVOICE SUBMISSION TO KRA (Production)

#### Current Invoice Status:
```
Invoice: REAL001-20251124-000001
Status: pending
Issue: Not submitted to KRA yet
```

#### To Submit Invoice to KRA:
```python
# Endpoint: /etims-api/saveTrnsSalesOsdc
# Method: POST
# Headers:
{
    "Content-Type": "application/json",
    "cmcKey": "YOUR_CMC_KEY"  # Required for authentication
}

# Payload:
{
    "tin": "12345678901",
    "bhfId": "000",
    "invcNo": "REAL001-20251124-000001",
    "orgInvcNo": "",
    "salesTyCd": "N",  # Normal sale
    "rcptTyCd": "S",   # Sales receipt
    "pmtTyCd": "01",   # Cash
    "salesSttsCd": "02",  # Approved
    "cfmDt": "20251124153400",
    "salesDt": "20251124",
    "stockRlsDt": null,
    "totItemCnt": 1,
    "taxblAmtA": 1000.00,
    "taxblAmtB": 0,
    "taxblAmtC": 0,
    "taxblAmtD": 0,
    "taxRtA": 16,
    "taxAmtA": 160.00,
    "totTaxblAmt": 1000.00,
    "totTaxAmt": 160.00,
    "totAmt": 1160.00,
    "itemList": [...]
}

# Response (on success):
{
    "resultCd": "000",
    "resultMsg": "Success",
    "rcptNo": "KRA-2024-001",      # Official KRA receipt number
    "intrlData": "xxx",            # Internal data
    "rcptSign": "signature",       # Digital signature
    "totRcptNo": 1,
    "vsdcRcptPbctDate": "20241124153400",
    "sdcDateTime": "20241124153400"
}
```

### 7. OSCU vs VSCU SYNC DIFFERENCES

#### OSCU (Your Current Setup)
- **Online Sales Control Unit**
- Real-time communication with KRA
- Each invoice sent immediately to KRA
- Requires active internet connection
- CMC key used for every transaction
- **Sync**: Continuous, per-transaction

#### VSCU (Virtual Sales Control Unit)
- **Virtual Sales Control Unit**
- Batch processing of invoices
- Can queue invoices offline
- Sync in batches when online
- CMC key used for batch sync
- **Sync**: Periodic, batch uploads

**Issue Identified:**
- Your system has `/vscu/sync/` endpoint
- But device "REAL001" is OSCU type
- OSCU devices don't use batch sync
- Need real-time submission per invoice

### 8. FIXING THE SYNC ISSUE

#### Option 1: Use OSCU Real-time Submission
```python
# Create endpoint for OSCU invoice submission
@api_view(['POST'])
def submit_oscu_invoice(request, invoice_id):
    """Submit single OSCU invoice to KRA immediately"""
    invoice = Invoice.objects.get(id=invoice_id)
    device = invoice.device
    
    # Validate device is OSCU
    if device.device_type != 'oscu':
        return Response({'error': 'Device must be OSCU type'})
    
    # Submit to KRA
    kra_client = KRAClient()
    success, receipt_no = kra_client.submit_sales_invoice(invoice)
    
    if success:
        invoice.status = 'confirmed'
        invoice.receipt_no = receipt_no
        invoice.save()
        return Response({'status': 'success', 'receipt_no': receipt_no})
    else:
        return Response({'status': 'failed'}, status=400)
```

#### Option 2: Convert Device to VSCU
```python
# Update device type
device = Device.objects.get(serial_number='REAL001')
device.device_type = 'vscu'
device.save()

# Now VSCU sync will work
```

### 9. PRODUCTION DEPLOYMENT TIMELINE

#### Week 1: Preparation
- [ ] Complete KRA device registration
- [ ] Obtain production CMC key
- [ ] Update environment configuration
- [ ] Test production connectivity

#### Week 2: Testing
- [ ] Create test invoices in production
- [ ] Verify KRA receipt numbers
- [ ] Test error handling
- [ ] Validate compliance rules

#### Week 3: Go Live
- [ ] Switch production flag
- [ ] Monitor first live invoices
- [ ] Train users
- [ ] Setup support procedures

### 10. IMPORTANT NOTES

1. **CMC Key Security**: Never expose CMC keys in logs or version control
2. **Environment Separation**: Keep sandbox and production completely separate
3. **Testing**: Thoroughly test in sandbox before production
4. **Monitoring**: Setup alerts for failed KRA submissions
5. **Compliance**: 24-hour offline rule is strictly enforced in production
6. **Backups**: Regular backups of production data
7. **Support**: Have KRA support contact ready

### 11. CONTACT INFORMATION

**KRA eTIMS Support:**
- Portal: https://etims.kra.go.ke
- Email: etims@kra.go.ke
- Phone: KRA Contact Center

**DigiTax Support (if using):**
- Email: support@digitax.tech
- Website: https://digitax.tech

---

## NEXT STEPS FOR YOUR SYSTEM

1. **Immediate Action**: Decide OSCU vs VSCU
   - If OSCU: Implement real-time submission endpoint
   - If VSCU: Convert device type and use batch sync

2. **For Production**: 
   - Register device with KRA
   - Obtain production CMC key
   - Update environment to production
   - Submit pending invoice to KRA

3. **Current Pending Invoice**:
   - Invoice `REAL001-20251124-000001` is created
   - Status: pending
   - Needs: Submission to KRA for approval
   - Will receive: Official KRA receipt number

4. **Fix Sync Endpoint**:
   - Current VSCU sync doesn't work for OSCU
   - Need OSCU-specific submission endpoint
   - Or change device type to VSCU

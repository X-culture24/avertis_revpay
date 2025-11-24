# Revpay Connect - Production Deployment Guide

**Complete Step-by-Step Guide for Moving from Sandbox to Production**

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Pre-Production Checklist](#pre-production-checklist)
3. [Step-by-Step Production Deployment](#step-by-step-production-deployment)
4. [Environment Switching API](#environment-switching-api)
5. [Production Configuration](#production-configuration)
6. [Testing in Production](#testing-in-production)
7. [Troubleshooting](#troubleshooting)
8. [Rollback Procedures](#rollback-procedures)

---

## Prerequisites

### 1. Business Requirements

**Must Have:**
- ✅ Valid KRA PIN/TIN (11 digits)
- ✅ Business registered with KRA
- ✅ Active eTIMS account at https://etims.kra.go.ke
- ✅ Business compliance documents
- ✅ Contact person authorized by business

**Documents Required:**
- Business Registration Certificate
- KRA PIN Certificate
- Company Profile/Letter
- eTIMS Bio Data Form (completed)
- eTIMS Commitment Form (signed)

### 2. Technical Requirements

**Infrastructure:**
- ✅ Production domain with SSL certificate (HTTPS)
- ✅ Production database (separate from sandbox)
- ✅ Backup and recovery system
- ✅ Monitoring and alerting setup
- ✅ Server with adequate resources

**Revpay System:**
- ✅ All tests passing in sandbox
- ✅ Invoice creation working
- ✅ Device sync functional
- ✅ QR code generation active
- ✅ Error handling tested

### 3. KRA Registration Status

**Choose One Path:**

**Option A: Revpay as Third-Party Integrator (TPI)**
- Revpay already registered with KRA as TPI
- Can manage multiple client businesses
- Master credentials from Revpay creators
- Centralized device management

**Option B: Direct Business Registration**
- Your business registers directly with KRA
- One device per business
- Standard eTIMS integration
- No TPI required

---

## Pre-Production Checklist

### Phase 1: Business Preparation (Week 1)

- [ ] **Confirm Business Registration**
  - Verify KRA PIN is active
  - Ensure business documents are current
  - Confirm authorized contact person

- [ ] **Create KRA eTIMS Account**
  - Visit https://etims.kra.go.ke
  - Register business account
  - Verify email and activate account

- [ ] **Submit eTIMS Application**
  - Download forms from KRA portal
  - Complete Bio Data Form
  - Sign Commitment Form
  - Submit via KRA portal or email to etims@kra.go.ke

- [ ] **Contact Revpay Creators (If Using TPI)**
  - Ask: "Is Revpay registered as KRA Third-Party Integrator?"
  - Request: Production TPI credentials
  - Get: Master CMC key (if TPI)
  - Obtain: TPI TIN and API keys

### Phase 2: Technical Preparation (Week 2)

- [ ] **Setup Production Infrastructure**
  - Deploy production server
  - Install SSL certificate
  - Configure domain name
  - Setup production database
  - Configure backups

- [ ] **Prepare Production Environment**
  - Create production `.env` file
  - Configure production settings
  - Setup monitoring (Sentry, DataDog, etc.)
  - Configure logging

- [ ] **Device Registration**
  - Register device with KRA eTIMS portal
  - Wait for KRA approval (1-5 business days)
  - Obtain production CMC key
  - Store CMC key securely

### Phase 3: Testing & Validation (Week 3)

- [ ] **Sandbox Final Tests**
  - Create 10+ test invoices
  - Test all device types (OSCU/VSCU)
  - Verify sync functionality
  - Test error scenarios
  - Validate QR codes

- [ ] **Production Test Plan**
  - Prepare test invoice data
  - Identify test customers
  - Plan rollback procedures
  - Brief all stakeholders

---

## Step-by-Step Production Deployment

### Step 1: Obtain Production CMC Key

#### If Using Revpay TPI:
```bash
# Contact Revpay creators and request:
1. Production TPI TIN
2. Master CMC key
3. Production API credentials
4. TPI certificate

# Then configure in .env:
KRA_TPI_MODE=true
KRA_TPI_TIN=11111111111
KRA_MASTER_CMC_KEY=xxxxxxxxxxxxx
```

#### If Direct Registration:
```bash
# Use the device registration script
cd /home/lawrence/avertis_revpay
source etims_env/bin/activate

# Register device with KRA production
python scripts/register_kra_device.py PROD001
```

**Manual Registration via KRA Portal:**

1. Login to https://etims.kra.go.ke
2. Navigate to: **Devices** → **Register New Device**
3. Fill in device details:
   - Device Name: `Production Device 001`
   - Serial Number: `PROD001`
   - Branch ID: `001`
   - Device Type: `OSCU` or `VSCU`
4. Submit and wait for approval
5. After approval, initialize device via API:

```python
# Run this after KRA approves device
source etims_env/bin/activate
python manage.py shell

from kra_oscu.services.kra_client import KRAClient

kra_client = KRAClient()
result = kra_client.init_device(
    tin="YOUR_REAL_TIN",      # Your actual business TIN
    bhf_id="001",             # Branch ID
    serial_number="PROD001",  # Device serial
    device_name="Production Device 001"
)

if result.get('success'):
    print(f"CMC Key: {result.get('cmc_key')}")
    # Store this CMC key securely!
else:
    print(f"Error: {result.get('message')}")
```

### Step 2: Configure Production Environment

**Edit `.env` file:**

```bash
# Production Environment Configuration
KRA_ENVIRONMENT=production
KRA_BASE_URL=https://etims-api.kra.go.ke
DEBUG=False

# Production Database
DATABASE_URL=postgresql://user:pass@host:5432/revpay_production

# Production Domain
ALLOWED_HOSTS=your-domain.com,www.your-domain.com
BASE_URL=https://your-domain.com

# Security
SECRET_KEY=your-very-secure-production-secret-key-min-50-chars
SECURE_SSL_REDIRECT=True
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True

# KRA Production API (if you have it)
KRA_API_KEY=your-production-api-key

# Third-Party Integrator (if applicable)
KRA_TPI_MODE=false  # true if using TPI
KRA_TPI_TIN=        # TPI TIN if applicable
```

### Step 3: Update Database for Production

```bash
source etims_env/bin/activate

# Update company to production mode
python manage.py shell -c "
from kra_oscu.models import Company, Device

# Get your company
company = Company.objects.get(tin='YOUR_REAL_TIN')
company.is_sandbox = False
company.status = 'active'
company.save()
print(f'✅ Company switched to production: {company.company_name}')

# Update or create production device
device, created = Device.objects.get_or_create(
    serial_number='PROD001',
    defaults={
        'company': company,
        'device_name': 'Production Device 001',
        'device_type': 'oscu',
        'tin': company.tin,
        'bhf_id': '001',
        'status': 'pending',
        'is_certified': False
    }
)

# Store production CMC key (obtained from KRA)
device.cmc_key = 'YOUR_PRODUCTION_CMC_KEY'  # Auto-encrypts
device.is_certified = True
device.status = 'active'
device.save()
print(f'✅ Production device configured: {device.serial_number}')
"
```

### Step 4: Use Environment Switching API

**API Endpoint:** `POST /api/mobile/environment/switch/`

**Request:**
```bash
curl -X POST "https://your-domain.com/api/mobile/environment/switch/" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "environment": "production"
  }'
```

**Response (Success):**
```json
{
  "message": "Environment switched to production successfully",
  "environment": "production",
  "requires_restart": true,
  "warnings": [
    "All invoices will now be sent to KRA production system",
    "Production invoices have legal implications",
    "Ensure all devices have production CMC keys"
  ]
}
```

**From React Native App:**
```typescript
// In your app code
import { apiService } from '@/services/api';

const switchToProduction = async () => {
  try {
    const response = await apiService.switchEnvironment('production');
    
    if (response.success) {
      Alert.alert(
        'Production Mode Active',
        'The app is now in production mode. All invoices will be sent to KRA.',
        [
          { text: 'OK', onPress: () => {
            // Restart app or reload data
            navigation.navigate('Dashboard');
          }}
        ]
      );
    }
  } catch (error) {
    Alert.alert('Error', 'Failed to switch to production mode');
  }
};
```

### Step 5: Verify Production Configuration

```bash
# Run production status check
source etims_env/bin/activate
python manage.py shell -c "
from kra_oscu.models import Company, Device
from django.conf import settings

print('=== Production Status Check ===')
print(f'Environment: {settings.KRA_ENVIRONMENT}')
print(f'Base URL: {settings.KRA_PROD_BASE_URL if hasattr(settings, \"KRA_PROD_BASE_URL\") else \"Not set\"}')
print(f'Debug Mode: {settings.DEBUG}')
print()

company = Company.objects.first()
print(f'Company: {company.company_name}')
print(f'Sandbox Mode: {company.is_sandbox}')
print(f'Status: {company.status}')
print()

devices = Device.objects.filter(company=company)
for device in devices:
    print(f'Device: {device.serial_number}')
    print(f'  Type: {device.device_type}')
    print(f'  Status: {device.status}')
    print(f'  Certified: {device.is_certified}')
    print(f'  Has CMC: {bool(device.cmc_key_encrypted)}')
    print()
"
```

### Step 6: Test Production Device Sync

```bash
# Test device connection to KRA production
curl -X POST "https://your-domain.com/api/mobile/devices/DEVICE_ID/sync/" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "message": "OSCU device synced successfully",
  "device": {
    "id": "uuid",
    "serial_number": "PROD001",
    "device_type": "oscu",
    "last_sync": "2025-11-24T13:00:00Z",
    "kra_status": "online",
    "cmc_key_valid": true
  }
}
```

### Step 7: Create First Production Invoice

**Important:** Start with a small test invoice

```bash
curl -X POST "https://your-domain.com/api/mobile/invoices/" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "device_serial_number": "PROD001",
    "tin": "YOUR_REAL_TIN",
    "customer_name": "Test Production Customer",
    "payment_type": "CASH",
    "transaction_type": "sale",
    "transaction_date": "2025-11-24T16:00:00+03:00",
    "currency": "KES",
    "total_amount": "116.00",
    "tax_amount": "16.00",
    "items": [
      {
        "item_code": "TEST001",
        "item_name": "Test Product",
        "quantity": 1,
        "unit_price": "100.00",
        "tax_type": "A",
        "tax_rate": "16.00",
        "unit_of_measure": "PCS"
      }
    ]
  }'
```

### Step 8: Verify Invoice with KRA

After creating the invoice, check the response:

```json
{
  "id": "uuid",
  "invoice_no": "PROD001-20251124-000001",
  "receipt_no": "KRA123456789",  // Official KRA receipt
  "status": "confirmed",
  "total_amount": "116.00",
  "qr_code_data": "base64_encoded_qr"
}
```

**Verify on KRA Portal:**
1. Login to https://etims.kra.go.ke
2. Navigate to **Transactions** → **Sales**
3. Search for invoice number
4. Confirm status is "Approved"

---

## Environment Switching API

### Endpoint Details

**URL:** `POST /api/mobile/environment/switch/`

**Authentication:** Required (JWT Token)

**Request Body:**
```json
{
  "environment": "production"  // or "sandbox"
}
```

**Response (Success):**
```json
{
  "message": "Environment switched to production successfully",
  "current_environment": "production",
  "previous_environment": "sandbox",
  "switched_at": "2025-11-24T16:00:00Z",
  "requires_restart": true,
  "warnings": [
    "All future transactions will use production KRA API",
    "Production invoices have legal and tax implications",
    "Ensure all devices have valid production CMC keys"
  ]
}
```

**Response (Error):**
```json
{
  "error": "Cannot switch to production",
  "reasons": [
    "No production CMC key configured",
    "Company not approved for production",
    "Missing required production credentials"
  ]
}
```

### Implementation in Backend

The endpoint is already implemented at:
- **File:** `kra_oscu/api_views.py`
- **Function:** Handles environment switching
- **Updates:** Company.is_sandbox flag

### Safety Checks

The API performs these checks before switching:

1. ✅ Device has production CMC key
2. ✅ Company is approved for production
3. ✅ All required credentials are configured
4. ✅ Production environment variables are set
5. ✅ User has admin permissions

---

## Production Configuration

### Required Environment Variables

```bash
# .env.production
KRA_ENVIRONMENT=production
KRA_BASE_URL=https://etims-api.kra.go.ke
KRA_PROD_BASE_URL=https://etims-api.kra.go.ke

# Database
DATABASE_URL=postgresql://user:pass@prod-host:5432/revpay_prod

# Security
SECRET_KEY=min-50-characters-random-string
DEBUG=False
ALLOWED_HOSTS=your-domain.com,*.your-domain.com

# SSL/HTTPS
SECURE_SSL_REDIRECT=True
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True
SECURE_HSTS_SECONDS=31536000

# CORS
CORS_ALLOWED_ORIGINS=https://your-domain.com

# Monitoring
SENTRY_DSN=your-sentry-dsn
LOG_LEVEL=INFO
```

### Django Settings Updates

Add to `etims_integration/settings.py`:

```python
# Production-specific settings
if not DEBUG:
    # Security
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = 'DENY'
    
    # HSTS
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    
    # Logging
    LOGGING = {
        'version': 1,
        'handlers': {
            'file': {
                'class': 'logging.FileHandler',
                'filename': '/var/log/revpay/django.log',
            },
        },
        'loggers': {
            'kra_oscu': {
                'handlers': ['file'],
                'level': 'INFO',
            },
        },
    }
```

---

## Testing in Production

### Phase 1: Smoke Tests (Day 1)

1. **Device Sync Test**
   ```bash
   # Test each device
   curl -X POST "/api/mobile/devices/{device_id}/sync/"
   # Expect: kra_status = "online"
   ```

2. **Create Test Invoice**
   - Small amount (< 1000 KES)
   - Single item
   - Cash payment
   - Verify KRA receipt number received

3. **Verify on KRA Portal**
   - Login to KRA eTIMS
   - Find invoice in transactions
   - Confirm approved status

### Phase 2: Validation Tests (Week 1)

- [ ] Create 10+ invoices
- [ ] Test different payment types (Cash, Card, Mobile Money)
- [ ] Test different tax types (A, B, C, D, E)
- [ ] Test credit notes
- [ ] Test copy receipts
- [ ] Verify all QR codes

### Phase 3: Load Tests (Week 2)

- [ ] Create 100+ invoices per day
- [ ] Test peak hours
- [ ] Verify sync performance
- [ ] Monitor error rates
- [ ] Check response times

---

## Troubleshooting

### Issue: CMC Key Invalid

**Error:** "CMC key validation failed"

**Solution:**
```bash
# Re-register device with KRA
1. Login to https://etims.kra.go.ke
2. Check device status
3. If suspended, contact KRA support
4. Re-initialize device if needed
```

### Issue: Invoice Submission Failed

**Error:** "KRA API error: 401 Unauthorized"

**Solution:**
```bash
# Check device certification
source etims_env/bin/activate
python manage.py shell -c "
from kra_oscu.models import Device
device = Device.objects.get(serial_number='PROD001')
print(f'Certified: {device.is_certified}')
print(f'Status: {device.status}')
print(f'CMC Key exists: {bool(device.cmc_key)}')
"

# If CMC key missing, re-register
```

### Issue: Device Offline Error

**Error:** "Device has been offline for more than 24 hours"

**Solution:**
```bash
# Sync device immediately
curl -X POST "/api/mobile/devices/{device_id}/sync/"

# Setup automatic sync (Celery task runs hourly)
# Or manually sync every 12 hours
```

### Issue: Receipt Number Not Received

**Error:** Invoice created but no receipt_no

**Solution:**
```bash
# Check invoice status
curl -X GET "/api/mobile/invoices/{invoice_id}/"

# If status = "pending", resync
curl -X POST "/api/mobile/invoices/{invoice_id}/resync/"

# Check KRA API logs
tail -f /var/log/revpay/kra_api.log
```

---

## Rollback Procedures

### Emergency Rollback to Sandbox

If production has critical issues:

**Method 1: Via API**
```bash
curl -X POST "/api/mobile/environment/switch/" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"environment": "sandbox"}'
```

**Method 2: Via Database**
```bash
source etims_env/bin/activate
python manage.py shell -c "
from kra_oscu.models import Company
company = Company.objects.first()
company.is_sandbox = True
company.save()
print('✅ Rolled back to sandbox')
"
```

**Method 3: Via Environment Variable**
```bash
# Edit .env
KRA_ENVIRONMENT=sandbox

# Restart server
sudo systemctl restart revpay
```

### Data Backup Before Production

```bash
# Backup database
pg_dump revpay_production > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup uploaded files
tar -czf media_backup_$(date +%Y%m%d).tar.gz /path/to/media/

# Backup .env
cp .env .env.backup_$(date +%Y%m%d)
```

---

## Production Launch Checklist

### Final Pre-Launch Checks

- [ ] All sandbox tests passing
- [ ] Production CMC key obtained and stored
- [ ] Production database configured
- [ ] SSL certificate installed
- [ ] Domain DNS configured
- [ ] Backups automated
- [ ] Monitoring active
- [ ] Error alerting configured
- [ ] Support contacts documented
- [ ] Rollback procedure tested

### Launch Day

1. **Morning (9:00 AM)**
   - Deploy production code
   - Switch environment to production
   - Sync all devices
   - Create test invoice

2. **Midday (12:00 PM)**
   - Monitor first transactions
   - Check KRA portal confirmations
   - Verify receipt numbers

3. **Evening (5:00 PM)**
   - Review all invoices
   - Check error logs
   - Confirm no failed transactions

### Post-Launch (Week 1)

- [ ] Daily invoice review
- [ ] Monitor KRA approval rates
- [ ] Check device sync status
- [ ] Review error logs
- [ ] Customer feedback collection

---

## Support Contacts

### KRA eTIMS Support
- **Portal:** https://etims.kra.go.ke
- **Email:** etims@kra.go.ke
- **Phone:** KRA Contact Center
- **Hours:** Monday-Friday, 8AM-5PM

### Revpay Support
- **Contact:** Revpay creators
- **Topics:** TPI credentials, CMC keys, integration issues

### Emergency Contacts
- **Technical Lead:** [Your contact]
- **Business Owner:** [Company contact]
- **KRA Account Manager:** [If assigned]

---

## Summary

**Production deployment requires:**

1. ✅ **Legal:** Real business, KRA registration, eTIMS approval
2. ✅ **Technical:** Production CMC key, SSL, production database
3. ✅ **Testing:** Sandbox fully tested, rollback plan ready
4. ✅ **Monitoring:** Logs, alerts, backups configured

**Use the API endpoint:**
```bash
POST /api/mobile/environment/switch/
Body: {"environment": "production"}
```

**Timeline:**
- Week 1: Business registration and KRA approval
- Week 2: Technical setup and CMC key
- Week 3: Testing and validation
- Week 4: Production launch

**Remember:** Production invoices have legal tax implications. Test thoroughly in sandbox first!

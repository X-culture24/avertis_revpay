# KRA eTIMS Mock Service & Complete Workflow Guide

## 🎯 Overview

This guide explains the complete RevPay invoice workflow from business registration to KRA approval, including mock responses for testing.

## 🔧 Mock Service Setup

### What is Mock Mode?

Mock mode simulates KRA eTIMS API responses for testing without connecting to the real KRA servers. This allows you to:
- Test the complete invoice workflow
- Develop without KRA credentials
- Simulate various KRA responses (success, errors, etc.)
- Train users on the system

### Configuration

Mock mode is enabled by default in `settings.py`:
```python
KRA_USE_MOCK = True  # Set to False for production
```

## 📋 Complete Workflow

### 1. Business Registration (Mobile App)

**User Action**: Register business through mobile app

**What Happens**:
```
Mobile App → Backend API → Database
```

**Created Records**:
- User account
- Company record (status: 'pending', TIN not yet registered with KRA)
- Device record (status: 'pending', not yet initialized)
- Subscription record

**Result**: User can login but cannot create invoices yet (TIN not registered)

---

### 2. Device Activation (Admin/Automatic)

**Command**:
```bash
python manage.py activate_device --all
```

Or for specific company:
```bash
python manage.py activate_device --tin P051234567A
```

**What Happens**:
1. Registers TIN with KRA (mock)
2. Initializes device with KRA
3. Receives CMC key (device certificate)
4. Updates device status to 'active'
5. Updates company status to 'active'

**Mock Response**:
```json
{
  "resultCd": "000",
  "resultMsg": "Success",
  "data": {
    "deviceId": "ABC1234567",
    "sdcId": "SDCABC1234567",
    "mrcNo": "MRCABC1234567",
    "status": "active"
  }
}
```

---

### 3. Create Invoice (Mobile App)

**User Action**: Create invoice in mobile app

**What Happens**:
```
Mobile App → Backend API → Database (Invoice created with status: 'pending')
```

**Invoice States**:
- `pending`: Created, waiting to be sent to KRA
- `submitted`: Sent to KRA, waiting for approval
- `approved`: KRA approved, receipt generated
- `failed`: KRA rejected or error occurred

---

### 4. Submit to KRA (Automatic/Manual)

**Automatic**: Background task submits pending invoices every few minutes

**Manual Command**:
```bash
python manage.py sync_invoices
```

**What Happens**:
1. Gets pending invoices
2. Builds KRA payload
3. Sends to KRA eTIMS API
4. Processes response
5. Updates invoice status

**Mock KRA Response (Success)**:
```json
{
  "resultCd": "000",
  "resultMsg": "Success - Invoice approved by KRA",
  "data": {
    "invoiceNo": "INV-12345678",
    "receiptNo": "20260211P05121234",
    "receiptSignature": "ABC123...XYZ789",
    "qrCode": "KRA|P051234567A|INV-12345678|1000.00|20260211120000",
    "verificationUrl": "https://etims.kra.go.ke/verify/20260211P05121234",
    "status": "approved"
  }
}
```

**Mock KRA Response (TIN Not Registered)**:
```json
{
  "resultCd": "001",
  "resultMsg": "Company TIN not registered with KRA eTIMS. Please complete device initialization first.",
  "data": null
}
```

---

### 5. Receipt Generation

**What Happens**:
1. Invoice status updated to 'approved'
2. Receipt number stored
3. QR code generated
4. Digital signature added
5. Receipt available for printing/download

**Receipt Contains**:
- Company details
- Customer details
- Invoice items with tax breakdown
- Total amount
- KRA receipt number
- QR code for verification
- Digital signature
- Verification URL

---

## 🚀 Quick Start Guide

### For New Business Registration:

1. **Register Business** (Mobile App)
   ```
   - Fill in business details
   - Enter KRA PIN (TIN)
   - Register device serial number
   - Choose subscription plan
   ```

2. **Activate Device** (Backend)
   ```bash
   python manage.py activate_device --all
   ```

3. **Create Invoice** (Mobile App)
   ```
   - Add customer details
   - Add invoice items
   - Calculate totals
   - Submit invoice
   ```

4. **Invoice Auto-Submits to KRA**
   - Background task handles submission
   - Receives KRA approval
   - Receipt generated

5. **View/Print Receipt** (Mobile App)
   - View approved invoice
   - Print receipt with QR code
   - Share with customer

---

## 🔍 Testing Scenarios

### Scenario 1: Successful Invoice Flow
```bash
# 1. Register business (use mobile app)
# 2. Activate device
python manage.py activate_device --tin P051234567A

# 3. Create invoice (use mobile app)
# 4. Check invoice status
python manage.py shell
>>> from kra_oscu.models import Invoice
>>> invoice = Invoice.objects.latest('created_at')
>>> print(invoice.status)  # Should be 'approved'
>>> print(invoice.receipt_no)  # KRA receipt number
```

### Scenario 2: TIN Not Registered Error
```bash
# 1. Register business (use mobile app)
# 2. DON'T activate device
# 3. Try to create invoice (use mobile app)
# Result: Error "Company TIN not registered"
```

### Scenario 3: Device Not Active Error
```bash
# 1. Register business
# 2. Manually set device status to 'inactive'
# 3. Try to create invoice
# Result: Error "Device not found or not active"
```

---

## 📊 Mock Service Features

### Registered TINs Tracking
```python
from kra_oscu.services.kra_mock_service import KRAMockService

# Register a TIN
KRAMockService.register_tin('P051234567A')

# Check if registered
is_registered = KRAMockService.is_tin_registered('P051234567A')
```

### Mock Responses Include:
- ✅ Device initialization
- ✅ Invoice submission
- ✅ Receipt generation
- ✅ QR code generation
- ✅ Verification URLs
- ✅ Error scenarios

---

## 🎨 Mobile App Icons & UI

### Modern Icons Used:
- 📱 Device management
- 📄 Invoice creation
- ✅ Approved invoices
- ⏳ Pending invoices
- ❌ Failed invoices
- 📊 Dashboard stats
- 💳 Subscription plans
- 🔔 Notifications

### Icon Library:
Using `react-native-vector-icons/MaterialCommunityIcons`

---

## 🔐 Security Features

### Digital Signatures:
- Each invoice signed with device CMC key
- KRA validates signature
- Receipt includes KRA signature

### QR Code:
- Contains: TIN, Invoice No, Amount, Timestamp
- Scannable for verification
- Links to KRA verification portal

---

## 📱 Mobile App Features

### Dashboard:
- Total invoices count
- Success rate percentage
- Total revenue
- Active devices
- Recent invoices list

### Invoice Creation:
- Customer details
- Multiple items support
- Tax calculation (VAT 16%)
- Real-time total calculation
- Validation before submission

### Invoice List:
- Filter by status (all, pending, approved, failed)
- Search by invoice number
- Pull to refresh
- Tap to view details

### Invoice Details:
- Full invoice information
- KRA receipt number
- QR code display
- Print/Share options
- Resync button for failed invoices

---

## 🛠️ Admin Commands

### Activate All Devices:
```bash
python manage.py activate_device --all
```

### Activate Specific Company:
```bash
python manage.py activate_device --tin P051234567A
```

### Activate Specific Device:
```bash
python manage.py activate_device --tin P051234567A --device-serial DEV123456
```

### Sync Invoices:
```bash
python manage.py sync_invoices
```

### Seed Subscription Plans:
```bash
python manage.py seed_plans
```

---

## 📈 Monitoring & Logs

### Check Device Status:
```python
from kra_oscu.models import Device

devices = Device.objects.all()
for device in devices:
    print(f"{device.serial_number}: {device.status}")
```

### Check Invoice Status:
```python
from kra_oscu.models import Invoice

# Pending invoices
pending = Invoice.objects.filter(status='pending').count()

# Approved invoices
approved = Invoice.objects.filter(status='approved').count()

# Failed invoices
failed = Invoice.objects.filter(status='failed').count()

print(f"Pending: {pending}, Approved: {approved}, Failed: {failed}")
```

### View API Logs:
```python
from kra_oscu.models import ApiLog

# Recent API calls
logs = ApiLog.objects.order_by('-timestamp')[:10]
for log in logs:
    print(f"{log.endpoint}: {log.status_code} ({log.response_time}s)")
```

---

## 🚨 Troubleshooting

### Issue: "Company TIN not registered"
**Solution**: Run `python manage.py activate_device --tin YOUR_TIN`

### Issue: "Device not found or not active"
**Solution**: Check device status, activate if needed

### Issue: Invoice stuck in 'pending'
**Solution**: Run `python manage.py sync_invoices` manually

### Issue: Mock responses not working
**Solution**: Check `KRA_USE_MOCK = True` in settings.py

---

## 🎯 Production Checklist

Before going to production:

- [ ] Set `KRA_USE_MOCK = False`
- [ ] Configure real KRA API credentials
- [ ] Test with KRA sandbox environment
- [ ] Register company with real KRA
- [ ] Obtain device certificates from KRA
- [ ] Set up SSL certificates
- [ ] Configure backup systems
- [ ] Set up monitoring and alerts
- [ ] Train staff on the system
- [ ] Prepare customer support

---

## 📞 Support

For issues or questions:
1. Check logs: `tail -f logs/etims.log`
2. Run diagnostics: `python manage.py check`
3. Review API logs in admin panel
4. Contact RevPay support

---

## 🎉 Success!

Your RevPay system is now ready to process KRA-compliant invoices!

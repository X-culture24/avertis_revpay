# DigiTax Production Environment Setup Guide

This guide covers transitioning from sandbox to production environment for real-time KRA eTIMS integration via DigiTax API.

## Environment Configuration

### 1. Production Environment Variables

Update your `.env` file with production settings:

```bash
# DigiTax Production Configuration
DIGITAX_ENVIRONMENT=production
DIGITAX_API_KEY=your-production-digitax-api-key
DIGITAX_BASE_URL=https://api.digitax.tech/ke/v1
BASE_URL=https://your-production-domain.com

# Django Production Settings
DEBUG=False
ALLOWED_HOSTS=your-domain.com,www.your-domain.com
SECRET_KEY=your-secure-production-secret-key
```

### 2. DigiTax API Key Setup

1. **Obtain Production API Key:**
   - Contact DigiTax support for production API credentials
   - Complete KRA compliance verification
   - Receive production API key and business configuration

2. **Business Registration:**
   - Ensure your business is registered with KRA
   - Verify PIN/TIN registration
   - Complete eTIMS device registration if required

### 3. Callback URL Configuration

Configure your production callback URL with DigiTax:
```
https://your-domain.com/api/mobile/callback/digitax/
```

## Production Deployment Steps

### 1. Database Migration

Run the migration to add DigiTax fields:
```bash
python manage.py migrate
```

### 2. Test DigiTax Connection

Create a test script to verify production connectivity:
```python
from kra_oscu.services.digitax_service import DigiTaxService

# Test production connection
service = DigiTaxService()
business_info = service.get_business_info()
print("Business Info:", business_info)
```

### 3. Production Checklist

- [ ] Production API key configured
- [ ] Callback URL registered with DigiTax
- [ ] SSL certificate installed (HTTPS required)
- [ ] Database migrated with DigiTax fields
- [ ] Error logging configured
- [ ] Monitoring setup for KRA submission failures

## Real-time Integration Features

### 1. Immediate KRA Submission

- Invoices are submitted to KRA immediately upon creation
- ETR numbers returned in real-time
- No async queue delays

### 2. Automatic ETR Retrieval

- ETR numbers stored in `invoice.receipt_no`
- KRA verification URL stored in `invoice.etims_url`
- DigiTax transaction ID tracked in `invoice.digitax_id`

### 3. Error Handling

- Failed submissions marked with error messages
- Retry mechanism for network failures
- Timeout handling for slow KRA responses

## Mobile App Integration

The mobile app now receives:
- Real-time KRA submission status
- ETR numbers immediately after invoice creation
- Error messages for failed submissions

### Response Format

```json
{
  "message": "Invoice successfully submitted to KRA. ETR: 20241114001",
  "invoice": {...},
  "kra_status": "confirmed",
  "etr_number": "20241114001",
  "digitax_response": {...}
}
```

## Monitoring and Troubleshooting

### 1. Log Monitoring

Monitor Django logs for DigiTax integration:
```bash
tail -f /var/log/django/digitax.log
```

### 2. Common Issues

**Connection Timeouts:**
- Check network connectivity to DigiTax servers
- Verify firewall settings allow HTTPS outbound

**Authentication Errors:**
- Verify production API key is correct
- Check API key permissions with DigiTax

**KRA Submission Failures:**
- Review invoice data format
- Check KRA system status
- Verify business registration status

### 3. Callback Monitoring

Monitor callback endpoint for DigiTax webhooks:
```bash
# Check callback logs
grep "DigiTax callback" /var/log/django/app.log
```

## Security Considerations

1. **API Key Security:**
   - Store API keys in environment variables
   - Never commit API keys to version control
   - Rotate keys regularly

2. **HTTPS Required:**
   - All DigiTax communication requires HTTPS
   - Callback URLs must use SSL certificates

3. **Data Validation:**
   - Validate all invoice data before submission
   - Sanitize customer input
   - Log all KRA interactions for audit

## Support and Maintenance

### DigiTax Support
- Email: support@digitax.tech
- Documentation: https://docs.digitax.tech

### KRA eTIMS Support
- Portal: https://etims.kra.go.ke
- Helpdesk: KRA customer service

## Migration from Async to Real-time

The system now uses real-time DigiTax integration instead of async Celery tasks:

**Before (Async):**
```python
# Old async approach
submit_invoice_to_kra.delay(invoice_id)
```

**After (Real-time):**
```python
# New real-time approach
digitax_service = DigiTaxService()
success, message, response = digitax_service.submit_invoice_realtime(invoice)
```

This provides immediate feedback to users and eliminates queue delays.

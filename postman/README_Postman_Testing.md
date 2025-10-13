# eTIMS OSCU Postman Testing Guide

## Updated Collection Overview

The Postman collection has been updated with real working data from your current system setup.

### Files Created/Updated:
- `eTIMS_OSCU_Updated_Collection.postman_collection.json` - Complete workflow collection
- `eTIMS_Environment_Updated.postman_environment.json` - Environment with working variables

## Working Test Data

### Authentication
- **Token**: `adadec42f0aa4330b7df1392510ed347f0f72fd1`
- **Base URL**: `http://localhost:8000`

### Company Information
- **Company ID**: `7c209984-2ead-41dd-866c-33bb1658a3cb`
- **Company Name**: Test Company Ltd
- **TIN**: `98765432109`

### Device Information
- **Device Serial**: `REAL009` (has active CMC key)
- **Status**: Active
- **BHF ID**: `000`

## Testing Workflow

### 1. Import Collection and Environment
1. Import `eTIMS_OSCU_Updated_Collection.postman_collection.json`
2. Import `eTIMS_Environment_Updated.postman_environment.json`
3. Select the environment in Postman

### 2. Complete Testing Sequence

#### Step 1: System Health
- **Health Check** - Verify system is running
- **Test Connection** - Verify authentication

#### Step 2: Company Management
- **List Companies** - View existing companies
- **Onboard New Company** - Test new company creation

#### Step 3: Device Management
- **Initialize Device** - Register device with KRA
- **Generate RSA Keys** - Create cryptographic keys

#### Step 4: Sales Transactions
- **Process Sales Transaction** - Single item sale
- **Process Multiple Items Transaction** - Multi-item sale

#### Step 5: Monitoring & Logs
- **View API Logs** - Check system logs
- **View Invoices** - List processed invoices
- **System Dashboard** - Overall system status

#### Step 6: Item Management
- **Sync Items** - Synchronize product catalog

#### Step 7: KRA Direct Testing
- **KRA Sandbox - Device Check** - Direct KRA API test

## Expected Results

### Sales Transaction Response
```json
{
  "success": false,
  "invoice_id": "uuid-here",
  "receipt_no": null,
  "status": "retry",
  "message": "Transaction queued for retry due to temporary KRA service issue",
  "retry_queued": true,
  "timestamp": "2025-10-13T14:57:14.197864Z"
}
```

This is **expected behavior** in sandbox environment - transactions are queued for retry.

### Device Initialization Response
```json
{
  "success": true,
  "device_id": "uuid-here",
  "cmc_key": "encrypted-key-here",
  "status": "active",
  "message": "Device initialized successfully"
}
```

## Environment Variables

All variables are pre-configured in the environment file:

| Variable | Value | Description |
|----------|-------|-------------|
| `base_url` | `http://localhost:8000` | API base URL |
| `auth_token` | `adadec42f0aa4330b7df1392510ed347f0f72fd1` | Authentication token |
| `company_id` | `7c209984-2ead-41dd-866c-33bb1658a3cb` | Working company ID |
| `tin` | `98765432109` | Company TIN |
| `device_serial` | `REAL009` | Device with CMC key |
| `new_tin` | `99988877766` | For testing new companies |
| `new_device_serial` | `REAL010` | For testing new devices |

## Dynamic Variables

The collection uses Postman dynamic variables:
- `{{$randomInt}}` - Random invoice numbers
- `{{$isoTimestamp}}` - Current timestamp for transactions

## Troubleshooting

### Common Issues:
1. **401 Unauthorized** - Check auth token is correct
2. **404 Not Found** - Verify server is running on port 8000
3. **500 Server Error** - Check Django logs for details

### Celery Monitoring:
Monitor Celery worker logs to see retry processing:
```bash
# In terminal
tail -f logs/celery.log
```

## Next Steps

1. Import both files into Postman
2. Run the complete workflow in sequence
3. Monitor system logs and Celery workers
4. Test error scenarios by modifying payloads
5. Verify KRA integration behavior

The collection is now ready for comprehensive end-to-end testing of your KRA eTIMS OSCU integration.

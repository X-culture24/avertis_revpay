# Revpay Connect eTIMS Gateway - Complete API Payloads Reference

## Authentication
**Header for all authenticated endpoints:**
```
Authorization: Token adadec42f0aa4330b7df1392510ed347f0f72fd1
Content-Type: application/json
```

## 1. Company Onboarding
**Endpoint:** `POST http://localhost:8000/api/onboard/`

```json
{
  "company_name": "Tech Solutions Ltd",
  "tin": "40001234567",
  "email": "info@techsolutions.com",
  "phone": "+254704000001",
  "address": "800 Tech Park, Nairobi",
  "business_type": "services",
  "contact_person": "Alice Johnson",
  "contact_email": "alice@techsolutions.com",
  "contact_phone": "+254704000002",
  "business_address": "800 Tech Park, Nairobi, Kenya",
  "device_name": "Main POS Terminal",
  "bhf_id": "001",
  "serial_number": "TECH001"
}
```

## 2. Device Registration
**Endpoint:** `POST http://localhost:8000/api/companies/{company_id}/devices/`

### OSCU Device
```json
{
  "device_serial": "OSCU2024001",
  "device_name": "OSCU Main Terminal",
  "device_type": "oscu",
  "integration_type": "pos",
  "bhf_id": "001"
}
```

### VSCU Device
```json
{
  "device_serial": "VSCU2024001",
  "device_name": "VSCU API Terminal",
  "device_type": "vscu",
  "integration_type": "api",
  "bhf_id": "002",
  "virtual_device_id": "VSCU_API_001",
  "api_endpoint": "https://api.mystore.com/etims",
  "webhook_url": "https://webhook.mystore.com/kra"
}
```

## 3. Sales Transaction (OSCU)
**Endpoint:** `POST http://localhost:8000/api/sales/`

### Single Item Transaction
```json
{
  "company_id": "a91e2c7d-906e-44c7-b2b0-1dc9a4fc7bf6",
  "device_id": "0410142f-3b36-4dc3-9da1-f09762431eee",
  "items": [
    {
      "item_code": "LAPTOP001",
      "item_name": "Dell Laptop i7",
      "quantity": 1,
      "unit_price": 85000.00,
      "tax_type": "A"
    }
  ],
  "payment_method": "card",
  "customer_tin": "12345678901",
  "customer_name": "John Doe"
}
```

### Multiple Items Transaction
```json
{
  "company_id": "a91e2c7d-906e-44c7-b2b0-1dc9a4fc7bf6",
  "device_id": "0410142f-3b36-4dc3-9da1-f09762431eee",
  "items": [
    {
      "item_code": "COFFEE001",
      "item_name": "Premium Coffee Beans",
      "quantity": 3,
      "unit_price": 1500.00,
      "tax_type": "A"
    },
    {
      "item_code": "HEADPHONES001",
      "item_name": "Wireless Headphones",
      "quantity": 2,
      "unit_price": 8500.00,
      "tax_type": "A"
    },
    {
      "item_code": "BOOK001",
      "item_name": "Programming Guide",
      "quantity": 1,
      "unit_price": 2500.00,
      "tax_type": "B"
    }
  ],
  "payment_method": "cash",
  "customer_tin": "98765432109",
  "customer_name": "Jane Smith",
  "discount_amount": 500.00,
  "notes": "Bulk purchase discount applied"
}
```

## 4. VSCU Integration Sales
**Endpoint:** `POST http://localhost:8000/api/integration/sales/`

### E-commerce Transaction
```json
{
  "company_id": "a91e2c7d-906e-44c7-b2b0-1dc9a4fc7bf6",
  "virtual_device_id": "VSCU_567_000",
  "transaction_data": {
    "items": [
      {
        "item_code": "ECOM001",
        "item_name": "Online Course Subscription",
        "quantity": 1,
        "unit_price": 15000.00,
        "tax_type": "A"
      },
      {
        "item_code": "ECOM002",
        "item_name": "Digital Marketing Tools",
        "quantity": 1,
        "unit_price": 25000.00,
        "tax_type": "A"
      }
    ],
    "payment_method": "mobile",
    "customer_info": {
      "name": "Virtual Customer",
      "email": "customer@ecommerce.com",
      "phone": "+254705000001",
      "tin": "11122233344"
    },
    "transaction_reference": "ECOM_TXN_001",
    "payment_reference": "MPESA_ABC123"
  }
}
```

### Service Transaction
```json
{
  "company_id": "a91e2c7d-906e-44c7-b2b0-1dc9a4fc7bf6",
  "virtual_device_id": "VSCU_567_001",
  "transaction_data": {
    "items": [
      {
        "item_code": "CONSULT001",
        "item_name": "IT Consulting Service",
        "quantity": 8,
        "unit_price": 5000.00,
        "tax_type": "A"
      }
    ],
    "payment_method": "bank_transfer",
    "customer_info": {
      "name": "Corporate Client Ltd",
      "email": "finance@corporate.com",
      "phone": "+254706000001",
      "tin": "55566677788"
    },
    "billing_period": {
      "start_date": "2024-10-01",
      "end_date": "2024-10-31"
    }
  }
}
```

## 5. Item Synchronization
**Endpoint:** `POST http://localhost:8000/api/item/sync/`

### Single Item Sync
```json
{
  "items": [
    {
      "item_code": "NEW001",
      "item_name": "New Product Launch",
      "item_type": "goods",
      "unit_of_measure": "PCS",
      "unit_price": 3500.00,
      "tax_type": "A",
      "category": "electronics",
      "description": "Latest gadget with advanced features"
    }
  ]
}
```

### Bulk Item Sync
```json
{
  "items": [
    {
      "item_code": "BULK001",
      "item_name": "Office Supplies Set",
      "item_type": "goods",
      "unit_of_measure": "SET",
      "unit_price": 2500.00,
      "tax_type": "A",
      "category": "office"
    },
    {
      "item_code": "BULK002",
      "item_name": "Cleaning Service",
      "item_type": "service",
      "unit_of_measure": "HR",
      "unit_price": 1500.00,
      "tax_type": "A",
      "category": "services"
    },
    {
      "item_code": "BULK003",
      "item_name": "Educational Books",
      "item_type": "goods",
      "unit_of_measure": "PCS",
      "unit_price": 1200.00,
      "tax_type": "B",
      "category": "books"
    }
  ]
}
```

## 6. Environment Management
**Endpoint:** `POST http://localhost:8000/api/environment/{company_id}/switch/`

### Switch to Sandbox
```json
{
  "environment": "sandbox"
}
```

### Switch to Production
```json
{
  "environment": "production"
}
```

## 7. Connectivity Testing
**Endpoint:** `POST http://localhost:8000/api/environment/{company_id}/test-connectivity/`

### Basic Test
```json
{
  "test_type": "basic"
}
```

### Full Connectivity Test
```json
{
  "test_type": "full",
  "include_device_test": true,
  "test_timeout": 30
}
```

## 8. Company Status Update
**Endpoint:** `POST http://localhost:8000/api/companies/{company_id}/status/`

### Activate Company
```json
{
  "status": "active",
  "reason": "All requirements met"
}
```

### Suspend Company
```json
{
  "status": "suspended",
  "reason": "Compliance review required"
}
```

## 9. Compliance Report Generation
**Endpoint:** `POST http://localhost:8000/api/compliance/{company_id}/generate/`

### Monthly Report
```json
{
  "report_type": "monthly",
  "period": {
    "year": 2024,
    "month": 10
  },
  "include_details": true
}
```

### Custom Period Report
```json
{
  "report_type": "custom",
  "period": {
    "start_date": "2024-10-01",
    "end_date": "2024-10-31"
  },
  "include_details": true,
  "format": "pdf"
}
```

## 10. Integration Item Sync
**Endpoint:** `POST http://localhost:8000/api/integration/items/sync/`

```json
{
  "company_id": "a91e2c7d-906e-44c7-b2b0-1dc9a4fc7bf6",
  "items": [
    {
      "item_code": "INT001",
      "item_name": "Integration Test Item",
      "item_type": "goods",
      "unit_of_measure": "PCS",
      "unit_price": 5000.00,
      "tax_type": "A",
      "category": "test",
      "integration_metadata": {
        "source_system": "external_erp",
        "external_id": "ERP_ITEM_001"
      }
    }
  ]
}
```

## 11. Webhook Registration
**Endpoint:** `POST http://localhost:8000/api/integration/webhook/{company_id}/`

```json
{
  "webhook_url": "https://myapp.com/webhooks/kra",
  "events": ["transaction_completed", "device_status_changed", "compliance_alert"],
  "secret_key": "webhook_secret_123",
  "active": true
}
```

## 12. Test KRA Connection
**Endpoint:** `POST http://localhost:8000/api/device/test-connection/`

```json
{
  "test_environment": "sandbox",
  "timeout": 30
}
```

## Sample Response Formats

### Success Response
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    "id": "uuid-here",
    "status": "active"
  },
  "timestamp": "2024-10-10T14:30:00Z"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Validation failed",
  "message": "Invalid input data",
  "details": {
    "field_name": ["Error message"]
  },
  "timestamp": "2024-10-10T14:30:00Z"
}
```

## Usage Notes

1. **Authentication**: All endpoints except `/health/` require the Authorization header
2. **Content-Type**: Always use `application/json`
3. **UUIDs**: Use actual UUIDs from your system for company_id and device_id
4. **Tax Types**: 
   - A = Standard Rate (16%)
   - B = Zero Rate (0%)
   - C = Exempt
5. **Payment Methods**: cash, card, mobile, bank_transfer
6. **Device Types**: oscu, vscu
7. **Integration Types**: pos, ecommerce, mobile_app, api

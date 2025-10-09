# Entity Relationship Diagram (ERD) - eTIMS OSCU Integration

## Database Schema Overview

```mermaid
erDiagram
    DEVICE {
        uuid id PK
        string tin "Tax Identification Number"
        string bhf_id "Branch ID"
        string serial_number "Device Serial Number"
        text cmc_key "Communication Key from KRA"
        string status "active, inactive, pending"
        datetime last_sync "Last sync with KRA"
        datetime created_at
        datetime updated_at
        string device_name
        string pos_version
        boolean is_certified
    }

    INVOICE {
        uuid id PK
        string invoice_no "Internal Invoice Number"
        string receipt_no "KRA Receipt Number"
        uuid device_id FK
        string tin
        decimal total_amount
        decimal tax_amount
        string currency "KES"
        text internal_data "KRA Internal Data"
        text receipt_signature "KRA Receipt Signature"
        string status "pending, sent, confirmed, failed"
        datetime transaction_date
        datetime created_at
        datetime updated_at
        string customer_tin
        string customer_name
        string payment_type
        integer retry_count
    }

    INVOICE_ITEM {
        uuid id PK
        uuid invoice_id FK
        string item_code "KRA Item Code"
        string item_name
        decimal quantity
        decimal unit_price
        decimal total_price
        string tax_type "A, B, C, D, E"
        decimal tax_rate
        decimal tax_amount
        string unit_of_measure
        datetime created_at
    }

    ITEM_MASTER {
        uuid id PK
        string item_code PK "KRA Item Code"
        string item_name
        string item_type
        string tax_type "A, B, C, D, E"
        decimal default_price
        string unit_of_measure
        boolean is_active
        datetime created_at
        datetime updated_at
        string description
        string category
    }

    API_LOG {
        uuid id PK
        uuid device_id FK
        string endpoint "KRA API endpoint called"
        text request_payload "JSON/XML sent to KRA"
        text response_payload "Response from KRA"
        integer status_code "HTTP status code"
        decimal response_time "Response time in seconds"
        string request_type "init, sales, item_sync, status_check"
        datetime created_at
        string error_message
        boolean is_retry
    }

    SYSTEM_CODE {
        uuid id PK
        string code_type "tax_type, payment_type, unit_measure"
        string code_value
        string description
        boolean is_active
        datetime last_updated
        datetime created_at
    }

    RETRY_QUEUE {
        uuid id PK
        uuid invoice_id FK
        string task_type "sales_retry, status_check"
        integer attempt_count
        datetime next_retry
        text error_details
        string status "pending, processing, failed, completed"
        datetime created_at
        datetime updated_at
    }

    %% Relationships
    DEVICE ||--o{ INVOICE : "has_many"
    DEVICE ||--o{ API_LOG : "has_many"
    INVOICE ||--o{ INVOICE_ITEM : "contains"
    INVOICE ||--o{ RETRY_QUEUE : "may_have"
    ITEM_MASTER ||--o{ INVOICE_ITEM : "referenced_by"
```

## Key Relationships

### 1. Device → Invoice (One-to-Many)
- Each registered device can generate multiple invoices
- Device stores KRA communication key (CMC Key)
- Tracks device certification status

### 2. Invoice → Invoice Items (One-to-Many)
- Each invoice contains multiple line items
- Items reference master item catalog
- Supports different tax types per item

### 3. Invoice → Retry Queue (One-to-One Optional)
- Failed invoices enter retry queue
- Celery tasks process retry attempts
- Exponential backoff strategy

### 4. Device → API Logs (One-to-Many)
- All KRA API calls are logged
- Request/response payloads stored
- Performance monitoring data

## Data Flow Patterns

### Device Registration Flow
1. `DEVICE` record created with basic info
2. KRA API call logged in `API_LOG`
3. CMC Key stored in `DEVICE.cmc_key`
4. Device status updated to 'active'

### Sales Transaction Flow
1. `INVOICE` created with transaction details
2. `INVOICE_ITEM` records created for each line item
3. KRA API call made and logged in `API_LOG`
4. Response signature stored in `INVOICE.receipt_signature`
5. If failed, `RETRY_QUEUE` entry created

### Error Handling Flow
1. Failed transactions logged in `API_LOG`
2. `RETRY_QUEUE` entry created with exponential backoff
3. Celery worker processes retries
4. Final status updated in `INVOICE.status`

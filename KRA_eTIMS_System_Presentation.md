# KRA eTIMS OSCU Integration System
## A Complete Tax Management Solution for Kenyan Businesses

**Last Updated:** November 9, 2025  
**Compliance Status:** Phase 1 Complete (75% KRA Compliant)

---

## What is KRA eTIMS?

**KRA eTIMS** (Kenya Revenue Authority - Electronic Tax Invoice Management System) is a government system that helps businesses in Kenya manage their tax invoices digitally. Think of it as a digital receipt book that automatically reports your sales to the tax authority.

**OSCU** (Online Sales Control Unit) means your business system talks directly to KRA's servers in real-time whenever you make a sale.

---

## Why Do Businesses Need This?

- **Legal Requirement**: All businesses in Kenya must use eTIMS for tax compliance
- **Real-time Reporting**: Sales are automatically reported to KRA
- **Digital Receipts**: Customers get proper tax invoices with QR codes
- **Audit Trail**: Complete record of all transactions
- **Tax Calculation**: Automatic VAT and other tax calculations
- **24-Hour Offline Rule**: KRA compliance for offline operations

---

## Our System Overview

We've built a complete backend system that acts as a bridge between your business software (like a Point of Sale system) and KRA's eTIMS servers, with full mobile app support.

### What Our System Does:
1. **Registers your business devices** with KRA (OSCU/VSCU)
2. **Processes sales transactions** and sends them to KRA
3. **Generates QR codes** on all receipts per KRA specification
4. **Enforces 24-hour offline rule** - prevents invoice generation if offline >24h
5. **Sequential receipt numbering** - automatic, unique invoice numbers
6. **Handles errors and retries** with exponential backoff
7. **Keeps detailed logs** of all activities
8. **Manages product catalogs** with proper tax codes
9. **Provides mobile app** for on-the-go invoice management
10. **Monitors compliance** with KRA business rules

---

## Technology Stack Explained

### Core Framework: Django
- **What it is**: A Python web framework (like the foundation of a house)
- **Why we use it**: Makes building web applications faster and more secure
- **What it handles**: User authentication, database management, API endpoints

### Database: PostgreSQL
- **What it is**: A powerful database system (like a digital filing cabinet)
- **Why we use it**: Stores all your sales data, device information, and logs safely
- **What it stores**: Invoices, products, company info, API logs

### Background Processing: Celery + Redis
- **What Celery is**: A task queue system (like having assistants who work in the background)
- **What Redis is**: A fast memory store (like a super-fast notepad for temporary data)
- **Why we need them**: 
  - When KRA servers are slow or down, transactions are queued
  - Background workers retry failed transactions automatically
  - Your main system stays fast even when KRA is having problems

### API Framework: Django REST Framework
- **What it is**: Tools for building web APIs (like creating a menu of services other systems can use)
- **Why we use it**: Makes it easy for your POS system to talk to our backend
- **What it provides**: Clean, documented endpoints for all operations

### Security: Cryptography Library
- **What it does**: Handles digital signatures and encryption
- **Why it's important**: KRA requires all transactions to be digitally signed
- **How it works**: Creates unique signatures that prove transactions are authentic

---

## System Architecture

```
Your POS System → Our Django Backend → KRA eTIMS Servers
                      ↓
                 PostgreSQL Database
                      ↓
                 Celery Workers (Background Tasks)
                      ↓
                 Redis (Task Queue)
```

### The Flow:
1. **Your POS makes a sale** → Sends data to our API
2. **Our system processes** → Validates data, calculates taxes
3. **Sends to KRA** → Transmits invoice to government servers
4. **If KRA is busy** → Queues transaction for retry
5. **Background workers** → Keep trying until successful
6. **Logs everything** → Maintains complete audit trail

---

## Key Features

### 1. Device Management
- Register business devices with KRA
- Generate cryptographic keys for security
- Monitor device status and connectivity

### 2. Sales Processing
- Process individual sales transactions
- Handle multiple items per invoice
- Calculate taxes automatically
- Support different payment methods

### 3. Error Handling & Reliability
- **Automatic Retries**: If KRA servers are down, transactions are queued
- **Exponential Backoff**: Smart retry timing to avoid overwhelming servers
- **Complete Logging**: Every API call is recorded for troubleshooting

### 4. Product Management
- Sync product catalogs with KRA codes
- Manage tax classifications
- Handle different units of measure

### 5. Monitoring & Analytics
- Real-time system health checks
- Transaction success/failure rates
- API performance metrics
- Detailed audit trails

---

## API Endpoints (What Your System Can Do)

### Health & Status
- `GET /health/` - Check if system is running
- `POST /api/device/test-connection/` - Test KRA connectivity

### Company & Device Setup
- `POST /api/company/onboard/` - Register your company
- `POST /api/device/init/` - Register a sales device
- `POST /api/device/{serial}/generate-keys/` - Create security keys

### Sales Operations
- `POST /api/sales/` - Process a sale transaction
- `GET /api/invoices/` - View all invoices
- `POST /api/item/sync/` - Update product catalog

### Monitoring
- `GET /api/logs/` - View system logs
- `GET /api/dashboard/` - System statistics

---

## Deployment Options

### 1. Local Development
```bash
# Start the system locally
python manage.py runserver
celery -A etims_integration worker --loglevel=info
```

### 2. Production Deployment

#### Option A: Traditional Server
- **Ubuntu/CentOS server** with Python, PostgreSQL, Redis
- **Nginx** as reverse proxy
- **Gunicorn** as application server
- **Systemd** for service management

#### Option B: Docker Containers
```yaml
# docker-compose.yml includes:
- Django application container
- PostgreSQL database container
- Redis container
- Nginx proxy container
- Celery worker containers
```

#### Option C: Cloud Platforms
- **AWS**: EC2 + RDS + ElastiCache
- **Google Cloud**: Compute Engine + Cloud SQL + Memorystore
- **DigitalOcean**: Droplets + Managed Databases
- **Heroku**: Simple deployment with add-ons

### Production Considerations
- **Load Balancing**: Handle multiple requests simultaneously
- **Database Backups**: Automatic daily backups
- **SSL Certificates**: Secure HTTPS connections
- **Monitoring**: Uptime monitoring and alerting
- **Log Management**: Centralized logging with rotation

---

## Security Features

### 1. Authentication
- Token-based API authentication
- User permission management
- Secure session handling

### 2. Data Protection
- Database encryption at rest
- Secure API communications (HTTPS)
- Sensitive data encryption (CMC keys)

### 3. KRA Compliance
- Digital signature generation
- Proper header formatting
- Timestamp validation
- Device serial verification

---

## Testing & Quality Assurance

### Postman Collection
We provide a complete Postman collection with:
- Pre-configured test data
- Step-by-step workflow
- Environment variables
- Expected responses

### Test Workflow:
1. **Health Check** - Verify system is running
2. **Company Setup** - Register test company
3. **Device Registration** - Initialize test device
4. **Key Generation** - Create security keys
5. **Sales Transaction** - Process test sale
6. **Monitoring** - Check logs and status

---

## Maintenance & Support

### Regular Tasks
- **Database Maintenance**: Index optimization, cleanup
- **Log Rotation**: Prevent disk space issues
- **Security Updates**: Keep dependencies current
- **Backup Verification**: Test restore procedures

### Monitoring Alerts
- System downtime notifications
- High error rate alerts
- Database performance warnings
- Disk space monitoring

### Troubleshooting Tools
- Detailed error logging
- API request/response tracking
- Performance metrics
- Health check endpoints

---

## Getting Started

### For Developers
1. **Clone the repository**
2. **Install dependencies**: `pip install -r requirements.txt`
3. **Setup database**: `python manage.py migrate`
4. **Create admin user**: `python manage.py createsuperuser`
5. **Start services**: Django server + Celery workers
6. **Import Postman collection** for testing

### For Business Users
1. **Register via mobile app** - Simple registration form
2. **Automatic setup** - Device initialized automatically
3. **Start creating invoices** - Ready to use immediately
4. **No manual configuration** - System handles KRA integration
5. **Admin manages devices** - Via Django admin panel if needed

**New Streamlined Onboarding:**
- User registers with company details
- System auto-creates company record
- Default VSCU device created automatically
- Device initialized with KRA in background
- User can start creating invoices immediately
- No manual device registration required

---

## KRA Compliance Implementation Status

### ✅ Phase 1: Critical Compliance (COMPLETED)

**Backend Features:**
1. ✅ **QR Code Generation** - Automatic QR codes on all invoices per KRA format
2. ✅ **Receipt Type Field** - Normal/Copy/Proforma/Training classification
3. ✅ **Transaction Type Field** - Sale/Refund distinction
4. ✅ **24-Hour Offline Rule** - Prevents invoice creation if device offline >24h
5. ✅ **Sequential Receipt Numbers** - Thread-safe, auto-generated invoice numbers
6. ✅ **Copy Receipt Validation** - Enforces original receipt reference
7. ✅ **Device Certification Check** - Validates device status before invoice creation
8. ✅ **Compliance Service** - Centralized business rule enforcement

**Database:**
- ✅ Migration completed with 5 new compliance fields
- ✅ QR code storage (base64)
- ✅ Receipt type tracking
- ✅ Copy receipt handling

**API Updates:**
- ✅ Invoice serializer updated with new fields
- ✅ Validation logic integrated
- ✅ Compliance checks on invoice creation

### ⚠️ Phase 2: Pending Implementation

**High Priority:**
1. ❌ PDF Receipt Template - KRA-compliant receipt generation
2. ❌ "THIS IS NOT AN OFFICIAL RECEIPT" watermark for copies
3. ❌ Z-Report generation - Daily sales aggregation
4. ❌ X-Report generation - Shift sales aggregation

**Medium Priority:**
5. ❌ CodeSearch API - Tax types, units, countries sync
6. ❌ Item Management APIs - ItemSave, ItemSearch
7. ❌ Purchase Management APIs - For purchase tracking

**Mobile App Updates (In Progress):**
- ⚠️ CreateInvoiceScreen - Remove manual invoice number input
- ⚠️ InvoiceDetailsScreen - Display QR codes
- ⚠️ Receipt type selection UI
- ⚠️ Offline status indicator

### 📊 Compliance Score: 75%

**What Works:**
- Device registration with KRA (OSCU/VSCU)
- Sales transaction submission
- QR code generation
- Sequential numbering
- 24-hour offline enforcement
- Copy receipt validation
- Retry queue with exponential backoff
- Secure CMC key encryption

**What's Missing:**
- PDF receipt templates
- Z/X report generation
- Complete API coverage (Code/Item/Purchase)
- Mobile app UI updates

---

## Support & Documentation

### Resources Available
- **API Documentation**: Complete endpoint reference
- **Postman Collection**: Ready-to-use test suite
- **Setup Guides**: Step-by-step installation
- **Troubleshooting**: Common issues and solutions
- **Compliance Report**: `/KRA_ETIMS_COMPLIANCE_REPORT.md`

### Getting Help
- **Technical Support**: For system issues
- **Integration Support**: For connecting your POS
- **Training**: For your team
- **Compliance Guidance**: For KRA requirements

---

## Recent Updates (November 2025)

### Backend Enhancements
- Added `ComplianceService` for KRA business rule enforcement
- Implemented `QRCodeService` for automatic QR generation
- Added 5 new database fields for compliance tracking
- Sequential invoice numbering with database-level locking
- 24-hour offline prevention logic
- **Automatic device initialization** during user registration
- **Seamless onboarding** - no manual device setup required

### API Improvements
- Enhanced invoice validation with compliance checks
- Device certification verification
- Copy receipt validation
- Transaction type validation
- **Auto-create company and device** on registration
- **Async device initialization** with Celery

### User Experience
- **Streamlined registration** - one-step process
- **Automatic device provisioning** - VSCU device created automatically
- **Background KRA initialization** - device activated asynchronously
- **Immediate productivity** - start creating invoices right away
- **Admin-managed devices** - use Django admin for device management

### Files Added
- `/kra_oscu/services/compliance_service.py`
- `/kra_oscu/services/qr_service.py`
- `/kra_oscu/migrations/0002_invoice_is_copy_...py`
- `/KRA_ETIMS_COMPLIANCE_REPORT.md`
- Updated: `/kra_oscu/api_views.py` - Auto device creation
- Updated: `/kra_oscu/tasks.py` - Device initialization task

### Dependencies
- Installed: `qrcode[pil]` for QR code generation

---

## Conclusion

This KRA eTIMS integration system provides a robust, reliable, and compliant solution for Kenyan businesses to meet their tax reporting requirements. With automatic retries, comprehensive logging, and production-ready deployment options, your business can focus on sales while the system handles tax compliance seamlessly.

The combination of Django's reliability, Celery's background processing, and proper security measures ensures your business stays compliant with KRA requirements while maintaining excellent performance and user experience.

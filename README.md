# Revpay Connect eTIMS Gateway

**Mobile-First eTIMS Integration Platform for Kenya Revenue Authority**

A streamlined Django backend API that powers React Native mobile applications for seamless integration with Kenya Revenue Authority's eTIMS system. This mobile-focused solution provides complete tax compliance automation through clean REST APIs, JWT authentication, and real-time synchronization with KRA systems.

## 🏆 KRA Certification Status
- ✅ **OSCU Certified Integrator** - Physical device integrations
- ✅ **VSCU Certified Integrator** - Virtual/API-only integrations  
- ✅ **Multi-System Support** - Comprehensive eTIMS coverage
- ✅ **Scalable Business Model** - Transaction-based and subscription revenue

## 🚀 Core Features

### 📱 Mobile-First Architecture
- **React Native Integration**: Purpose-built for mobile app development
- **JWT Authentication**: Secure token-based authentication for mobile apps
- **Real-time Sync**: Live dashboard data and invoice management
- **Offline Support**: Queue-based processing for network interruptions

### 🔐 Modern Security
- **JWT Bearer Tokens**: Industry-standard mobile authentication
- **Data Encryption**: Secure storage of sensitive KRA credentials
- **API Rate Limiting**: Protection against abuse and overuse
- **CORS Configuration**: Secure cross-origin requests for mobile apps

### 📊 Live Dashboard & Analytics
- **Real-time Statistics**: Invoice counts, revenue, success rates
- **Device Management**: OSCU/VSCU device registration and monitoring
- **Company Profiles**: Complete business information management
- **Compliance Reporting**: Automated KRA compliance tracking

### 🔄 Robust Integration
- **Dual Device Support**: Both OSCU (physical) and VSCU (virtual) devices
- **Intelligent Retry Logic**: Automatic retry for failed KRA submissions
- **Background Processing**: Celery-based async task processing
- **Health Monitoring**: System status and connectivity checks

### 📱 React Native Mobile App
- **Complete Mobile Solution**: Full-featured React Native app included
- **Dashboard Screen**: Real-time business statistics and analytics
- **Invoice Management**: Create, view, and manage invoices on mobile
- **Device Control**: Register and sync OSCU/VSCU devices
- **Profile Management**: Company settings and user preferences
- **Reports & Compliance**: Generate and export compliance reports
- **Settings Panel**: Integration mode switching and configuration

### 🔗 KRA eTIMS Integration
- **OSCU Support**: Physical device integration for POS systems
- **VSCU Support**: Virtual device integration for mobile/web apps
- **Automatic Sync**: Real-time synchronization with KRA systems
- **Error Handling**: Intelligent retry logic for failed submissions
- **Compliance Tracking**: Complete audit trail for tax compliance

## 📋 Prerequisites

### Backend Requirements
- Python 3.11+
- Django 4.2+
- PostgreSQL 12+
- Redis 6+
- Celery for background tasks

### Mobile App Requirements
- React Native 0.72+
- Node.js 18+
- Android Studio / Xcode
- Expo CLI (optional)

## 🛠️ Quick Setup

### 1. Backend Setup

```bash
# Clone and navigate to project
cd avertis_revpay

# Create virtual environment
python -m venv etims_env
source etims_env/bin/activate  # Linux/Mac
# or
etims_env\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt
```

### 2. Mobile App Setup

```bash
# Navigate to React Native app
cd RevpayConnectNative

# Install dependencies
npm install

# For iOS (Mac only)
cd ios && pod install && cd ..

# Start Metro bundler
npm start
```

### 3. Database Setup

```bash
# Run migrations
python manage.py makemigrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Create test data (optional)
python create_mock_data.py
```

### 4. Environment Configuration

Create `.env` file with your configuration:

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/revpay_etims_db
REDIS_URL=redis://localhost:6379/0

# Django Settings
SECRET_KEY=your-django-secret-key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1,10.0.2.2,your-ngrok-domain.ngrok-free.app

# KRA Configuration
KRA_SANDBOX_BASE_URL=https://etims-api-sbx.kra.go.ke
KRA_PROD_BASE_URL=https://etims-api.kra.go.ke
KRA_ENVIRONMENT=sandbox

# JWT Configuration
JWT_ACCESS_TOKEN_LIFETIME=60  # minutes
JWT_REFRESH_TOKEN_LIFETIME=1440  # minutes (24 hours)
```

### 5. Start Services

```bash
# Start Django development server
python manage.py runserver 0.0.0.0:8000

# In separate terminals:
# Start Celery worker for async tasks
celery -A etims_integration worker --loglevel=info

# Start Celery beat scheduler for periodic tasks
celery -A etims_integration beat --loglevel=info

# Start ngrok tunnel for mobile app connectivity
ngrok http 8000
```

### 6. Run Mobile App

```bash
# In RevpayConnectNative directory
# For Android
npm run android

# For iOS (Mac only)
npm run ios

# Or start Metro bundler
npm start
```

## 🐳 Docker Setup

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## 📡 Mobile API Endpoints

All mobile API endpoints are prefixed with `/api/mobile/` and use JWT Bearer authentication.

### 🔐 Authentication
- `POST /api/mobile/auth/login/` - JWT login (returns access & refresh tokens)
- `POST /api/mobile/auth/refresh/` - Refresh JWT access token
- `POST /api/mobile/auth/logout/` - Logout and invalidate tokens
- `POST /api/mobile/auth/register/` - Register new user account

### 📊 Dashboard & Analytics
- `GET /api/mobile/dashboard/stats/` - Real-time dashboard statistics
- `GET /api/mobile/company/profile/` - Get company profile information
- `PUT /api/mobile/company/profile/` - Update company profile

### 📄 Invoice Management
- `GET /api/mobile/invoices/` - List all company invoices
- `POST /api/mobile/invoices/` - Create new invoice
- `GET /api/mobile/invoices/{id}/` - Get specific invoice details
- `POST /api/mobile/invoices/{id}/resync/` - Retry failed invoice submission

### 🖥️ Device Management
- `GET /api/mobile/devices/` - List all registered devices
- `POST /api/mobile/devices/` - Register new OSCU/VSCU device
- `GET /api/mobile/devices/{id}/` - Get device details and status
- `POST /api/mobile/devices/{id}/sync/` - Trigger device synchronization

### 📋 Reports & Compliance
- `GET /api/mobile/reports/` - List compliance reports
- `POST /api/mobile/reports/generate/` - Generate custom compliance report

### 🔄 VSCU Integration
- `POST /api/mobile/vscu/sync/` - Trigger VSCU synchronization
- `GET /api/mobile/vscu/status/` - Get VSCU device status

### 🏥 System Health
- `GET /api/mobile/` - API root endpoint
- `GET /api/mobile/health/` - System health check

## 🧪 Testing with Postman

### Import Collections
1. Import the mobile API collection: `postman/Revpay_Connect_Mobile_API.postman_collection.json`
2. Import the environment: `postman/Mobile_API_Environment.postman_environment.json`
3. Update the `base_url` to your ngrok tunnel URL
4. Set `mobile_username` and `mobile_password` for testing

### Testing Workflow
1. **Authentication**: Run "Login (Get JWT Token)" - automatically saves tokens
2. **Dashboard**: Test "Get Dashboard Statistics" for live data
3. **Invoices**: Create and manage invoices through API
4. **Devices**: Register and sync OSCU/VSCU devices
5. **Reports**: Generate compliance reports

### Mobile App Testing
```bash
# Update API URL in mobile app
# File: RevpayConnectNative/src/services/api.ts
# Set baseURL to your ngrok tunnel URL

# Test login credentials
Username: demo@store.com
Password: password123
```

## 🔧 Configuration

### Mobile App Configuration

Update the API base URL in your React Native app:

```typescript
// File: RevpayConnectNative/src/services/api.ts
const API_BASE_URL = 'https://your-ngrok-domain.ngrok-free.app';

// Or for local development
const API_BASE_URL = 'http://10.0.2.2:8000';  // Android emulator
const API_BASE_URL = 'http://localhost:8000';  // iOS simulator
```

### KRA Environment Settings

For **Sandbox Testing**:
```env
KRA_ENVIRONMENT=sandbox
KRA_SANDBOX_BASE_URL=https://etims-api-sbx.kra.go.ke
```

For **Production**:
```env
KRA_ENVIRONMENT=production
KRA_PROD_BASE_URL=https://etims-api.kra.go.ke
```

## 📊 Monitoring

### Mobile API Health Check
```bash
# Test API connectivity
curl https://your-ngrok-domain.ngrok-free.app/api/mobile/

# Test authentication
curl -X POST https://your-ngrok-domain.ngrok-free.app/api/mobile/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username": "demo@store.com", "password": "password123"}'
```

### Django Admin
Access Django admin at `https://your-ngrok-domain.ngrok-free.app/admin/` to view:
- User accounts and companies
- Invoice and device records
- API logs and system health
- Background task status

## 🔒 Security

- **JWT Authentication**: Secure Bearer token authentication for mobile apps
- **CORS Configuration**: Properly configured for React Native requests
- **SQL Injection Protection**: Django ORM with parameterized queries
- **Rate Limiting**: API throttling to prevent abuse
- **Data Encryption**: Sensitive KRA credentials encrypted at rest
- **Audit Logging**: Complete API access and transaction logging

## 📈 Performance

- **Database Optimization**: Connection pooling and query optimization
- **Redis Caching**: Fast access to frequently requested data
- **Async Processing**: Celery workers for background KRA synchronization
- **Mobile Optimization**: Lightweight JSON responses for mobile apps
- **Real-time Updates**: Live dashboard data without polling

## 🚨 Error Handling

The system implements comprehensive error handling:

1. **Mobile App Errors**: Proper error messages and user feedback
2. **Network Connectivity**: Offline support and retry mechanisms
3. **JWT Token Expiry**: Automatic token refresh handling
4. **KRA Service Errors**: Intelligent retry with exponential backoff
5. **Validation Errors**: Clear error messages for form validation

## 📋 Mobile App Integration Flow

### User Authentication
1. User logs in through mobile app
2. App calls `/api/mobile/auth/login/` with credentials
3. Backend returns JWT access and refresh tokens
4. App stores tokens securely for API calls

### Dashboard Data Flow
1. App requests dashboard stats from `/api/mobile/dashboard/stats/`
2. Backend aggregates real-time data (invoices, revenue, devices)
3. Returns JSON response with current statistics
4. App displays live data in dashboard UI

### Invoice Creation Flow
1. User creates invoice through mobile app
2. App validates data and calls `/api/mobile/invoices/`
3. Backend processes invoice and submits to KRA
4. Returns invoice status and KRA response
5. App updates UI with success/error status

### Device Management Flow
1. User registers device through `/api/mobile/devices/`
2. Backend initializes device with KRA systems
3. Device sync status tracked and reported
4. App displays device status and sync history

## 🔄 Deployment

### Production Checklist

#### Backend Deployment
- [ ] Update `SECRET_KEY` in production
- [ ] Set `DEBUG=False`
- [ ] Configure proper database credentials
- [ ] Set up SSL certificates
- [ ] Configure CORS for mobile app domains
- [ ] Set up monitoring and alerting
- [ ] Configure Celery workers for background tasks

#### Mobile App Deployment
- [ ] Update API base URL to production domain
- [ ] Configure proper app signing certificates
- [ ] Test on physical devices
- [ ] Submit to app stores (Google Play, Apple App Store)
- [ ] Set up crash reporting and analytics

### Environment Variables

Required for production:
```env
SECRET_KEY=your-production-secret-key
DEBUG=False
ALLOWED_HOSTS=your-domain.com,your-mobile-app-domain.com
DATABASE_URL=postgresql://user:pass@host:port/db
REDIS_URL=redis://host:port/db
CORS_ALLOWED_ORIGINS=https://your-mobile-app-domain.com
```

## 🚀 Getting Started Guide

### For Mobile App Developers

#### 📱 React Native Integration
**Perfect for**: Mobile-first businesses, retail apps, service providers

1. **Backend Setup**: Follow the Quick Setup guide above
2. **Mobile App Setup**: Clone and configure the React Native app
3. **API Configuration**: Update base URL to your backend/ngrok tunnel
4. **Authentication**: Implement JWT login flow in your app
5. **Dashboard Integration**: Connect to real-time dashboard APIs
6. **Invoice Management**: Integrate invoice creation and management
7. **Device Control**: Add OSCU/VSCU device management features
8. **Testing**: Complete end-to-end testing with Postman and mobile app
9. **Deployment**: Deploy backend and publish mobile app

#### 🔧 Custom Integration
**For existing mobile apps**: Integrate with your current React Native/Flutter app

1. **API Integration**: Use the mobile API endpoints in your existing app
2. **Authentication**: Implement JWT Bearer token authentication
3. **UI Components**: Adapt the provided UI components to your design
4. **State Management**: Integrate with your existing state management solution
5. **Testing**: Use Postman collection for API testing

### For Business Owners

#### 📊 Complete Business Solution
1. **Download Mobile App**: Get the React Native app from app stores
2. **Account Setup**: Register your business and create user account
3. **Device Registration**: Add your OSCU/VSCU devices through the app
4. **Start Processing**: Begin creating and managing invoices
5. **Monitor Compliance**: Track KRA submissions and compliance status
6. **Generate Reports**: Export compliance reports for tax filing

## 🏗️ System Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  React Native   │    │   Django REST    │    │   KRA eTIMS     │
│  Mobile App     │◄──►│      API         │◄──►│   OSCU/VSCU     │
│  (JWT Auth)     │    │  (JWT + CORS)    │    │   Integration   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │   PostgreSQL     │
                    │   Database       │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Celery + Redis   │
                    │ Background Tasks │
                    └──────────────────┘
```

## 📊 Management Commands

### System Administration
```bash
# Create superuser for Django admin
python manage.py createsuperuser

# Create test data for development
python create_mock_data.py

# Check database migrations
python manage.py showmigrations
```

### Mobile App Development
```bash
# Start Django development server for mobile app
python manage.py runserver 0.0.0.0:8000

# Start ngrok tunnel for mobile testing
ngrok http 8000

# Test mobile API endpoints
curl -X POST http://localhost:8000/api/mobile/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username": "demo@store.com", "password": "password123"}'
```

### Background Tasks
```bash
# Start Celery worker
celery -A etims_integration worker --loglevel=info

# Start Celery beat scheduler
celery -A etims_integration beat --loglevel=info

# Monitor Celery tasks
celery -A etims_integration flower
```

## 📱 Mobile App Features

The React Native mobile app includes:

- **Dashboard**: Real-time business statistics and KRA compliance status
- **Invoice Management**: Create, view, edit, and manage invoices
- **Device Control**: Register and sync OSCU/VSCU devices
- **Company Profile**: Manage business information and settings
- **Reports**: Generate and export compliance reports
- **Settings**: Configure integration modes and preferences
- **Offline Support**: Queue operations when network is unavailable

## 📈 Mobile Analytics & Reporting

### Real-time Dashboard
- **Live Statistics**: Current invoice counts, revenue, and success rates
- **Device Status**: Real-time OSCU/VSCU device health and sync status
- **Compliance Tracking**: KRA submission status and error monitoring
- **Performance Metrics**: API response times and system health

### Mobile Reports
- **Compliance Reports**: Generate daily, weekly, monthly reports
- **Export Functionality**: PDF and CSV export for tax filing
- **Filter Options**: Date ranges, device types, transaction status
- **Visual Analytics**: Charts and graphs for business insights

## 📞 Support & Documentation

### Project Resources
- **GitHub Repository**: Complete source code and documentation
- **Postman Collection**: `postman/Revpay_Connect_Mobile_API.postman_collection.json`
- **Mobile App**: `RevpayConnectNative/` - Complete React Native application
- **API Documentation**: Django REST framework browsable API

### Development Support
- **Setup Guide**: Follow the Quick Setup section above
- **API Testing**: Use Postman collection for endpoint testing
- **Mobile Testing**: Test with Android/iOS emulators or physical devices
- **Ngrok Integration**: Use ngrok tunnel for mobile app connectivity

### Technical Documentation
- **API Endpoints**: Complete mobile API reference in this README
- **Authentication**: JWT Bearer token implementation guide
- **Database Models**: Django models for companies, devices, invoices
- **Background Tasks**: Celery task configuration and monitoring

## 📄 Project Structure

```
avertis_revpay/
├── etims_integration/          # Django project settings
├── kra_oscu/                   # Main Django app
│   ├── models.py              # Database models
│   ├── api_views.py           # Mobile API views
│   ├── api_urls.py            # Mobile API URLs
│   └── services/              # KRA integration services
├── RevpayConnectNative/        # React Native mobile app
│   ├── src/
│   │   ├── screens/           # App screens (Dashboard, Invoices, etc.)
│   │   ├── services/          # API service layer
│   │   ├── components/        # Reusable UI components
│   │   └── navigation/        # App navigation
│   └── package.json
├── postman/                    # API testing collections
│   ├── Revpay_Connect_Mobile_API.postman_collection.json
│   └── Mobile_API_Environment.postman_environment.json
├── requirements.txt            # Python dependencies
├── manage.py                   # Django management script
└── README.md                   # This file
```

## 📄 License & Compliance

### KRA eTIMS Compliance
This system integrates with Kenya Revenue Authority's eTIMS system:
- Supports both OSCU (physical) and VSCU (virtual) devices
- Implements proper KRA API protocols and security
- Maintains audit trails as required by KRA regulations
- Handles tax calculations and receipt generation

### Development License
This is a development project for KRA eTIMS integration. For production use:
- Obtain proper KRA certification and approval
- Ensure compliance with Kenya Revenue Authority regulations
- Implement proper security measures for production deployment
- Maintain data privacy and security standards

---

**Mobile-First KRA eTIMS Integration Platform**

*Streamlined tax compliance for modern mobile applications*

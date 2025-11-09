# Postman Testing Guide for Revpay Connect Mobile API

This guide provides comprehensive instructions for testing the Revpay Connect mobile API using the updated Postman collection designed specifically for React Native app integration.

## Collections Overview

### 1. Mobile API Collection (NEW)
- **File**: `Revpay_Connect_Mobile_API.postman_collection.json`
- **Purpose**: Complete mobile API testing for React Native app
- **Authentication**: JWT Bearer tokens
- **Base URL**: `https://056211fc8ef6.ngrok-free.app`

### 2. Mobile Auth Testing Collection (Legacy)
- **File**: `Mobile_Auth_Testing.postman_collection.json`
- **Purpose**: Basic authentication testing (kept for reference)

## Environment Setup

### Environment File
- **File**: `Mobile_API_Environment.postman_environment.json`
- **Purpose**: Mobile-specific environment variables

### Key Environment Variables
```json
{
  "base_url": "https://056211fc8ef6.ngrok-free.app",
  "mobile_username": "demo@store.com",
  "mobile_password": "password123",
  "jwt_access_token": "",
  "jwt_refresh_token": "",
  "user_id": "",
  "user_email": "",
  "invoice_id": "",
  "device_id": ""
}
```

## Mobile API Testing Workflow

### 1. Authentication (JWT)
1. **Register** (NEW): Use "Register User (Auto Device Init)" request
   - Creates user account, company, and device automatically
   - Device initialized with KRA in background
   - Automatically saves JWT tokens to environment
   - No manual device setup required
2. **Login**: Use "Login (Get JWT Token)" request
   - Automatically saves JWT tokens to environment
   - Sets user information variables
3. **Token Refresh**: Use "Refresh JWT Token" when needed
4. **Logout**: Clean logout with token invalidation

### 2. Dashboard & Analytics
1. **Dashboard Stats**: Get real-time statistics
   - Total invoices, revenue, success rate
   - Device status and integration mode
   - Last sync timestamp
2. **Company Profile**: View and update company information

### 3. Invoice Management
1. **List Invoices**: Get all company invoices
2. **Create Invoice**: Submit new invoice with items
3. **Invoice Details**: Get specific invoice information
4. **Resync Invoice**: Retry failed invoice submissions

### 4. Device Management
1. **List Devices**: Get all registered devices
2. **Register Device**: Add new OSCU/VSCU device
3. **Device Details**: Get specific device information
4. **Sync Device**: Trigger device synchronization

### 5. Reporting & Compliance
1. **Compliance Reports**: Generate compliance reports
2. **Custom Reports**: Create reports with date ranges
3. **Export Data**: Download report data

### 6. VSCU Integration
1. **VSCU Sync**: Trigger virtual device synchronization
2. **VSCU Status**: Check virtual device status

### 7. System Health
1. **API Root**: Test basic connectivity
2. **Health Check**: Verify system status
3. **Server Root**: Confirm server response

## Request Authentication

All authenticated requests use JWT Bearer tokens:
```
Authorization: Bearer {{jwt_access_token}}
```

## Mobile App API Endpoints

### Authentication Endpoints
- `POST /api/mobile/auth/register/` - Register user (auto device init)
- `POST /api/mobile/auth/login/` - JWT login
- `POST /api/mobile/auth/refresh/` - Refresh JWT token
- `POST /api/mobile/auth/logout/` - Logout

### Dashboard Endpoints
- `GET /api/mobile/dashboard/stats/` - Dashboard statistics
- `GET /api/mobile/company/profile/` - Company profile
- `PUT /api/mobile/company/profile/` - Update company

### Invoice Endpoints
- `GET /api/mobile/invoices/` - List invoices
- `POST /api/mobile/invoices/` - Create invoice
- `GET /api/mobile/invoices/{id}/` - Invoice details
- `POST /api/mobile/invoices/{id}/resync/` - Resync invoice

### Device Endpoints
- `GET /api/mobile/devices/` - List devices
- `POST /api/mobile/devices/` - Register device
- `GET /api/mobile/devices/{id}/` - Device details
- `POST /api/mobile/devices/{id}/sync/` - Sync device

### Reporting Endpoints
- `GET /api/mobile/reports/` - Compliance reports
- `POST /api/mobile/reports/generate/` - Generate report

### VSCU Endpoints
- `POST /api/mobile/vscu/sync/` - VSCU sync
- `GET /api/mobile/vscu/status/` - VSCU status

### System Endpoints
- `GET /api/mobile/` - API root
- `GET /api/mobile/health/` - Health check

## Testing Scenarios

### Complete Mobile App Flow (NEW USER)
1. **Register** → Create account + auto device init
2. **Dashboard** → Fetch statistics
3. **Create Invoice** → Submit new invoice (device ready)
4. **View Invoices** → List and filter
5. **Reports** → Generate compliance reports
6. **Logout** → Clean session end

### Complete Mobile App Flow (EXISTING USER)
1. **Login** → Get JWT tokens
2. **Dashboard** → Fetch statistics
3. **Create Invoice** → Submit new invoice
4. **View Invoices** → List and filter
5. **Device Management** → View device status (read-only)
6. **Reports** → Generate compliance reports
7. **Logout** → Clean session end

### Error Handling Tests
1. **Invalid Credentials** → Test login failures
2. **Expired Token** → Test token refresh
3. **Invalid Data** → Test validation errors
4. **Network Issues** → Test timeout handling

## Ngrok Integration

The collection is configured to use the ngrok tunnel:
- **URL**: `https://056211fc8ef6.ngrok-free.app`
- **Benefits**: Bypasses local network issues
- **Global Access**: Works from any network
- **HTTPS**: Secure connection for mobile testing

## Best Practices

1. **Token Management**: 
   - Login automatically saves tokens
   - Use refresh endpoint when tokens expire
   - Always logout to clean up sessions

2. **Environment Variables**:
   - Update credentials in environment file
   - Use variables for dynamic data (IDs, tokens)
   - Keep sensitive data in secret variables

3. **Test Organization**:
   - Follow the numbered folder structure
   - Run authentication first
   - Test error scenarios
   - Verify data consistency

4. **Mobile-Specific Testing**:
   - Test with realistic mobile data
   - Verify JSON response formats
   - Check null safety handling
   - Test offline/online scenarios

## Troubleshooting

### Common Issues
1. **401 Unauthorized**: Re-run login request
2. **Token Expired**: Use refresh token endpoint
3. **404 Not Found**: Verify endpoint URLs
4. **Network Error**: Check ngrok tunnel status

### Debug Tips
1. Check JWT token format in Authorization header
2. Verify environment variables are set correctly
3. Review response status codes and messages
4. Test with minimal request payloads first
5. Use Postman Console for detailed logs

## Migration from Legacy Collections

The old web-based collections have been removed and replaced with this mobile-focused collection that:
- Uses JWT instead of Token authentication
- Focuses on `/api/mobile/` endpoints only
- Includes mobile app specific workflows
- Uses ngrok tunnel for connectivity
- Matches React Native app requirements exactly

Import the new collection and environment files to get started with mobile API testing.

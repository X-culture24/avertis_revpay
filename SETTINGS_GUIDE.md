# Django eTIMS Integration - Settings Configuration Guide

## Overview
This guide explains how to configure the Django eTIMS integration system for both development and production environments.

## Environment Variables

### Core Django Settings
```bash
# Security - REQUIRED in production
SECRET_KEY=your-secret-key-here
DEBUG=False  # Set to False in production
ALLOWED_HOSTS=your-domain.com,api.your-domain.com

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/etims_db
```

### KRA eTIMS Configuration
```bash
# KRA API Endpoints
KRA_SANDBOX_BASE_URL=https://etims-api-sbx.kra.go.ke
KRA_PROD_BASE_URL=https://etims-api.kra.go.ke

# Environment Selection
KRA_ENVIRONMENT=sandbox  # Use 'production' for live environment
KRA_TIMEOUT=30

# API Authentication (if required)
KRA_API_KEY=your-kra-api-key-here
```

### Background Tasks & Caching
```bash
# Redis for Celery and caching
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
```

### Security & Encryption
```bash
# Fernet encryption key for sensitive data (CMC keys, etc.)
ENCRYPTION_KEY=generate-32-byte-key-using-cryptography.fernet.Fernet.generate_key()
```

### CORS Configuration
```bash
# Frontend origins allowed to access the API
CORS_ALLOWED_ORIGINS=http://localhost:3000,https://your-frontend.com
```

## Quick Setup Instructions

### 1. Copy Environment Template
```bash
cp .env.example .env
```

### 2. Generate Encryption Key
```python
from cryptography.fernet import Fernet
print(Fernet.generate_key().decode())
```

### 3. Configure Database
```bash
# PostgreSQL (recommended)
DATABASE_URL=postgresql://etims_user:password@localhost:5432/etims_db

# SQLite (development only)
DATABASE_URL=sqlite:///db.sqlite3
```

### 4. Set KRA Environment
```bash
# For testing
KRA_ENVIRONMENT=sandbox

# For production
KRA_ENVIRONMENT=production
```

## Production Checklist

- [ ] Set `DEBUG=False`
- [ ] Configure proper `SECRET_KEY`
- [ ] Set production `ALLOWED_HOSTS`
- [ ] Use PostgreSQL database
- [ ] Set `KRA_ENVIRONMENT=production`
- [ ] Configure Redis for Celery
- [ ] Set up proper logging
- [ ] Configure HTTPS/SSL
- [ ] Set secure `ENCRYPTION_KEY`

## Key Features Controlled by Settings

### KRA Integration
- **KRA_ENVIRONMENT**: Switches between sandbox and production KRA endpoints
- **KRA_TIMEOUT**: HTTP timeout for KRA API calls
- **ENCRYPTION_KEY**: Encrypts sensitive data like CMC keys

### API Security
- **REST_FRAMEWORK**: Token authentication enabled by default
- **CORS_ALLOWED_ORIGINS**: Controls frontend access
- **ALLOWED_HOSTS**: Django security setting

### Background Processing
- **CELERY_***: Redis-based task queue for retry logic
- **Async sales transaction processing**
- **Exponential backoff for failed requests**

### Logging
- **Console and file logging configured**
- **Separate logger for KRA OSCU operations**
- **Request/response logging for audit trail**

## Environment-Specific Configurations

### Development
```bash
DEBUG=True
KRA_ENVIRONMENT=sandbox
DATABASE_URL=sqlite:///db.sqlite3
CELERY_BROKER_URL=redis://localhost:6379/0
```

### Production
```bash
DEBUG=False
KRA_ENVIRONMENT=production
DATABASE_URL=postgresql://user:pass@prod-db:5432/etims
CELERY_BROKER_URL=redis://prod-redis:6379/0
ALLOWED_HOSTS=api.yourcompany.com
```

## Troubleshooting

### Common Issues
1. **KRA Connection Errors**: Check `KRA_ENVIRONMENT` and network connectivity
2. **Database Errors**: Verify `DATABASE_URL` format and credentials
3. **Celery Issues**: Ensure Redis is running and `CELERY_BROKER_URL` is correct
4. **Encryption Errors**: Verify `ENCRYPTION_KEY` is properly set

### Debug Settings
```bash
# Enable verbose logging
LOG_LEVEL=DEBUG

# Use SQLite for quick testing
DATABASE_URL=sqlite:///test.db

# Disable HTTPS redirects in development
SECURE_SSL_REDIRECT=False
```

# Sandbox vs Production Environment Guide

## Overview
The Revpay Connect system operates in two distinct environments: **Sandbox** (testing) and **Production** (live). Understanding the differences between these environments is crucial for proper system operation, testing, and compliance with KRA eTIMS requirements.

## Environment Configuration

### Sandbox Environment (Default)
- **Purpose**: Testing, development, and training
- **KRA Integration**: Connects to KRA's test eTIMS system
- **Data**: Simulated data, no real tax implications
- **Transactions**: Test transactions only, no actual money flow
- **Default Setting**: All new companies start in sandbox mode
- **Access**: Available to all registered companies

### Production Environment
- **Purpose**: Live business operations and tax compliance
- **KRA Integration**: Connects to KRA's live eTIMS system
- **Data**: Real business data with legal implications
- **Transactions**: Actual invoice processing and tax reporting
- **Access Control**: Requires admin approval and verification
- **Compliance**: Full KRA compliance requirements apply

## Key Differences

### 1. Data Integrity and Legal Status

#### Sandbox Environment
- **Test Data**: All invoices, customers, and transactions are for testing purposes only
- **No Legal Value**: Generated invoices have no legal or tax implications
- **Sample Data**: Pre-populated with sample customers, products, and tax codes
- **Data Reset**: Test data can be reset or cleared without consequences
- **Mock Responses**: KRA API responses are simulated and may not reflect real-world scenarios

#### Production Environment
- **Real Data**: All data represents actual business transactions
- **Legal Compliance**: Generated invoices are legally binding tax documents
- **Audit Trail**: Complete audit trail required for KRA compliance
- **Data Persistence**: All data must be preserved for legal and audit purposes
- **Real KRA Integration**: Direct integration with KRA's live systems

### 2. Invoice Processing

#### Sandbox Environment
```json
{
  "environment": "sandbox",
  "invoice_status": "test_approved",
  "kra_response": "simulated",
  "qr_code": "test_qr_code_12345",
  "receipt_number": "TEST-RCT-001",
  "tax_implications": "none"
}
```

#### Production Environment
```json
{
  "environment": "production",
  "invoice_status": "approved",
  "kra_response": "live_system",
  "qr_code": "live_qr_code_67890",
  "receipt_number": "KRA-RCT-001",
  "tax_implications": "full_compliance_required"
}
```

### 3. System Behavior Differences

#### API Response Times
- **Sandbox**: Faster response times (simulated processing)
- **Production**: Variable response times (depends on KRA system load)

#### Error Handling
- **Sandbox**: Predictable error scenarios for testing
- **Production**: Real-world errors that require immediate attention

#### Data Validation
- **Sandbox**: Relaxed validation for testing flexibility
- **Production**: Strict validation according to KRA requirements

### 4. Device Certification

#### Sandbox Environment
- **Certificate Type**: Test certificates for development
- **Validation**: Basic validation without KRA verification
- **Renewal**: Simplified renewal process
- **CMC Keys**: Test keys with extended validity
- **Device Registration**: Simulated registration process

#### Production Environment
- **Certificate Type**: Official KRA-issued certificates
- **Validation**: Full KRA validation and verification required
- **Renewal**: Official renewal process through KRA
- **CMC Keys**: Production keys with standard validity periods
- **Device Registration**: Official registration with KRA systems

## Mobile App Impact

### Dashboard Differences

#### Sandbox Mode Indicators
```typescript
// Dashboard shows sandbox indicators
{
  environment: "sandbox",
  environmentBadge: "🧪 TEST MODE",
  dataDisclaimer: "Test data only - no real tax implications",
  invoiceCount: "Sample invoices for testing",
  revenueDisplay: "Simulated revenue figures"
}
```

#### Production Mode Indicators
```typescript
// Dashboard shows production indicators
{
  environment: "production",
  environmentBadge: "🔴 LIVE MODE",
  dataDisclaimer: "Live data - full tax compliance active",
  invoiceCount: "Real invoice count",
  revenueDisplay: "Actual revenue figures"
}
```

### Feature Availability

#### Sandbox Features
- ✅ All invoice creation and management features
- ✅ Device management and monitoring
- ✅ Reports and analytics (test data)
- ✅ System administration tools
- ✅ Data export and import
- ✅ API testing and debugging tools
- ⚠️ Limited to test scenarios

#### Production Features
- ✅ Full invoice processing with legal validity
- ✅ Real-time KRA integration
- ✅ Official tax reporting
- ✅ Compliance monitoring and alerts
- ✅ Audit trail maintenance
- ✅ Official receipt generation
- ❌ No data reset or testing tools

### User Interface Differences

#### Visual Indicators
- **Sandbox**: Orange/yellow color scheme with test badges
- **Production**: Red/green color scheme with live indicators
- **Warnings**: Prominent warnings about environment status
- **Data Labels**: Clear labeling of test vs. real data

#### Functionality Restrictions
- **Sandbox**: Full feature access for testing
- **Production**: Restricted access to critical operations
- **Admin Controls**: Enhanced controls in production mode
- **Audit Logging**: Comprehensive logging in production

## Environment Switching

### Prerequisites for Production Switch
1. **Company Verification**: Complete KRA registration verification
2. **Device Certification**: All devices must have valid production certificates
3. **Admin Approval**: System administrator approval required
4. **Compliance Check**: Full compliance verification
5. **Data Migration**: Proper data migration from sandbox (if applicable)

### Switching Process

#### From Sandbox to Production
```typescript
// API call to switch environment
const switchToProduction = async () => {
  const response = await apiService.switchEnvironment('production');
  if (response.success) {
    // Environment switched successfully
    // App will restart in production mode
    // All subsequent API calls will use production endpoints
  }
};
```

#### From Production to Sandbox (Restricted)
- **Admin Only**: Only system administrators can switch back
- **Data Backup**: Complete data backup required
- **Compliance Impact**: May affect compliance status
- **Approval Process**: Requires special approval and justification

### Environment Status Checking
```typescript
// Check current environment status
const checkEnvironment = async () => {
  const status = await apiService.getEnvironmentStatus();
  return {
    current_environment: status.environment, // 'sandbox' or 'production'
    can_switch: status.can_switch,
    switch_requirements: status.requirements,
    last_switched: status.last_switched,
    approval_status: status.approval_status
  };
};
```

## Data Migration Considerations

### Sandbox to Production Migration
- **Customer Data**: Verify and clean customer information
- **Product Catalog**: Ensure all products comply with KRA requirements
- **Tax Configurations**: Validate all tax settings
- **Historical Data**: Decide what test data to preserve or discard
- **User Accounts**: Verify user permissions and roles

### Data Isolation
- **Separate Databases**: Sandbox and production use completely separate databases
- **No Cross-Contamination**: No data sharing between environments
- **Independent Backups**: Separate backup strategies for each environment
- **Isolated Processing**: Completely separate processing pipelines

## Compliance and Legal Implications

### Sandbox Environment
- **No Tax Liability**: No actual tax obligations created
- **Testing Freedom**: Free to test various scenarios
- **Data Privacy**: Test data has no privacy implications
- **Audit Requirements**: No formal audit trail required
- **Reporting**: No official reporting to KRA

### Production Environment
- **Full Tax Liability**: All transactions create actual tax obligations
- **KRA Compliance**: Must comply with all KRA regulations
- **Data Protection**: Full data protection laws apply
- **Audit Trail**: Complete audit trail required by law
- **Official Reporting**: All transactions reported to KRA in real-time

## Best Practices

### Development and Testing
1. **Always Start in Sandbox**: Begin all development and testing in sandbox mode
2. **Comprehensive Testing**: Test all scenarios thoroughly before production
3. **Data Validation**: Validate all data formats and requirements
4. **Error Handling**: Test error scenarios and recovery procedures
5. **Performance Testing**: Test system performance under load

### Production Deployment
1. **Gradual Rollout**: Switch to production gradually, not all at once
2. **Monitoring**: Implement comprehensive monitoring and alerting
3. **Backup Strategy**: Ensure robust backup and recovery procedures
4. **Compliance Monitoring**: Continuously monitor compliance status
5. **User Training**: Ensure all users understand production implications

### Environment Management
1. **Clear Documentation**: Maintain clear documentation of environment differences
2. **Access Control**: Implement strict access controls for production
3. **Change Management**: Follow formal change management procedures
4. **Regular Audits**: Conduct regular audits of both environments
5. **Disaster Recovery**: Maintain disaster recovery plans for production

## Troubleshooting Common Issues

### Environment Confusion
- **Symptom**: Users unsure which environment they're using
- **Solution**: Prominent environment indicators in UI
- **Prevention**: Clear onboarding and training

### Data Mixing
- **Symptom**: Test data appearing in production reports
- **Solution**: Complete data isolation and validation
- **Prevention**: Strict environment separation

### Compliance Issues
- **Symptom**: Production transactions not properly reported to KRA
- **Solution**: Immediate compliance audit and correction
- **Prevention**: Automated compliance monitoring

### Performance Differences
- **Symptom**: Significant performance differences between environments
- **Solution**: Environment-specific optimization
- **Prevention**: Regular performance testing in both environments

## Summary

Understanding the differences between sandbox and production environments is crucial for:
- **Proper Testing**: Ensuring thorough testing before going live
- **Compliance**: Maintaining KRA compliance in production
- **Data Integrity**: Protecting real business data
- **User Experience**: Providing clear environment indicators
- **Risk Management**: Minimizing risks during environment transitions

The sandbox environment provides a safe space for testing and development, while the production environment ensures full compliance with KRA requirements and legal obligations. Proper management of both environments is essential for successful eTIMS integration.

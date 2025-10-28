import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  TextInput,
  TouchableOpacity,
  Picker,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { colors, spacing, typography } from '@/theme/theme';
import { apiService } from '@/services/api';

type CompanyOnboardingScreenNavigationProp = StackNavigationProp<any, 'CompanyOnboarding'>;

const CompanyOnboardingScreen: React.FC = () => {
  const navigation = useNavigation<CompanyOnboardingScreenNavigationProp>();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Company Information
  const [companyData, setCompanyData] = useState({
    company_name: '',
    tin: '',
    contact_person: '',
    contact_email: '',
    contact_phone: '',
    business_address: '',
    business_type: '',
    subscription_plan: 'basic',
  });

  // Device Information
  const [deviceData, setDeviceData] = useState({
    device_type: 'oscu', // oscu or vscu
    integration_type: 'pos',
    device_name: '',
    bhf_id: '',
    serial_number: '',
    pos_version: '1.0.0',
    virtual_device_id: '',
    api_endpoint: '',
    webhook_url: '',
  });

  const updateCompanyData = (field: string, value: string) => {
    setCompanyData(prev => ({ ...prev, [field]: value }));
  };

  const updateDeviceData = (field: string, value: string) => {
    setDeviceData(prev => ({ ...prev, [field]: value }));
  };

  const validateStep1 = () => {
    const { company_name, tin, contact_person, contact_email, contact_phone, business_address } = companyData;
    
    if (!company_name || !tin || !contact_person || !contact_email || !contact_phone || !business_address) {
      Alert.alert('Error', 'Please fill in all required company fields');
      return false;
    }

    if (tin.length !== 11 || !/^\d{11}$/.test(tin)) {
      Alert.alert('Error', 'TIN must be exactly 11 digits');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contact_email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return false;
    }

    return true;
  };

  const validateStep2 = () => {
    const { device_name, bhf_id, serial_number } = deviceData;
    
    if (!device_name || !bhf_id || !serial_number) {
      Alert.alert('Error', 'Please fill in all required device fields');
      return false;
    }

    if (bhf_id.length !== 3 || !/^\d{3}$/.test(bhf_id)) {
      Alert.alert('Error', 'Branch ID must be exactly 3 digits');
      return false;
    }

    if (deviceData.device_type === 'vscu' && !deviceData.virtual_device_id) {
      Alert.alert('Error', 'Virtual Device ID is required for VSCU devices');
      return false;
    }

    return true;
  };

  const handleNextStep = () => {
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2);
    } else if (currentStep === 2 && validateStep2()) {
      setCurrentStep(3);
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmitOnboarding = async () => {
    if (!validateStep1() || !validateStep2()) return;

    setLoading(true);
    try {
      const onboardingPayload = {
        ...companyData,
        ...deviceData,
      };

      const response = await apiService.onboardClient(onboardingPayload);
      
      if (response.success) {
        Alert.alert(
          'Success', 
          'Company onboarded successfully! Device registration initiated.',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('CompanyManagement')
            }
          ]
        );
      } else {
        Alert.alert('Error', response.message || 'Failed to onboard company');
      }
    } catch (error) {
      console.error('Onboarding error:', error);
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Company Information</Text>
      
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Company Name *</Text>
        <TextInput
          value={companyData.company_name}
          onChangeText={(value) => updateCompanyData('company_name', value)}
          style={styles.textInput}
          placeholder="Enter company name"
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>TIN (11 digits) *</Text>
        <TextInput
          value={companyData.tin}
          onChangeText={(value) => updateCompanyData('tin', value)}
          style={styles.textInput}
          placeholder="Enter 11-digit TIN"
          keyboardType="numeric"
          maxLength={11}
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Contact Person *</Text>
        <TextInput
          value={companyData.contact_person}
          onChangeText={(value) => updateCompanyData('contact_person', value)}
          style={styles.textInput}
          placeholder="Enter contact person name"
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Contact Email *</Text>
        <TextInput
          value={companyData.contact_email}
          onChangeText={(value) => updateCompanyData('contact_email', value)}
          style={styles.textInput}
          placeholder="Enter contact email"
          keyboardType="email-address"
          autoCapitalize="none"
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Contact Phone *</Text>
        <TextInput
          value={companyData.contact_phone}
          onChangeText={(value) => updateCompanyData('contact_phone', value)}
          style={styles.textInput}
          placeholder="Enter contact phone"
          keyboardType="phone-pad"
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Business Address *</Text>
        <TextInput
          value={companyData.business_address}
          onChangeText={(value) => updateCompanyData('business_address', value)}
          style={styles.multilineInput}
          placeholder="Enter business address"
          multiline
          numberOfLines={3}
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Business Type</Text>
        <TextInput
          value={companyData.business_type}
          onChangeText={(value) => updateCompanyData('business_type', value)}
          style={styles.textInput}
          placeholder="Enter business type (optional)"
          placeholderTextColor={colors.textSecondary}
        />
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Device Configuration</Text>
      
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Device Type *</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={deviceData.device_type}
            onValueChange={(value) => updateDeviceData('device_type', value)}
            style={styles.picker}
          >
            <Picker.Item label="OSCU (Online Sales Control Unit)" value="oscu" />
            <Picker.Item label="VSCU (Virtual Sales Control Unit)" value="vscu" />
          </Picker>
        </View>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Integration Type *</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={deviceData.integration_type}
            onValueChange={(value) => updateDeviceData('integration_type', value)}
            style={styles.picker}
          >
            <Picker.Item label="POS System" value="pos" />
            <Picker.Item label="API Integration" value="api" />
            <Picker.Item label="ERP System" value="erp" />
            <Picker.Item label="Custom Integration" value="custom" />
          </Picker>
        </View>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Device Name *</Text>
        <TextInput
          value={deviceData.device_name}
          onChangeText={(value) => updateDeviceData('device_name', value)}
          style={styles.textInput}
          placeholder="Enter device name"
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Branch ID (3 digits) *</Text>
        <TextInput
          value={deviceData.bhf_id}
          onChangeText={(value) => updateDeviceData('bhf_id', value)}
          style={styles.textInput}
          placeholder="Enter 3-digit branch ID"
          keyboardType="numeric"
          maxLength={3}
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Serial Number *</Text>
        <TextInput
          value={deviceData.serial_number}
          onChangeText={(value) => updateDeviceData('serial_number', value)}
          style={styles.textInput}
          placeholder="Enter device serial number"
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>POS Version</Text>
        <TextInput
          value={deviceData.pos_version}
          onChangeText={(value) => updateDeviceData('pos_version', value)}
          style={styles.textInput}
          placeholder="Enter POS version"
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      {deviceData.device_type === 'vscu' && (
        <>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Virtual Device ID *</Text>
            <TextInput
              value={deviceData.virtual_device_id}
              onChangeText={(value) => updateDeviceData('virtual_device_id', value)}
              style={styles.textInput}
              placeholder="Enter virtual device ID"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>API Endpoint</Text>
            <TextInput
              value={deviceData.api_endpoint}
              onChangeText={(value) => updateDeviceData('api_endpoint', value)}
              style={styles.textInput}
              placeholder="Enter API endpoint URL"
              autoCapitalize="none"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Webhook URL</Text>
            <TextInput
              value={deviceData.webhook_url}
              onChangeText={(value) => updateDeviceData('webhook_url', value)}
              style={styles.textInput}
              placeholder="Enter webhook URL"
              autoCapitalize="none"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
        </>
      )}
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Review & Confirm</Text>
      
      <View style={styles.reviewSection}>
        <Text style={styles.reviewSectionTitle}>Company Information</Text>
        <Text style={styles.reviewItem}>Name: {companyData.company_name}</Text>
        <Text style={styles.reviewItem}>TIN: {companyData.tin}</Text>
        <Text style={styles.reviewItem}>Contact: {companyData.contact_person}</Text>
        <Text style={styles.reviewItem}>Email: {companyData.contact_email}</Text>
        <Text style={styles.reviewItem}>Phone: {companyData.contact_phone}</Text>
      </View>

      <View style={styles.reviewSection}>
        <Text style={styles.reviewSectionTitle}>Device Configuration</Text>
        <Text style={styles.reviewItem}>Type: {deviceData.device_type.toUpperCase()}</Text>
        <Text style={styles.reviewItem}>Integration: {deviceData.integration_type}</Text>
        <Text style={styles.reviewItem}>Name: {deviceData.device_name}</Text>
        <Text style={styles.reviewItem}>Branch ID: {deviceData.bhf_id}</Text>
        <Text style={styles.reviewItem}>Serial: {deviceData.serial_number}</Text>
        {deviceData.device_type === 'vscu' && (
          <Text style={styles.reviewItem}>Virtual ID: {deviceData.virtual_device_id}</Text>
        )}
      </View>

      <View style={styles.warningContainer}>
        <Text style={styles.warningText}>
          ⚠️ Please review all information carefully. Once submitted, the company will be registered 
          and device initialization will begin with KRA eTIMS system.
        </Text>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Company Onboarding</Text>
        <Text style={styles.subtitle}>Step {currentStep} of 3</Text>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressStep, currentStep >= 1 && styles.progressStepActive]} />
        <View style={[styles.progressStep, currentStep >= 2 && styles.progressStepActive]} />
        <View style={[styles.progressStep, currentStep >= 3 && styles.progressStepActive]} />
      </View>

      <ScrollView style={styles.scrollContainer}>
        <View style={styles.card}>
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
        </View>
      </ScrollView>

      <View style={styles.buttonContainer}>
        {currentStep > 1 && (
          <TouchableOpacity
            onPress={handlePreviousStep}
            style={[styles.button, styles.secondaryButton]}
          >
            <Text style={styles.secondaryButtonText}>Previous</Text>
          </TouchableOpacity>
        )}

        {currentStep < 3 ? (
          <TouchableOpacity
            onPress={handleNextStep}
            style={[styles.button, styles.primaryButton]}
          >
            <Text style={styles.primaryButtonText}>Next</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleSubmitOnboarding}
            disabled={loading}
            style={[styles.button, styles.primaryButton, loading && styles.disabledButton]}
          >
            <Text style={styles.primaryButtonText}>
              {loading ? 'Submitting...' : 'Complete Onboarding'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    alignItems: 'center',
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  progressBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  progressStep: {
    flex: 1,
    height: 4,
    backgroundColor: colors.border,
    marginHorizontal: spacing.xs,
    borderRadius: 2,
  },
  progressStepActive: {
    backgroundColor: colors.primary,
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.lg,
    elevation: 4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  stepContainer: {
    minHeight: 400,
  },
  stepTitle: {
    ...typography.h3,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.xs,
    color: colors.text,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: 16,
  },
  multilineInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  picker: {
    color: colors.text,
  },
  reviewSection: {
    marginBottom: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: 8,
  },
  reviewSectionTitle: {
    ...typography.h4,
    marginBottom: spacing.sm,
    color: colors.primary,
  },
  reviewItem: {
    ...typography.body,
    marginBottom: spacing.xs,
    color: colors.text,
  },
  warningContainer: {
    padding: spacing.md,
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFEAA7',
  },
  warningText: {
    ...typography.caption,
    color: '#856404',
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.md,
  },
  button: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  secondaryButton: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  primaryButtonText: {
    color: colors.secondary,
    fontWeight: 'bold',
    fontSize: 16,
  },
  secondaryButtonText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 16,
  },
  disabledButton: {
    opacity: 0.6,
  },
});

export default CompanyOnboardingScreen;

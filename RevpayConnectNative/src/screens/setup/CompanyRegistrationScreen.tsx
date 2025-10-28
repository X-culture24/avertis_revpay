import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { colors, spacing, typography } from '@/theme/theme';
import { apiService } from '@/services/api';

type CompanyRegistrationScreenNavigationProp = StackNavigationProp<any, 'CompanyRegistration'>;

const CompanyRegistrationScreen: React.FC = () => {
  const navigation = useNavigation<CompanyRegistrationScreenNavigationProp>();
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    company_name: '',
    tin: '',
    contact_person: '',
    contact_email: '',
    contact_phone: '',
    address: '',
    city: '',
    postal_code: '',
    business_type: '',
  });

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    const { company_name, tin, contact_person, contact_email, contact_phone } = formData;
    
    if (!company_name || !tin || !contact_person || !contact_email || !contact_phone) {
      Alert.alert('Error', 'Please fill in all required fields');
      return false;
    }

    if (tin.length !== 11 || !/^\d+$/.test(tin)) {
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

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const response = await apiService.registerCompany(formData);
      
      if (response.success) {
        Alert.alert(
          'Success', 
          'Company registration submitted to KRA. You will receive confirmation once approved.',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ]
        );
      } else {
        Alert.alert('Error', response.message || 'Failed to register company');
      }
    } catch (error) {
      console.error('Company registration error:', error);
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Company Registration</Text>
          <Text style={styles.subtitle}>Register your company with KRA eTIMS system</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Company Information</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Company Name *</Text>
            <TextInput
              value={formData.company_name}
              onChangeText={(value) => updateFormData('company_name', value)}
              style={styles.textInput}
              placeholder="Enter company name"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>TIN Number *</Text>
            <TextInput
              value={formData.tin}
              onChangeText={(value) => updateFormData('tin', value)}
              style={styles.textInput}
              placeholder="Enter 11-digit TIN"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
              maxLength={11}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Business Type</Text>
            <TextInput
              value={formData.business_type}
              onChangeText={(value) => updateFormData('business_type', value)}
              style={styles.textInput}
              placeholder="e.g., Retail, Manufacturing, Services"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Contact Person *</Text>
            <TextInput
              value={formData.contact_person}
              onChangeText={(value) => updateFormData('contact_person', value)}
              style={styles.textInput}
              placeholder="Full name of contact person"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Email Address *</Text>
            <TextInput
              value={formData.contact_email}
              onChangeText={(value) => updateFormData('contact_email', value)}
              style={styles.textInput}
              placeholder="contact@company.com"
              placeholderTextColor={colors.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Phone Number *</Text>
            <TextInput
              value={formData.contact_phone}
              onChangeText={(value) => updateFormData('contact_phone', value)}
              style={styles.textInput}
              placeholder="+254 XXX XXX XXX"
              placeholderTextColor={colors.textSecondary}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Address Information</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Physical Address</Text>
            <TextInput
              value={formData.address}
              onChangeText={(value) => updateFormData('address', value)}
              style={styles.textInput}
              placeholder="Street address"
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={2}
            />
          </View>

          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Text style={styles.inputLabel}>City</Text>
              <TextInput
                value={formData.city}
                onChangeText={(value) => updateFormData('city', value)}
                style={styles.textInput}
                placeholder="City"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={styles.halfInput}>
              <Text style={styles.inputLabel}>Postal Code</Text>
              <TextInput
                value={formData.postal_code}
                onChangeText={(value) => updateFormData('postal_code', value)}
                style={styles.textInput}
                placeholder="00100"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>📋 What happens next?</Text>
          <Text style={styles.infoText}>
            1. Your registration will be submitted to KRA eTIMS system{'\n'}
            2. KRA will review and approve your company registration{'\n'}
            3. You'll receive confirmation and can proceed with device setup{'\n'}
            4. The process typically takes 1-3 business days
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={loading}
          style={[styles.submitButton, loading && styles.disabledButton]}
        >
          <Text style={styles.submitButtonText}>
            {loading ? 'Submitting...' : 'Register Company'}
          </Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    marginBottom: spacing.xs,
    color: colors.primary,
  },
  subtitle: {
    ...typography.caption,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  card: {
    backgroundColor: colors.card,
    margin: spacing.md,
    borderRadius: 16,
    padding: spacing.lg,
    elevation: 4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
    color: colors.primary,
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfInput: {
    width: '48%',
  },
  infoCard: {
    backgroundColor: '#E3F2FD',
    margin: spacing.md,
    borderRadius: 12,
    padding: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  infoTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  infoText: {
    ...typography.caption,
    color: colors.text,
    lineHeight: 20,
  },
  submitButton: {
    margin: spacing.md,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 12,
    elevation: 2,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  submitButtonText: {
    color: colors.secondary,
    fontWeight: 'bold',
    fontSize: 16,
  },
  disabledButton: {
    opacity: 0.6,
  },
  bottomSpacing: {
    height: spacing.xl,
  },
});

export default CompanyRegistrationScreen;

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

type DeviceSetupScreenNavigationProp = StackNavigationProp<any, 'DeviceSetup'>;

const DeviceSetupScreen: React.FC = () => {
  const navigation = useNavigation<DeviceSetupScreenNavigationProp>();
  
  const [loading, setLoading] = useState(false);
  const [selectedDeviceType, setSelectedDeviceType] = useState<'oscu' | 'vscu' | null>(null);
  const [formData, setFormData] = useState({
    device_name: '',
    bhf_id: '',
    serial_number: '',
    location: '',
  });

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    const { device_name, bhf_id, serial_number } = formData;
    
    if (!selectedDeviceType) {
      Alert.alert('Error', 'Please select a device type');
      return false;
    }

    if (!device_name || !bhf_id || !serial_number) {
      Alert.alert('Error', 'Please fill in all required fields');
      return false;
    }

    if (bhf_id.length !== 3 || !/^\d+$/.test(bhf_id)) {
      Alert.alert('Error', 'Branch ID must be exactly 3 digits');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const deviceData = {
        ...formData,
        device_type: selectedDeviceType,
      };

      const response = await apiService.setupDevice(deviceData);
      
      if (response.success) {
        Alert.alert(
          'Success', 
          'Device setup submitted to KRA. Your device will be initialized and certified automatically.',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ]
        );
      } else {
        Alert.alert('Error', response.message || 'Failed to setup device');
      }
    } catch (error) {
      console.error('Device setup error:', error);
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const DeviceTypeCard = ({ 
    type, 
    title, 
    description, 
    features 
  }: { 
    type: 'oscu' | 'vscu', 
    title: string, 
    description: string, 
    features: string[] 
  }) => (
    <TouchableOpacity
      style={[
        styles.deviceTypeCard,
        selectedDeviceType === type && styles.selectedDeviceType
      ]}
      onPress={() => setSelectedDeviceType(type)}
    >
      <View style={styles.deviceTypeHeader}>
        <Text style={styles.deviceTypeTitle}>{title}</Text>
        {selectedDeviceType === type && (
          <Text style={styles.selectedIndicator}>✓</Text>
        )}
      </View>
      <Text style={styles.deviceTypeDescription}>{description}</Text>
      <View style={styles.featuresList}>
        {features.map((feature, index) => (
          <Text key={index} style={styles.featureItem}>• {feature}</Text>
        ))}
      </View>
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Device Setup</Text>
          <Text style={styles.subtitle}>Configure your KRA eTIMS device</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Select Device Type</Text>
          
          <DeviceTypeCard
            type="oscu"
            title="OSCU (Online Sales Control Unit)"
            description="Direct online connection to KRA servers"
            features={[
              "Real-time invoice submission",
              "Immediate KRA validation",
              "Requires stable internet",
              "Best for high-volume businesses"
            ]}
          />

          <DeviceTypeCard
            type="vscu"
            title="VSCU (Virtual Sales Control Unit)"
            description="Offline-capable with periodic sync"
            features={[
              "Works offline",
              "Periodic sync to KRA",
              "Good for remote locations",
              "Automatic retry on connection"
            ]}
          />
        </View>

        {selectedDeviceType && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Device Information</Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Device Name *</Text>
              <TextInput
                value={formData.device_name}
                onChangeText={(value) => updateFormData('device_name', value)}
                style={styles.textInput}
                placeholder="e.g., Main Counter Device"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Branch ID (BHF ID) *</Text>
              <TextInput
                value={formData.bhf_id}
                onChangeText={(value) => updateFormData('bhf_id', value)}
                style={styles.textInput}
                placeholder="000"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                maxLength={3}
              />
              <Text style={styles.inputHint}>3-digit branch identifier from KRA</Text>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Serial Number *</Text>
              <TextInput
                value={formData.serial_number}
                onChangeText={(value) => updateFormData('serial_number', value)}
                style={styles.textInput}
                placeholder="Device serial number"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Location</Text>
              <TextInput
                value={formData.location}
                onChangeText={(value) => updateFormData('location', value)}
                style={styles.textInput}
                placeholder="Physical location of device"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          </View>
        )}

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>🔧 Setup Process</Text>
          <Text style={styles.infoText}>
            1. Select your device type (OSCU or VSCU){'\n'}
            2. Provide device information{'\n'}
            3. KRA will initialize your device automatically{'\n'}
            4. Device certificates will be generated{'\n'}
            5. You'll receive confirmation when ready to use
          </Text>
        </View>

        {selectedDeviceType && (
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading}
            style={[styles.submitButton, loading && styles.disabledButton]}
          >
            <Text style={styles.submitButtonText}>
              {loading ? 'Setting up...' : 'Setup Device'}
            </Text>
          </TouchableOpacity>
        )}

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
  deviceTypeCard: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  selectedDeviceType: {
    borderColor: colors.primary,
    backgroundColor: '#E3F2FD',
  },
  deviceTypeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  deviceTypeTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  selectedIndicator: {
    ...typography.h3,
    color: colors.primary,
  },
  deviceTypeDescription: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  featuresList: {
    marginTop: spacing.sm,
  },
  featureItem: {
    ...typography.caption,
    color: colors.text,
    marginBottom: spacing.xs / 2,
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
  inputHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs / 2,
  },
  infoCard: {
    backgroundColor: '#E8F5E8',
    margin: spacing.md,
    borderRadius: 12,
    padding: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  infoTitle: {
    ...typography.body,
    fontWeight: '600',
    color: '#2E7D32',
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

export default DeviceSetupScreen;

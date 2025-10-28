import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput,
  TouchableOpacity,
  Picker,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { colors, spacing, typography } from '@/theme/theme';
import { apiService } from '@/services/api';

type DeviceRegistrationScreenNavigationProp = StackNavigationProp<any, 'DeviceRegistration'>;

interface RouteParams {
  companyId?: string;
  editDeviceId?: string;
}

const DeviceRegistrationScreen: React.FC = () => {
  const navigation = useNavigation<DeviceRegistrationScreenNavigationProp>();
  const route = useRoute();
  const { companyId, editDeviceId } = (route.params as RouteParams) || {};
  
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompany, setSelectedCompany] = useState(companyId || '');
  
  const [deviceData, setDeviceData] = useState({
    device_type: 'oscu',
    integration_type: 'pos',
    device_name: '',
    bhf_id: '',
    serial_number: '',
    pos_version: '1.0.0',
    virtual_device_id: '',
    api_endpoint: '',
    webhook_url: '',
    client_system_info: '',
  });

  useEffect(() => {
    fetchCompanies();
    if (editDeviceId) {
      fetchDeviceDetails();
    }
  }, []);

  const fetchCompanies = async () => {
    try {
      const response = await apiService.getCompanies();
      if (response.success && response.data) {
        setCompanies(response.data);
      }
    } catch (error) {
      console.error('Error fetching companies:', error);
    }
  };

  const fetchDeviceDetails = async () => {
    if (!editDeviceId) return;
    
    try {
      setLoading(true);
      // Assuming we have a getDeviceDetails endpoint
      const response = await apiService.getDevices();
      if (response.success && response.data) {
        const device = response.data.find((d: any) => d.id === editDeviceId);
        if (device) {
          setDeviceData({
            device_type: device.device_type || 'oscu',
            integration_type: device.integration_type || 'pos',
            device_name: device.device_name || '',
            bhf_id: device.bhf_id || '',
            serial_number: device.serial_number || '',
            pos_version: device.pos_version || '1.0.0',
            virtual_device_id: device.virtual_device_id || '',
            api_endpoint: device.api_endpoint || '',
            webhook_url: device.webhook_url || '',
            client_system_info: JSON.stringify(device.client_system_info || {}),
          });
          setSelectedCompany(device.company);
        }
      }
    } catch (error) {
      console.error('Error fetching device details:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateDeviceData = (field: string, value: string) => {
    setDeviceData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    const { device_name, bhf_id, serial_number } = deviceData;
    
    if (!selectedCompany) {
      Alert.alert('Error', 'Please select a company');
      return false;
    }

    if (!device_name || !bhf_id || !serial_number) {
      Alert.alert('Error', 'Please fill in all required fields');
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

  const handleRegisterDevice = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      let clientSystemInfo = {};
      try {
        clientSystemInfo = deviceData.client_system_info ? 
          JSON.parse(deviceData.client_system_info) : {};
      } catch (e) {
        clientSystemInfo = { notes: deviceData.client_system_info };
      }

      const payload = {
        ...deviceData,
        company_id: selectedCompany,
        client_system_info: clientSystemInfo,
      };

      const response = editDeviceId 
        ? await apiService.updateDevice(editDeviceId, payload)
        : await apiService.registerAdditionalDevice(selectedCompany, payload);
      
      if (response.success) {
        Alert.alert(
          'Success', 
          editDeviceId ? 'Device updated successfully!' : 'Device registered successfully!',
          [
            {
              text: 'Initialize Device',
              onPress: () => handleInitializeDevice(response.data?.id || editDeviceId)
            },
            {
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ]
        );
      } else {
        Alert.alert('Error', response.message || 'Failed to register device');
      }
    } catch (error) {
      console.error('Device registration error:', error);
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInitializeDevice = async (deviceId: string) => {
    setInitializing(true);
    try {
      const initPayload = {
        device_id: deviceId,
        company_id: selectedCompany,
        tin: companies.find(c => c.id === selectedCompany)?.tin,
        bhf_id: deviceData.bhf_id,
        serial_number: deviceData.serial_number,
        device_name: deviceData.device_name,
        pos_version: deviceData.pos_version,
      };

      const response = await apiService.initializeDevice(initPayload);
      
      if (response.success) {
        Alert.alert(
          'Device Initialized', 
          'Device has been successfully initialized with KRA eTIMS system. CMC key received.',
          [
            {
              text: 'View Certification',
              onPress: () => navigation.navigate('DeviceCertification', { deviceId })
            },
            {
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ]
        );
      } else {
        Alert.alert('Initialization Failed', response.message || 'Failed to initialize device with KRA');
      }
    } catch (error) {
      console.error('Device initialization error:', error);
      Alert.alert('Error', 'Failed to initialize device. Please try again.');
    } finally {
      setInitializing(false);
    }
  };

  if (loading && editDeviceId) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading device details...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {editDeviceId ? 'Edit Device' : 'Register New Device'}
        </Text>
        <Text style={styles.subtitle}>
          {editDeviceId ? 'Update device configuration' : 'Add a new device to company'}
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Company Selection</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Select Company *</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedCompany}
                onValueChange={setSelectedCompany}
                style={styles.picker}
                enabled={!companyId} // Disable if company is pre-selected
              >
                <Picker.Item label="Select a company..." value="" />
                {companies.map((company) => (
                  <Picker.Item 
                    key={company.id} 
                    label={`${company.company_name} (${company.tin})`} 
                    value={company.id} 
                  />
                ))}
              </Picker>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Device Configuration</Text>
          
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
        </View>

        {deviceData.device_type === 'vscu' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>VSCU Configuration</Text>
            
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
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Information</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Client System Info</Text>
            <TextInput
              value={deviceData.client_system_info}
              onChangeText={(value) => updateDeviceData('client_system_info', value)}
              style={styles.multilineInput}
              placeholder="Enter client system information (JSON or text)"
              multiline
              numberOfLines={4}
              placeholderTextColor={colors.textSecondary}
            />
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.button, styles.secondaryButton]}
          >
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleRegisterDevice}
            disabled={loading || initializing}
            style={[styles.button, styles.primaryButton, (loading || initializing) && styles.disabledButton]}
          >
            <Text style={styles.primaryButtonText}>
              {loading ? 'Saving...' : editDeviceId ? 'Update Device' : 'Register Device'}
            </Text>
          </TouchableOpacity>
        </View>

        {initializing && (
          <View style={styles.initializingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.initializingText}>Initializing device with KRA...</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    ...typography.body,
    marginTop: spacing.md,
    color: colors.textSecondary,
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
    textAlign: 'center',
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
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h4,
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
  multilineInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: 16,
    minHeight: 100,
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
  buttonContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
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
  initializingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: 8,
  },
  initializingText: {
    ...typography.caption,
    marginLeft: spacing.sm,
    color: colors.textSecondary,
  },
});

export default DeviceRegistrationScreen;

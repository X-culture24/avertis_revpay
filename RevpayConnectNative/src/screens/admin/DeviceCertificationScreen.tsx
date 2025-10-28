import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { colors, spacing, typography } from '@/theme/theme';
import { apiService } from '@/services/api';

type DeviceCertificationScreenNavigationProp = StackNavigationProp<any, 'DeviceCertification'>;

interface RouteParams {
  deviceId: string;
}

interface CertificationStatus {
  device_id: string;
  device_name: string;
  company_name: string;
  tin: string;
  bhf_id: string;
  serial_number: string;
  device_type: string;
  status: string;
  is_certified: boolean;
  certification_date: string | null;
  cmc_key: string | null;
  last_sync: string | null;
  kra_response: any;
  error_details: any;
}

const DeviceCertificationScreen: React.FC = () => {
  const navigation = useNavigation<DeviceCertificationScreenNavigationProp>();
  const route = useRoute();
  const { deviceId } = (route.params as RouteParams) || {};
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [certifying, setCertifying] = useState(false);
  const [regeneratingKeys, setRegeneratingKeys] = useState(false);
  const [certificationStatus, setCertificationStatus] = useState<CertificationStatus | null>(null);

  useEffect(() => {
    if (deviceId) {
      fetchCertificationStatus();
    }
  }, [deviceId]);

  const fetchCertificationStatus = async () => {
    try {
      const response = await apiService.getDeviceCertificationStatus(deviceId);
      if (response.success && response.data) {
        setCertificationStatus(response.data);
      } else {
        Alert.alert('Error', 'Failed to fetch certification status');
      }
    } catch (error) {
      console.error('Error fetching certification status:', error);
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCertificationStatus();
  };

  const handleCertifyDevice = async () => {
    setCertifying(true);
    try {
      const response = await apiService.certifyDevice(deviceId);
      
      if (response.success) {
        Alert.alert(
          'Certification Successful',
          'Device has been certified with KRA eTIMS system.',
          [{ text: 'OK', onPress: () => fetchCertificationStatus() }]
        );
      } else {
        Alert.alert(
          'Certification Failed',
          response.message || 'Failed to certify device with KRA'
        );
      }
    } catch (error) {
      console.error('Certification error:', error);
      Alert.alert('Error', 'Failed to certify device. Please try again.');
    } finally {
      setCertifying(false);
    }
  };

  const handleRegenerateKeys = async () => {
    Alert.alert(
      'Regenerate Keys',
      'This will generate new encryption keys for the device. The device will need to be re-certified. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: confirmRegenerateKeys }
      ]
    );
  };

  const confirmRegenerateKeys = async () => {
    setRegeneratingKeys(true);
    try {
      const response = await apiService.regenerateDeviceKeys(deviceId);
      
      if (response.success) {
        Alert.alert(
          'Keys Regenerated',
          'New encryption keys have been generated. Device needs to be re-certified.',
          [{ text: 'OK', onPress: () => fetchCertificationStatus() }]
        );
      } else {
        Alert.alert(
          'Key Regeneration Failed',
          response.message || 'Failed to regenerate device keys'
        );
      }
    } catch (error) {
      console.error('Key regeneration error:', error);
      Alert.alert('Error', 'Failed to regenerate keys. Please try again.');
    } finally {
      setRegeneratingKeys(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'certified': return '#34C759';
      case 'pending': return '#FF9500';
      case 'failed':
      case 'inactive': return '#FF3B30';
      default: return colors.textSecondary;
    }
  };

  const getStatusIcon = (status: string, isCertified: boolean) => {
    if (isCertified) return '✅';
    switch (status?.toLowerCase()) {
      case 'active': return '🟢';
      case 'pending': return '🟡';
      case 'failed': return '🔴';
      case 'inactive': return '⚫';
      default: return '⚪';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading certification status...</Text>
      </View>
    );
  }

  if (!certificationStatus) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load certification status</Text>
        <TouchableOpacity onPress={fetchCertificationStatus} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Device Certification</Text>
        <Text style={styles.subtitle}>KRA eTIMS Integration Status</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.statusHeader}>
          <Text style={styles.deviceName}>{certificationStatus.device_name}</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusIcon}>
              {getStatusIcon(certificationStatus.status, certificationStatus.is_certified)}
            </Text>
            <Text style={[styles.statusText, { color: getStatusColor(certificationStatus.status) }]}>
              {certificationStatus.is_certified ? 'Certified' : certificationStatus.status}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Device Information</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Company:</Text>
            <Text style={styles.infoValue}>{certificationStatus.company_name}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>TIN:</Text>
            <Text style={styles.infoValue}>{certificationStatus.tin}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Branch ID:</Text>
            <Text style={styles.infoValue}>{certificationStatus.bhf_id}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Serial Number:</Text>
            <Text style={styles.infoValue}>{certificationStatus.serial_number}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Device Type:</Text>
            <Text style={styles.infoValue}>{certificationStatus.device_type.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Certification Status</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status:</Text>
            <Text style={[styles.infoValue, { color: getStatusColor(certificationStatus.status) }]}>
              {certificationStatus.status}
            </Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Certified:</Text>
            <Text style={styles.infoValue}>
              {certificationStatus.is_certified ? 'Yes' : 'No'}
            </Text>
          </View>
          
          {certificationStatus.certification_date && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Certification Date:</Text>
              <Text style={styles.infoValue}>
                {new Date(certificationStatus.certification_date).toLocaleString()}
              </Text>
            </View>
          )}
          
          {certificationStatus.last_sync && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Last Sync:</Text>
              <Text style={styles.infoValue}>
                {new Date(certificationStatus.last_sync).toLocaleString()}
              </Text>
            </View>
          )}
        </View>

        {certificationStatus.cmc_key && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Security Information</Text>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>CMC Key:</Text>
              <Text style={styles.cmcKey}>
                {certificationStatus.cmc_key.substring(0, 20)}...
              </Text>
            </View>
            
            <Text style={styles.securityNote}>
              🔐 CMC key is encrypted and used for secure communication with KRA eTIMS
            </Text>
          </View>
        )}

        {certificationStatus.error_details && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Error Details</Text>
            <View style={styles.errorDetails}>
              <Text style={styles.errorDetailsText}>
                {JSON.stringify(certificationStatus.error_details, null, 2)}
              </Text>
            </View>
          </View>
        )}

        {certificationStatus.kra_response && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>KRA Response</Text>
            <View style={styles.kraResponse}>
              <Text style={styles.kraResponseText}>
                {JSON.stringify(certificationStatus.kra_response, null, 2)}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.actionSection}>
          <Text style={styles.sectionTitle}>Actions</Text>
          
          {!certificationStatus.is_certified && (
            <TouchableOpacity
              onPress={handleCertifyDevice}
              disabled={certifying}
              style={[styles.actionButton, styles.primaryButton, certifying && styles.disabledButton]}
            >
              <Text style={styles.primaryButtonText}>
                {certifying ? 'Certifying...' : 'Certify Device'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={handleRegenerateKeys}
            disabled={regeneratingKeys}
            style={[styles.actionButton, styles.warningButton, regeneratingKeys && styles.disabledButton]}
          >
            <Text style={styles.warningButtonText}>
              {regeneratingKeys ? 'Regenerating...' : 'Regenerate Keys'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('DeviceRegistration', { 
              editDeviceId: deviceId,
              companyId: certificationStatus.company_id 
            })}
            style={[styles.actionButton, styles.secondaryButton]}
          >
            <Text style={styles.secondaryButtonText}>Edit Device</Text>
          </TouchableOpacity>
        </View>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  errorText: {
    ...typography.body,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 8,
  },
  retryButtonText: {
    color: colors.secondary,
    fontWeight: '600',
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
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  deviceName: {
    ...typography.h3,
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
  },
  statusIcon: {
    fontSize: 16,
    marginRight: spacing.xs,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '600',
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h4,
    marginBottom: spacing.md,
    color: colors.primary,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingVertical: spacing.xs,
  },
  infoLabel: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textSecondary,
    flex: 1,
  },
  infoValue: {
    ...typography.body,
    color: colors.text,
    flex: 2,
    textAlign: 'right',
  },
  cmcKey: {
    ...typography.caption,
    fontFamily: 'monospace',
    color: colors.text,
    flex: 2,
    textAlign: 'right',
  },
  securityNote: {
    ...typography.caption,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
  errorDetails: {
    backgroundColor: '#FFEBEE',
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  errorDetailsText: {
    ...typography.caption,
    fontFamily: 'monospace',
    color: '#C62828',
  },
  kraResponse: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  kraResponseText: {
    ...typography.caption,
    fontFamily: 'monospace',
    color: colors.text,
  },
  actionSection: {
    marginTop: spacing.md,
  },
  actionButton: {
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  secondaryButton: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  warningButton: {
    backgroundColor: '#FF9500',
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
  warningButtonText: {
    color: colors.secondary,
    fontWeight: 'bold',
    fontSize: 16,
  },
  disabledButton: {
    opacity: 0.6,
  },
});

export default DeviceCertificationScreen;

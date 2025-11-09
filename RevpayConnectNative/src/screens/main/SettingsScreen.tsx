import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '@/types';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';

import { colors, spacing, typography } from '@/theme/theme';
import { integrationSettingsState, authState } from '@/store/atoms';
import { apiService } from '@/services/api';
import { IntegrationSettings } from '@/types';

type SettingsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'SettingsMain'>;

const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<SettingsScreenNavigationProp>();
  const [integrationSettings, setIntegrationSettings] = useRecoilState(integrationSettingsState);
  const { user } = useRecoilValue(authState);
  const setAuth = useSetRecoilState(authState);
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    mode: 'OSCU' as 'OSCU' | 'VSCU',
    kraApiCredentials: '',
    kraApiToken: '',
    isActive: true,
  });

  const fetchIntegrationSettings = async () => {
    try {
      const response = await apiService.getIntegrationSettings();
      if (response.success && response.data) {
        setIntegrationSettings(response.data as IntegrationSettings);
        const data = response.data as IntegrationSettings;
        setFormData({
          mode: data.mode,
          kraApiCredentials: data.kraApiCredentials || '',
          kraApiToken: data.kraApiToken || '',
          isActive: data.isActive,
        });
      }
    } catch (error) {
      console.error('Error fetching integration settings:', error);
    }
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      const response = await apiService.updateIntegrationSettings(formData);
      if (response.success) {
        setIntegrationSettings(response.data as IntegrationSettings);
        Alert.alert('Success', 'Integration settings updated successfully');
      } else {
        Alert.alert('Error', response.message || 'Failed to update settings');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await apiService.logout();
            setAuth({
              isAuthenticated: false,
              user: null,
              tokens: null,
              loading: false,
            });
          },
        },
      ]
    );
  };

  useEffect(() => {
    fetchIntegrationSettings();
  }, []);

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Settings</Text>
            <Text style={styles.headerSubtitle}>Configure your tax integration</Text>
          </View>
          <TouchableOpacity 
            style={styles.profileIcon}
            onPress={() => (navigation as any).navigate('Profile')}
          >
            <View style={styles.profileAvatar}>
              <Text style={styles.profileInitial}>
                {user?.businessName?.charAt(0) || user?.email?.charAt(0) || 'U'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Integration Settings */}
      <View style={styles.card}>
        <View>
          <Text style={styles.sectionTitle}>Integration Settings</Text>
          
          {/* Integration Mode */}
          <View style={styles.modeContainer}>
            <Text style={styles.modeTitle}>Integration Mode</Text>
            <Text style={styles.modeDescription}>
              Choose between OSCU (online) or VSCU (virtual) integration mode
            </Text>
            
            <View style={styles.modeOptions}>
              <View style={styles.modeOption}>
                <View style={styles.modeOptionHeader}>
                  <TouchableOpacity onPress={() => updateFormData('mode', 'OSCU')}>
                    <Text style={{ fontSize: 24, color: colors.primary }}>
                      {formData.mode === 'OSCU' ? '🔘' : '⚪'}
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.modeOptionTitle}>OSCU (Online)</Text>
                </View>
                <Text style={styles.modeOptionDescription}>
                  Real-time submission to KRA. Requires active internet connection.
                </Text>
              </View>
              
              <View style={styles.modeOption}>
                <View style={styles.modeOptionHeader}>
                  <TouchableOpacity onPress={() => updateFormData('mode', 'VSCU')}>
                    <Text style={{ fontSize: 24, color: colors.primary }}>
                      {formData.mode === 'VSCU' ? '🔘' : '⚪'}
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.modeOptionTitle}>VSCU (Virtual)</Text>
                </View>
                <Text style={styles.modeOptionDescription}>
                  Offline mode with periodic sync. Invoices are queued and synced when online.
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          {/* API Credentials */}
          <View style={styles.credentialsContainer}>
            <Text style={styles.credentialsTitle}>KRA API Credentials</Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>API Credentials</Text>
              <TextInput
                value={formData.kraApiCredentials}
                onChangeText={(value) => updateFormData('kraApiCredentials', value)}
                multiline
                numberOfLines={3}
                style={styles.multilineInput}
                placeholder="Enter your KRA API credentials (JSON format)"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>API Token (Optional)</Text>
              <TextInput
                value={formData.kraApiToken}
                onChangeText={(value) => updateFormData('kraApiToken', value)}
                style={styles.textInput}
                placeholder="Enter your API token"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          </View>

          <View style={styles.divider} />

          {/* Active Status */}
          <View style={styles.statusContainer}>
            <View style={styles.statusInfo}>
              <Text style={styles.statusTitle}>Integration Active</Text>
              <Text style={styles.statusDescription}>
                Enable or disable tax integration
              </Text>
            </View>
            <Switch
              value={formData.isActive}
              onValueChange={(value) => updateFormData('isActive', value)}
              trackColor={{ false: colors.disabled, true: colors.primary }}
              thumbColor={formData.isActive ? colors.secondary : colors.background}
            />
          </View>

          <TouchableOpacity
            onPress={handleSaveSettings}
            disabled={loading}
            style={[styles.saveButton, { backgroundColor: colors.primary }]}
          >
            <Text style={{ color: colors.secondary }}>Save Settings</Text>
            {loading && <ActivityIndicator color={colors.secondary} style={{ marginLeft: 8 }} />}
          </TouchableOpacity>
        </View>
      </View>

      {/* Account Settings */}
      <View style={styles.card}>
        <View>
          <Text style={styles.sectionTitle}>Account</Text>
          
          <TouchableOpacity 
            style={styles.listItemContainer}
            onPress={() => (navigation as any).navigate('Profile')}
          >
            <View style={styles.listItemContent}>
              <Text style={styles.listItemIcon}>👤</Text>
              <View style={styles.listItemText}>
                <Text style={styles.listItemTitle}>Profile</Text>
                <Text style={styles.listItemDescription}>Manage your business profile</Text>
              </View>
            </View>
            <Text style={styles.listItemChevron}>›</Text>
          </TouchableOpacity>
          
          <View style={styles.listDivider} />
          
          <TouchableOpacity 
            style={styles.listItemContainer}
            onPress={() => (navigation as any).navigate('Subscription')}
          >
            <View style={styles.listItemContent}>
              <Text style={styles.listItemIcon}>💳</Text>
              <View style={styles.listItemText}>
                <Text style={styles.listItemTitle}>Subscription</Text>
                <Text style={styles.listItemDescription}>Current plan: {user?.subscriptionType || 'Free'}</Text>
              </View>
            </View>
            <Text style={styles.listItemChevron}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* App Settings */}
      <View style={styles.card}>
        <View>
          <Text style={styles.sectionTitle}>App Settings</Text>
          
          <TouchableOpacity 
            style={styles.listItemContainer}
            onPress={() => (navigation as any).navigate('Notifications')}
          >
            <View style={styles.listItemContent}>
              <Text style={styles.listItemIcon}>🔔</Text>
              <View style={styles.listItemText}>
                <Text style={styles.listItemTitle}>Notifications</Text>
                <Text style={styles.listItemDescription}>Configure app notifications</Text>
              </View>
            </View>
            <Text style={styles.listItemChevron}>›</Text>
          </TouchableOpacity>
          
          <View style={styles.listDivider} />
          
          <TouchableOpacity 
            style={styles.listItemContainer}
            onPress={() => (navigation as any).navigate('DataStorage')}
          >
            <View style={styles.listItemContent}>
              <Text style={styles.listItemIcon}>💾</Text>
              <View style={styles.listItemText}>
                <Text style={styles.listItemTitle}>Data & Storage</Text>
                <Text style={styles.listItemDescription}>Manage offline data and cache</Text>
              </View>
            </View>
            <Text style={styles.listItemChevron}>›</Text>
          </TouchableOpacity>
          
          <View style={styles.listDivider} />
          
          <TouchableOpacity 
            style={styles.listItemContainer}
            onPress={() => (navigation as any).navigate('HelpSupport')}
          >
            <View style={styles.listItemContent}>
              <Text style={styles.listItemIcon}>❓</Text>
              <View style={styles.listItemText}>
                <Text style={styles.listItemTitle}>Help & Support</Text>
                <Text style={styles.listItemDescription}>Get help and contact support</Text>
              </View>
            </View>
            <Text style={styles.listItemChevron}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Current Status */}
      {integrationSettings && (
        <View style={styles.card}>
          <View>
            <Text style={styles.sectionTitle}>Current Status</Text>
            
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Mode:</Text>
              <Text style={styles.statusValue}>{integrationSettings.mode}</Text>
            </View>
            
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Status:</Text>
              <Text style={[styles.statusValue, { color: integrationSettings.isActive ? colors.primary : colors.textSecondary }]}>
                {integrationSettings.isActive ? 'Active' : 'Inactive'}
              </Text>
            </View>
            
            {integrationSettings?.lastSyncTimestamp && (
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Last Sync:</Text>
                <Text style={styles.statusValue}>
                  {new Date(integrationSettings.lastSyncTimestamp).toLocaleString()}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Logout */}
      <View style={styles.logoutContainer}>
        <TouchableOpacity
          onPress={handleLogout}
          style={[styles.logoutButton, { backgroundColor: colors.background, borderColor: colors.primary }]}
        >
          <Text style={{ color: colors.primary }}>🚪 Logout</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: spacing.md,
    paddingTop: spacing.lg,
  },
  headerTitle: {
    ...typography.h2,
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  card: {
    margin: spacing.md,
    marginTop: 0,
    backgroundColor: colors.card,
    elevation: 1,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  modeContainer: {
    marginBottom: spacing.lg,
  },
  modeTitle: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  modeDescription: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  modeOptions: {
    gap: spacing.md,
  },
  modeOption: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  modeOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  modeOptionTitle: {
    ...typography.body,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  modeOptionDescription: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: spacing.xl,
  },
  divider: {
    marginVertical: spacing.lg,
    backgroundColor: colors.border,
  },
  credentialsContainer: {
    marginBottom: spacing.lg,
  },
  credentialsTitle: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  input: {
    marginBottom: spacing.md,
    backgroundColor: colors.background,
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  statusDescription: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  saveButton: {
    paddingVertical: spacing.xs,
  },
  listItem: {
    paddingHorizontal: 0,
  },
  listDivider: {
    backgroundColor: colors.border,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statusLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  statusValue: {
    ...typography.body,
    fontWeight: '500',
  },
  logoutContainer: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  logoutButton: {
    borderColor: colors.primary,
    paddingVertical: spacing.xs,
  },
  listItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: 0,
  },
  listItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  listItemIcon: {
    fontSize: 20,
    marginRight: spacing.md,
    color: colors.primary,
  },
  listItemText: {
    flex: 1,
  },
  listItemTitle: {
    ...typography.body,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  listItemDescription: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  listItemChevron: {
    fontSize: 18,
    color: colors.textSecondary,
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
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  profileIcon: {
    padding: spacing.xs,
  },
  profileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitial: {
    ...typography.body,
    color: colors.secondary,
    fontWeight: '600',
  },
});

export default SettingsScreen;

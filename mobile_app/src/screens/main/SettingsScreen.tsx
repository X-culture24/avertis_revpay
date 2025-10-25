import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
} from 'react-native';
import { Card, Button, TextInput, Divider, List } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';

import { colors, spacing, typography } from '@/theme/theme';
import { integrationSettingsState, authState } from '@/store/atoms';
import { apiService } from '@/services/api';
import { IntegrationSettings } from '@/types';

const SettingsScreen: React.FC = () => {
  const navigation = useNavigation();
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
        setIntegrationSettings(response.data);
        setFormData({
          mode: response.data.mode,
          kraApiCredentials: response.data.kraApiCredentials || '',
          kraApiToken: response.data.kraApiToken || '',
          isActive: response.data.isActive,
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
        setIntegrationSettings(response.data);
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
        <Text style={styles.headerTitle}>Settings</Text>
        <Text style={styles.headerSubtitle}>Configure your eTIMS integration</Text>
      </View>

      {/* Integration Settings */}
      <Card style={styles.card}>
        <Card.Content>
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
                  <Ionicons 
                    name={formData.mode === 'OSCU' ? 'radio-button-on' : 'radio-button-off'} 
                    size={24} 
                    color={colors.primary}
                    onPress={() => updateFormData('mode', 'OSCU')}
                  />
                  <Text style={styles.modeOptionTitle}>OSCU (Online)</Text>
                </View>
                <Text style={styles.modeOptionDescription}>
                  Real-time submission to KRA eTIMS. Requires active internet connection.
                </Text>
              </View>
              
              <View style={styles.modeOption}>
                <View style={styles.modeOptionHeader}>
                  <Ionicons 
                    name={formData.mode === 'VSCU' ? 'radio-button-on' : 'radio-button-off'} 
                    size={24} 
                    color={colors.primary}
                    onPress={() => updateFormData('mode', 'VSCU')}
                  />
                  <Text style={styles.modeOptionTitle}>VSCU (Virtual)</Text>
                </View>
                <Text style={styles.modeOptionDescription}>
                  Offline mode with periodic sync. Invoices are queued and synced when online.
                </Text>
              </View>
            </View>
          </View>

          <Divider style={styles.divider} />

          {/* API Credentials */}
          <View style={styles.credentialsContainer}>
            <Text style={styles.credentialsTitle}>KRA API Credentials</Text>
            
            <TextInput
              label="API Credentials"
              value={formData.kraApiCredentials}
              onChangeText={(value) => updateFormData('kraApiCredentials', value)}
              mode="outlined"
              multiline
              numberOfLines={3}
              style={styles.input}
              theme={{
                colors: {
                  primary: colors.primary,
                  outline: colors.border,
                }
              }}
              placeholder="Enter your KRA API credentials (JSON format)"
            />

            <TextInput
              label="API Token (Optional)"
              value={formData.kraApiToken}
              onChangeText={(value) => updateFormData('kraApiToken', value)}
              mode="outlined"
              style={styles.input}
              theme={{
                colors: {
                  primary: colors.primary,
                  outline: colors.border,
                }
              }}
              placeholder="Enter your KRA API token"
            />
          </View>

          <Divider style={styles.divider} />

          {/* Active Status */}
          <View style={styles.statusContainer}>
            <View style={styles.statusInfo}>
              <Text style={styles.statusTitle}>Integration Active</Text>
              <Text style={styles.statusDescription}>
                Enable or disable eTIMS integration
              </Text>
            </View>
            <Switch
              value={formData.isActive}
              onValueChange={(value) => updateFormData('isActive', value)}
              trackColor={{ false: colors.disabled, true: colors.primary }}
              thumbColor={formData.isActive ? colors.secondary : colors.background}
            />
          </View>

          <Button
            mode="contained"
            onPress={handleSaveSettings}
            loading={loading}
            disabled={loading}
            style={styles.saveButton}
            buttonColor={colors.primary}
            textColor={colors.secondary}
          >
            Save Settings
          </Button>
        </Card.Content>
      </Card>

      {/* Account Settings */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Account</Text>
          
          <List.Item
            title="Profile"
            description="Manage your business profile"
            left={(props) => <List.Icon {...props} icon="account" color={colors.primary} />}
            right={(props) => <List.Icon {...props} icon="chevron-right" color={colors.textSecondary} />}
            onPress={() => navigation.navigate('Profile' as never)}
            style={styles.listItem}
          />
          
          <Divider style={styles.listDivider} />
          
          <List.Item
            title="Subscription"
            description={`Current plan: ${user?.subscriptionType || 'Free'}`}
            left={(props) => <List.Icon {...props} icon="card-account-details" color={colors.primary} />}
            right={(props) => <List.Icon {...props} icon="chevron-right" color={colors.textSecondary} />}
            onPress={() => {/* Navigate to subscription */}}
            style={styles.listItem}
          />
        </Card.Content>
      </Card>

      {/* App Settings */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>App Settings</Text>
          
          <List.Item
            title="Notifications"
            description="Configure app notifications"
            left={(props) => <List.Icon {...props} icon="bell" color={colors.primary} />}
            right={(props) => <List.Icon {...props} icon="chevron-right" color={colors.textSecondary} />}
            onPress={() => {/* Navigate to notifications */}}
            style={styles.listItem}
          />
          
          <Divider style={styles.listDivider} />
          
          <List.Item
            title="Data & Storage"
            description="Manage offline data and cache"
            left={(props) => <List.Icon {...props} icon="database" color={colors.primary} />}
            right={(props) => <List.Icon {...props} icon="chevron-right" color={colors.textSecondary} />}
            onPress={() => {/* Navigate to data settings */}}
            style={styles.listItem}
          />
          
          <Divider style={styles.listDivider} />
          
          <List.Item
            title="Help & Support"
            description="Get help and contact support"
            left={(props) => <List.Icon {...props} icon="help-circle" color={colors.primary} />}
            right={(props) => <List.Icon {...props} icon="chevron-right" color={colors.textSecondary} />}
            onPress={() => {/* Navigate to help */}}
            style={styles.listItem}
          />
        </Card.Content>
      </Card>

      {/* Current Status */}
      {integrationSettings && (
        <Card style={styles.card}>
          <Card.Content>
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
            
            {integrationSettings.lastSyncTimestamp && (
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Last Sync:</Text>
                <Text style={styles.statusValue}>
                  {new Date(integrationSettings.lastSyncTimestamp).toLocaleString()}
                </Text>
              </View>
            )}
          </Card.Content>
        </Card>
      )}

      {/* Logout */}
      <View style={styles.logoutContainer}>
        <Button
          mode="outlined"
          onPress={handleLogout}
          style={styles.logoutButton}
          buttonColor={colors.background}
          textColor={colors.primary}
          icon="logout"
        >
          Logout
        </Button>
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
    ...typography.small,
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
});

export default SettingsScreen;

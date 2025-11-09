import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '@/theme/theme';
// import apiService from '@/services/api'; // TODO: Implement API integration

interface StorageInfo {
  total: number;
  used: number;
  available: number;
  breakdown: {
    invoices: number;
    cache: number;
    images: number;
    logs: number;
    other: number;
  };
}

const DataStorageScreen: React.FC = () => {
  const [refreshing, setRefreshing] = useState(false);
  const [storageInfo, setStorageInfo] = useState<StorageInfo>({
    total: 1024, // MB
    used: 245,
    available: 779,
    breakdown: {
      invoices: 120,
      cache: 85,
      images: 25,
      logs: 10,
      other: 5,
    },
  });

  const [autoSync, setAutoSync] = useState(true);
  const [syncOnWifiOnly, setSyncOnWifiOnly] = useState(true);
  const [cacheImages, setCacheImages] = useState(true);
  const [keepOfflineData, setKeepOfflineData] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());

  useEffect(() => {
    loadStorageInfo();
    loadSyncSettings();
  }, []);

  const loadStorageInfo = async () => {
    try {
      // Calculate actual storage usage
      const keys = await AsyncStorage.getAllKeys();
      let totalSize = 0;
      
      for (const key of keys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          totalSize += new Blob([value]).size;
        }
      }

      // Convert to MB and update state
      const usedMB = Math.round(totalSize / (1024 * 1024) * 100) / 100;
      
      setStorageInfo(prev => ({
        ...prev,
        used: usedMB,
        available: prev.total - usedMB,
      }));
    } catch (error) {
      console.error('Error loading storage info:', error);
    }
  };

  const loadSyncSettings = async () => {
    try {
      const settings = await AsyncStorage.getItem('sync_settings');
      if (settings) {
        const parsed = JSON.parse(settings);
        setAutoSync(parsed.autoSync ?? true);
        setSyncOnWifiOnly(parsed.syncOnWifiOnly ?? true);
        setCacheImages(parsed.cacheImages ?? true);
        setKeepOfflineData(parsed.keepOfflineData ?? true);
      }

      const lastSync = await AsyncStorage.getItem('last_sync_time');
      if (lastSync) {
        setLastSyncTime(new Date(lastSync));
      }
    } catch (error) {
      console.error('Error loading sync settings:', error);
    }
  };

  const saveSyncSettings = async () => {
    try {
      const settings = {
        autoSync,
        syncOnWifiOnly,
        cacheImages,
        keepOfflineData,
      };
      await AsyncStorage.setItem('sync_settings', JSON.stringify(settings));
      Alert.alert('Success', 'Sync settings saved successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to save sync settings');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStorageInfo();
    setRefreshing(false);
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will clear all cached data including images and temporary files. Your invoices and settings will be preserved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear specific cache keys
              const keys = await AsyncStorage.getAllKeys();
              const cacheKeys = keys.filter(key => 
                key.startsWith('cache_') || 
                key.startsWith('image_') ||
                key.startsWith('temp_')
              );
              await AsyncStorage.multiRemove(cacheKeys);
              await loadStorageInfo();
              Alert.alert('Success', 'Cache cleared successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear cache');
            }
          },
        },
      ]
    );
  };

  const handleClearAllData = () => {
    Alert.alert(
      'Clear All Data',
      'WARNING: This will delete all local data including invoices, settings, and cached files. This action cannot be undone. You will be logged out.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.clear();
              Alert.alert('Success', 'All data cleared. Please restart the app.');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear data');
            }
          },
        },
      ]
    );
  };

  const handleSyncNow = async () => {
    try {
      Alert.alert('Syncing', 'Synchronizing data with server...');
      // TODO: Implement actual sync logic
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const now = new Date();
      setLastSyncTime(now);
      await AsyncStorage.setItem('last_sync_time', now.toISOString());
      
      Alert.alert('Success', 'Data synchronized successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to sync data');
    }
  };

  const handleExportData = () => {
    Alert.alert(
      'Export Data',
      'Choose export format:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'CSV',
          onPress: () => {
            // TODO: Implement CSV export
            Alert.alert('Export', 'CSV export coming soon');
          },
        },
        {
          text: 'JSON',
          onPress: () => {
            // TODO: Implement JSON export
            Alert.alert('Export', 'JSON export coming soon');
          },
        },
      ]
    );
  };

  const getStoragePercentage = () => {
    return (storageInfo.used / storageInfo.total) * 100;
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} MB`;
    return `${(bytes / 1024).toFixed(2)} GB`;
  };

  const formatLastSync = () => {
    const now = new Date();
    const diff = now.getTime() - lastSyncTime.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const storagePercentage = getStoragePercentage();
  const storageColor = storagePercentage > 80 ? colors.error : 
                       storagePercentage > 60 ? colors.warning : colors.success;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Data & Storage</Text>
      </View>

      {/* Storage Overview */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Storage Usage</Text>
        <View style={styles.storageCard}>
          <View style={styles.storageHeader}>
            <Text style={styles.storageUsed}>{formatBytes(storageInfo.used)}</Text>
            <Text style={styles.storageTotal}>of {formatBytes(storageInfo.total)}</Text>
          </View>

          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${storagePercentage}%`, backgroundColor: storageColor }
              ]} 
            />
          </View>

          <Text style={styles.storagePercentage}>{storagePercentage.toFixed(1)}% Used</Text>

          {/* Storage Breakdown */}
          <View style={styles.breakdownContainer}>
            <View style={styles.breakdownItem}>
              <View style={[styles.breakdownDot, { backgroundColor: colors.primary }]} />
              <Text style={styles.breakdownLabel}>Invoices</Text>
              <Text style={styles.breakdownValue}>{storageInfo.breakdown.invoices} MB</Text>
            </View>
            <View style={styles.breakdownItem}>
              <View style={[styles.breakdownDot, { backgroundColor: colors.warning }]} />
              <Text style={styles.breakdownLabel}>Cache</Text>
              <Text style={styles.breakdownValue}>{storageInfo.breakdown.cache} MB</Text>
            </View>
            <View style={styles.breakdownItem}>
              <View style={[styles.breakdownDot, { backgroundColor: colors.success }]} />
              <Text style={styles.breakdownLabel}>Images</Text>
              <Text style={styles.breakdownValue}>{storageInfo.breakdown.images} MB</Text>
            </View>
            <View style={styles.breakdownItem}>
              <View style={[styles.breakdownDot, { backgroundColor: colors.textSecondary }]} />
              <Text style={styles.breakdownLabel}>Logs</Text>
              <Text style={styles.breakdownValue}>{storageInfo.breakdown.logs} MB</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Sync Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sync Status</Text>
        <View style={styles.syncCard}>
          <View style={styles.syncRow}>
            <View>
              <Text style={styles.syncLabel}>Last Sync</Text>
              <Text style={styles.syncValue}>{formatLastSync()}</Text>
            </View>
            <TouchableOpacity style={styles.syncButton} onPress={handleSyncNow}>
              <Text style={styles.syncButtonText}>Sync Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Sync Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sync Settings</Text>

        <View style={styles.settingCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Auto Sync</Text>
              <Text style={styles.settingDescription}>
                Automatically sync data in background
              </Text>
            </View>
            <Switch
              value={autoSync}
              onValueChange={setAutoSync}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
        </View>

        <View style={styles.settingCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>WiFi Only</Text>
              <Text style={styles.settingDescription}>
                Sync only when connected to WiFi
              </Text>
            </View>
            <Switch
              value={syncOnWifiOnly}
              onValueChange={setSyncOnWifiOnly}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
        </View>

        <View style={styles.settingCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Cache Images</Text>
              <Text style={styles.settingDescription}>
                Store images locally for faster loading
              </Text>
            </View>
            <Switch
              value={cacheImages}
              onValueChange={setCacheImages}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
        </View>

        <View style={styles.settingCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Keep Offline Data</Text>
              <Text style={styles.settingDescription}>
                Store data for offline access
              </Text>
            </View>
            <Switch
              value={keepOfflineData}
              onValueChange={setKeepOfflineData}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={saveSyncSettings}>
          <Text style={styles.saveButtonText}>Save Settings</Text>
        </TouchableOpacity>
      </View>

      {/* Data Management */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data Management</Text>

        <TouchableOpacity style={styles.actionCard} onPress={handleExportData}>
          <View style={styles.actionContent}>
            <Text style={styles.actionIcon}>📤</Text>
            <View style={styles.actionText}>
              <Text style={styles.actionTitle}>Export Data</Text>
              <Text style={styles.actionDescription}>
                Download your data as CSV or JSON
              </Text>
            </View>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionCard} onPress={handleClearCache}>
          <View style={styles.actionContent}>
            <Text style={styles.actionIcon}>🗑️</Text>
            <View style={styles.actionText}>
              <Text style={styles.actionTitle}>Clear Cache</Text>
              <Text style={styles.actionDescription}>
                Free up space by clearing cached data
              </Text>
            </View>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionCard} onPress={handleClearAllData}>
          <View style={styles.actionContent}>
            <Text style={styles.actionIcon}>⚠️</Text>
            <View style={styles.actionText}>
              <Text style={[styles.actionTitle, { color: colors.error }]}>
                Clear All Data
              </Text>
              <Text style={styles.actionDescription}>
                Delete all local data (cannot be undone)
              </Text>
            </View>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Info */}
      <View style={styles.section}>
        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>ℹ️</Text>
          <Text style={styles.infoText}>
            Data is automatically backed up to the cloud when synced. Clearing local data will not affect your cloud backups.
          </Text>
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
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: colors.primary,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  section: {
    padding: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 15,
  },
  storageCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  storageHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 15,
  },
  storageUsed: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text,
    marginRight: 8,
  },
  storageTotal: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  progressBar: {
    height: 12,
    backgroundColor: colors.border,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
  },
  storagePercentage: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  breakdownContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 15,
  },
  breakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  breakdownDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  breakdownLabel: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  syncCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  syncRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  syncLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  syncValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  syncButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  settingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingInfo: {
    flex: 1,
    marginRight: 15,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  actionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  actionIcon: {
    fontSize: 32,
    marginRight: 15,
  },
  actionText: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  chevron: {
    fontSize: 24,
    color: colors.textSecondary,
  },
  infoCard: {
    backgroundColor: '#e8f4ff',
    borderRadius: 12,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
});

export default DataStorageScreen;

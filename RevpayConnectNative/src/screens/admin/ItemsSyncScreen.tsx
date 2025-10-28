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
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { colors, spacing, typography } from '@/theme/theme';
import { apiService } from '@/services/api';

type ItemsSyncScreenNavigationProp = StackNavigationProp<any, 'ItemsSync'>;

interface SyncStatus {
  last_sync: string | null;
  total_items: number;
  tax_types: number;
  payment_types: number;
  unit_measures: number;
  sync_in_progress: boolean;
  last_error: string | null;
}

interface SyncHistory {
  id: string;
  sync_type: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  items_synced: number;
  error_message: string | null;
}

const ItemsSyncScreen: React.FC = () => {
  const navigation = useNavigation<ItemsSyncScreenNavigationProp>();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncHistory, setSyncHistory] = useState<SyncHistory[]>([]);

  useEffect(() => {
    fetchSyncData();
  }, []);

  const fetchSyncData = async () => {
    try {
      // Fetch sync status
      const statusResponse = await apiService.getSystemCodes();
      if (statusResponse.success && statusResponse.data) {
        const data = statusResponse.data as any;
        setSyncStatus({
          last_sync: data.last_sync || null,
          total_items: data.total_items || 0,
          tax_types: data.tax_types || 0,
          payment_types: data.payment_types || 0,
          unit_measures: data.unit_measures || 0,
          sync_in_progress: data.sync_in_progress || false,
          last_error: data.last_error || null,
        });
      }

      // Fetch sync history
      const historyResponse = await apiService.getSyncHistory();
      if (historyResponse.success && historyResponse.data) {
        setSyncHistory(Array.isArray(historyResponse.data) ? historyResponse.data : []);
      }
    } catch (error) {
      console.error('Error fetching sync data:', error);
      Alert.alert('Error', 'Failed to fetch sync data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSyncData();
  };

  const handleSyncSystemCodes = async () => {
    setSyncing(true);
    try {
      const response = await apiService.syncSystemCodes();
      
      if (response.success) {
        Alert.alert('Success', 'System codes sync initiated successfully');
        await fetchSyncData(); // Refresh data
      } else {
        Alert.alert('Error', response.message || 'Failed to sync system codes');
      }
    } catch (error) {
      console.error('Sync codes error:', error);
      Alert.alert('Error', 'Failed to sync system codes');
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncItems = async () => {
    setSyncing(true);
    try {
      const response = await apiService.syncItems();
      
      if (response.success) {
        Alert.alert('Success', 'Items sync initiated successfully');
        await fetchSyncData(); // Refresh data
      } else {
        Alert.alert('Error', response.message || 'Failed to sync items');
      }
    } catch (error) {
      console.error('Sync items error:', error);
      Alert.alert('Error', 'Failed to sync items');
    } finally {
      setSyncing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed': return '#34C759';
      case 'in_progress': return '#FF9500';
      case 'failed': return '#FF3B30';
      default: return colors.textSecondary;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed': return '✅';
      case 'in_progress': return '🔄';
      case 'failed': return '❌';
      default: return '⚪';
    }
  };

  const formatSyncType = (type: string) => {
    switch (type) {
      case 'system_codes': return 'System Codes';
      case 'tax_types': return 'Tax Types';
      case 'payment_types': return 'Payment Types';
      case 'unit_measures': return 'Unit Measures';
      case 'item_master': return 'Item Master';
      default: return type;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading sync data...</Text>
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
        <Text style={styles.title}>Items Synchronization</Text>
        <Text style={styles.subtitle}>Manage KRA system codes and item data sync</Text>
      </View>

      {/* Sync Status */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sync Status</Text>
        
        {syncStatus ? (
          <>
            <View style={styles.statusGrid}>
              <View style={styles.statusItem}>
                <Text style={styles.statusValue}>{syncStatus.total_items}</Text>
                <Text style={styles.statusLabel}>Total Items</Text>
              </View>

              <View style={styles.statusItem}>
                <Text style={styles.statusValue}>{syncStatus.tax_types}</Text>
                <Text style={styles.statusLabel}>Tax Types</Text>
              </View>

              <View style={styles.statusItem}>
                <Text style={styles.statusValue}>{syncStatus.payment_types}</Text>
                <Text style={styles.statusLabel}>Payment Types</Text>
              </View>

              <View style={styles.statusItem}>
                <Text style={styles.statusValue}>{syncStatus.unit_measures}</Text>
                <Text style={styles.statusLabel}>Unit Measures</Text>
              </View>
            </View>

            <View style={styles.syncInfo}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Last Sync:</Text>
                <Text style={styles.infoValue}>
                  {syncStatus.last_sync 
                    ? new Date(syncStatus.last_sync).toLocaleString()
                    : 'Never'
                  }
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Status:</Text>
                <Text style={[styles.infoValue, { 
                  color: syncStatus.sync_in_progress ? '#FF9500' : '#34C759' 
                }]}>
                  {syncStatus.sync_in_progress ? 'Syncing...' : 'Ready'}
                </Text>
              </View>

              {syncStatus.last_error && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorTitle}>Last Error:</Text>
                  <Text style={styles.errorText}>{syncStatus.last_error}</Text>
                </View>
              )}
            </View>
          </>
        ) : (
          <Text style={styles.noDataText}>No sync status available</Text>
        )}
      </View>

      {/* Sync Actions */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sync Actions</Text>
        
        <TouchableOpacity
          onPress={handleSyncSystemCodes}
          disabled={syncing || syncStatus?.sync_in_progress}
          style={[styles.actionButton, styles.primaryButton, (syncing || syncStatus?.sync_in_progress) && styles.disabledButton]}
        >
          <Text style={styles.primaryButtonText}>
            {syncing ? 'Syncing...' : 'Sync System Codes'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleSyncItems}
          disabled={syncing || syncStatus?.sync_in_progress}
          style={[styles.actionButton, styles.secondaryButton, (syncing || syncStatus?.sync_in_progress) && styles.disabledButton]}
        >
          <Text style={styles.secondaryButtonText}>
            {syncing ? 'Syncing...' : 'Sync Item Master Data'}
          </Text>
        </TouchableOpacity>

        <View style={styles.syncNote}>
          <Text style={styles.syncNoteText}>
            💡 System codes include tax types, payment methods, and unit measures from KRA. 
            Item master data includes product classifications and categories.
          </Text>
        </View>
      </View>

      {/* Sync History */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sync History</Text>
        
        {syncHistory.length > 0 ? (
          <View style={styles.historyContainer}>
            {syncHistory.slice(0, 10).map((history, index) => (
              <View key={index} style={styles.historyItem}>
                <View style={styles.historyHeader}>
                  <Text style={styles.historyType}>
                    {formatSyncType(history.sync_type)}
                  </Text>
                  <View style={styles.historyStatus}>
                    <Text style={styles.historyStatusIcon}>
                      {getStatusIcon(history.status)}
                    </Text>
                    <Text style={[styles.historyStatusText, { color: getStatusColor(history.status) }]}>
                      {history.status}
                    </Text>
                  </View>
                </View>
                
                <Text style={styles.historyTime}>
                  Started: {new Date(history.started_at).toLocaleString()}
                </Text>
                
                {history.completed_at && (
                  <Text style={styles.historyTime}>
                    Completed: {new Date(history.completed_at).toLocaleString()}
                  </Text>
                )}
                
                <Text style={styles.historyItems}>
                  Items synced: {history.items_synced}
                </Text>
                
                {history.error_message && (
                  <Text style={styles.historyError}>
                    Error: {history.error_message}
                  </Text>
                )}
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.noDataText}>No sync history available</Text>
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
  cardTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
    color: colors.primary,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  statusItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: 8,
  },
  statusValue: {
    ...typography.h2,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  statusLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  syncInfo: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  infoLabel: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  infoValue: {
    ...typography.body,
    color: colors.text,
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    padding: spacing.md,
    borderRadius: 8,
    marginTop: spacing.md,
  },
  errorTitle: {
    ...typography.body,
    fontWeight: '600',
    color: '#C62828',
    marginBottom: spacing.xs,
  },
  errorText: {
    ...typography.caption,
    color: '#C62828',
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
  syncNote: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  syncNoteText: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  historyContainer: {
    maxHeight: 400,
  },
  historyItem: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  historyType: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  historyStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyStatusIcon: {
    fontSize: 16,
    marginRight: spacing.xs,
  },
  historyStatusText: {
    ...typography.caption,
    fontWeight: '600',
  },
  historyTime: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  historyItems: {
    ...typography.caption,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  historyError: {
    ...typography.caption,
    color: '#C62828',
  },
  noDataText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default ItemsSyncScreen;

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

type SystemAdminScreenNavigationProp = StackNavigationProp<any, 'SystemAdmin'>;

interface SystemHealth {
  status: string;
  database: boolean;
  kra_connection: boolean;
  celery_workers: boolean;
  redis_connection: boolean;
  last_check: string;
}

interface SystemAnalytics {
  total_companies: number;
  active_devices: number;
  total_invoices: number;
  success_rate: number;
  retry_queue_size: number;
  last_sync: string;
}

const SystemAdminScreen: React.FC = () => {
  const navigation = useNavigation<SystemAdminScreenNavigationProp>();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingCodes, setSyncingCodes] = useState(false);
  const [processingRetries, setProcessingRetries] = useState(false);
  
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [systemAnalytics, setSystemAnalytics] = useState<SystemAnalytics | null>(null);
  const [apiLogs, setApiLogs] = useState<any[]>([]);

  useEffect(() => {
    fetchSystemData();
  }, []);

  const fetchSystemData = async () => {
    try {
      // Fetch system health
      const healthResponse = await apiService.getSystemHealth();
      if (healthResponse.success) {
        setSystemHealth(healthResponse.data);
      }

      // Fetch system analytics
      const analyticsResponse = await apiService.getSystemAnalytics();
      if (analyticsResponse.success) {
        setSystemAnalytics(analyticsResponse.data);
      }

      // Fetch recent API logs
      const logsResponse = await apiService.getApiLogs({ limit: 10 });
      if (logsResponse.success) {
        setApiLogs(logsResponse.data || []);
      }
    } catch (error) {
      console.error('Error fetching system data:', error);
      Alert.alert('Error', 'Failed to fetch system data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSystemData();
  };

  const handleSyncSystemCodes = async () => {
    setSyncingCodes(true);
    try {
      const response = await apiService.syncSystemCodes();
      
      if (response.success) {
        Alert.alert('Success', 'System codes synchronized successfully');
        await fetchSystemData(); // Refresh data
      } else {
        Alert.alert('Error', response.message || 'Failed to sync system codes');
      }
    } catch (error) {
      console.error('Sync codes error:', error);
      Alert.alert('Error', 'Failed to sync system codes');
    } finally {
      setSyncingCodes(false);
    }
  };

  const handleProcessRetryQueue = async () => {
    setProcessingRetries(true);
    try {
      const response = await apiService.processRetryQueue();
      
      if (response.success) {
        Alert.alert('Success', 'Retry queue processed successfully');
        await fetchSystemData(); // Refresh data
      } else {
        Alert.alert('Error', response.message || 'Failed to process retry queue');
      }
    } catch (error) {
      console.error('Process retries error:', error);
      Alert.alert('Error', 'Failed to process retry queue');
    } finally {
      setProcessingRetries(false);
    }
  };

  const getHealthStatusColor = (status: boolean | string) => {
    if (typeof status === 'boolean') {
      return status ? '#34C759' : '#FF3B30';
    }
    return status === 'healthy' ? '#34C759' : '#FF3B30';
  };

  const getHealthStatusIcon = (status: boolean | string) => {
    if (typeof status === 'boolean') {
      return status ? '✅' : '❌';
    }
    return status === 'healthy' ? '✅' : '❌';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'info': return '#007AFF';
      case 'warning': return '#FF9500';
      case 'error': return '#FF3B30';
      default: return colors.textSecondary;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading system data...</Text>
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
        <Text style={styles.title}>System Administration</Text>
        <Text style={styles.subtitle}>Monitor and manage system health</Text>
      </View>

      {/* System Health */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>System Health</Text>
        
        {systemHealth ? (
          <>
            <View style={styles.healthGrid}>
              <View style={styles.healthItem}>
                <Text style={styles.healthIcon}>
                  {getHealthStatusIcon(systemHealth.status)}
                </Text>
                <Text style={styles.healthLabel}>Overall Status</Text>
                <Text style={[styles.healthValue, { color: getHealthStatusColor(systemHealth.status) }]}>
                  {systemHealth.status}
                </Text>
              </View>

              <View style={styles.healthItem}>
                <Text style={styles.healthIcon}>
                  {getHealthStatusIcon(systemHealth.database)}
                </Text>
                <Text style={styles.healthLabel}>Database</Text>
                <Text style={[styles.healthValue, { color: getHealthStatusColor(systemHealth.database) }]}>
                  {systemHealth.database ? 'Connected' : 'Disconnected'}
                </Text>
              </View>

              <View style={styles.healthItem}>
                <Text style={styles.healthIcon}>
                  {getHealthStatusIcon(systemHealth.kra_connection)}
                </Text>
                <Text style={styles.healthLabel}>KRA Connection</Text>
                <Text style={[styles.healthValue, { color: getHealthStatusColor(systemHealth.kra_connection) }]}>
                  {systemHealth.kra_connection ? 'Online' : 'Offline'}
                </Text>
              </View>

              <View style={styles.healthItem}>
                <Text style={styles.healthIcon}>
                  {getHealthStatusIcon(systemHealth.celery_workers)}
                </Text>
                <Text style={styles.healthLabel}>Workers</Text>
                <Text style={[styles.healthValue, { color: getHealthStatusColor(systemHealth.celery_workers) }]}>
                  {systemHealth.celery_workers ? 'Active' : 'Inactive'}
                </Text>
              </View>
            </View>

            <Text style={styles.lastCheck}>
              Last check: {new Date(systemHealth.last_check).toLocaleString()}
            </Text>
          </>
        ) : (
          <Text style={styles.noDataText}>No health data available</Text>
        )}
      </View>

      {/* System Analytics */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>System Analytics</Text>
        
        {systemAnalytics ? (
          <View style={styles.analyticsGrid}>
            <View style={styles.analyticsItem}>
              <Text style={styles.analyticsValue}>{systemAnalytics.total_companies}</Text>
              <Text style={styles.analyticsLabel}>Companies</Text>
            </View>

            <View style={styles.analyticsItem}>
              <Text style={styles.analyticsValue}>{systemAnalytics.active_devices}</Text>
              <Text style={styles.analyticsLabel}>Active Devices</Text>
            </View>

            <View style={styles.analyticsItem}>
              <Text style={styles.analyticsValue}>{systemAnalytics.total_invoices}</Text>
              <Text style={styles.analyticsLabel}>Total Invoices</Text>
            </View>

            <View style={styles.analyticsItem}>
              <Text style={styles.analyticsValue}>{systemAnalytics.success_rate}%</Text>
              <Text style={styles.analyticsLabel}>Success Rate</Text>
            </View>

            <View style={styles.analyticsItem}>
              <Text style={[styles.analyticsValue, { color: systemAnalytics.retry_queue_size > 0 ? '#FF9500' : '#34C759' }]}>
                {systemAnalytics.retry_queue_size}
              </Text>
              <Text style={styles.analyticsLabel}>Retry Queue</Text>
            </View>
          </View>
        ) : (
          <Text style={styles.noDataText}>No analytics data available</Text>
        )}
      </View>

      {/* System Actions */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>System Actions</Text>
        
        <TouchableOpacity
          onPress={handleSyncSystemCodes}
          disabled={syncingCodes}
          style={[styles.actionButton, styles.primaryButton, syncingCodes && styles.disabledButton]}
        >
          <Text style={styles.primaryButtonText}>
            {syncingCodes ? 'Syncing...' : 'Sync System Codes'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleProcessRetryQueue}
          disabled={processingRetries}
          style={[styles.actionButton, styles.warningButton, processingRetries && styles.disabledButton]}
        >
          <Text style={styles.warningButtonText}>
            {processingRetries ? 'Processing...' : 'Process Retry Queue'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate('CompanyManagement')}
          style={[styles.actionButton, styles.secondaryButton]}
        >
          <Text style={styles.secondaryButtonText}>Manage Companies</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate('CompanyOnboarding')}
          style={[styles.actionButton, styles.secondaryButton]}
        >
          <Text style={styles.secondaryButtonText}>Onboard New Company</Text>
        </TouchableOpacity>
      </View>

      {/* Recent API Logs */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent API Logs</Text>
        
        {apiLogs.length > 0 ? (
          <View style={styles.logsContainer}>
            {apiLogs.slice(0, 5).map((log, index) => (
              <View key={index} style={styles.logItem}>
                <View style={styles.logHeader}>
                  <Text style={styles.logMethod}>{log.method}</Text>
                  <Text style={styles.logEndpoint}>{log.endpoint}</Text>
                  <Text style={[styles.logSeverity, { color: getSeverityColor(log.severity) }]}>
                    {log.severity}
                  </Text>
                </View>
                <Text style={styles.logTimestamp}>
                  {new Date(log.timestamp).toLocaleString()}
                </Text>
                <Text style={styles.logStatus}>Status: {log.status_code}</Text>
              </View>
            ))}
            
            <TouchableOpacity
              onPress={() => navigation.navigate('ApiLogs')}
              style={styles.viewAllButton}
            >
              <Text style={styles.viewAllButtonText}>View All Logs</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.noDataText}>No recent logs available</Text>
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
  healthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  healthItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: 8,
  },
  healthIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  healthLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  healthValue: {
    ...typography.body,
    fontWeight: '600',
  },
  lastCheck: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  analyticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  analyticsItem: {
    width: '30%',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  analyticsValue: {
    ...typography.h2,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  analyticsLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
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
  logsContainer: {
    maxHeight: 300,
  },
  logItem: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  logMethod: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.primary,
  },
  logEndpoint: {
    ...typography.caption,
    flex: 1,
    marginHorizontal: spacing.sm,
    color: colors.text,
  },
  logSeverity: {
    ...typography.caption,
    fontWeight: '600',
  },
  logTimestamp: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  logStatus: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  viewAllButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
  viewAllButtonText: {
    color: colors.primary,
    fontWeight: '600',
  },
  noDataText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default SystemAdminScreen;

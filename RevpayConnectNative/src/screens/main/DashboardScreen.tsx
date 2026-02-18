import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Alert,
  TextInput,
} from 'react-native';
import { useRecoilState, useRecoilValue } from 'recoil';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { colors, spacing, typography } from '@/theme/theme';
import { dashboardStatsState, authState, integrationSettingsState } from '@/store/atoms';
import { dashboardDataSelector } from '@/store/selectors';
import { apiService } from '@/services/api';
import { DashboardStats, Invoice } from '@/types';

const DashboardScreen: React.FC = () => {
  const navigation = useNavigation();
  const [dashboardStats, setDashboardStats] = useRecoilState(dashboardStatsState);
  const { user } = useRecoilValue(authState);
  const integrationSettings = useRecoilValue(integrationSettingsState);
  const [refreshing, setRefreshing] = useState(false);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [devices, setDevices] = useState<any[]>([]);
  const [retryQueueSize, setRetryQueueSize] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<any>(null);

  const fetchDashboardData = async () => {
    try {
      console.log('🔄 Fetching comprehensive dashboard data...');
      
      // Fetch dashboard stats with enhanced data
      const response = await apiService.getDashboardStats();
      if (response.success && response.data) {
        console.log('📊 Dashboard stats received:', response.data);
        setDashboardStats(response.data as DashboardStats);
        
        // Extract additional data from dashboard stats
        const stats = response.data as any;
        // Backend returns both last_sync and lastSyncTime
        setLastSync(stats.last_sync || stats.lastSyncTime);
      }

      // Fetch all recent invoices (not just failed)
      const invoicesResponse = await apiService.getInvoices(1, 20);
      if (invoicesResponse.success && invoicesResponse.data && typeof invoicesResponse.data === 'object' && invoicesResponse.data !== null && 'results' in invoicesResponse.data) {
        const allInvoices = (invoicesResponse.data as any).results || [];
        console.log('📄 All invoices received:', allInvoices.length);
        setAllInvoices(allInvoices); // Store all invoices for search
        setRecentInvoices(allInvoices.slice(0, 10)); // Show max 10 recent invoices
      }
      
      // Fetch devices
      const devicesResponse = await apiService.getDevices();
      if (devicesResponse.success && devicesResponse.data) {
        console.log('📱 Devices received:', devicesResponse.data);
        setDevices(Array.isArray(devicesResponse.data) ? devicesResponse.data : []);
      }
      
      // Fetch VSCU status for retry queue info
      try {
        const vscuResponse = await apiService.getVSCUStatus();
        if (vscuResponse.success && vscuResponse.data) {
          console.log('⚡ VSCU status received:', vscuResponse.data);
          setRetryQueueSize((vscuResponse.data as any).retry_queue_size || 0);
        }
      } catch (vscuError) {
        console.log('ℹ️ VSCU status not available (normal for OSCU-only setups)');
      }
      
      // Fetch subscription status
      try {
        const subResponse = await apiService.get('/subscription/current/');
        if (subResponse.success && subResponse.data) {
          console.log('💳 Subscription received:', subResponse.data);
          setSubscription(subResponse.data.subscription);
        }
      } catch (subError) {
        console.log('ℹ️ Subscription info not available');
      }
      
    } catch (error) {
      console.error('❌ Error fetching dashboard data:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
      case 'synced': 
      case 'active': return '#34C759';
      case 'pending': 
      case 'sent': return '#FF9500';
      case 'failed': 
      case 'inactive': return '#FF3B30';
      case 'retry': return '#007AFF';
      default: return colors.textSecondary;
    }
  };
  
  const getIntegrationModeDisplay = (mode: string) => {
    switch (mode) {
      case 'oscu': return 'Online Mode (OSCU)';
      case 'vscu': return 'Virtual Mode (VSCU)';
      case 'mixed': return 'Hybrid Mode';
      default: return 'Not Configured';
    }
  };
  
  const handleDeviceRegistration = () => {
    Alert.alert(
      'Device Registration',
      'Would you like to register a new device?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'OSCU Device', onPress: () => console.log('Navigate to OSCU device registration') },
        { text: 'VSCU Device', onPress: () => console.log('Navigate to VSCU device registration') },
      ]
    );
  };
  
  const handleSyncDevices = async () => {
    try {
      console.log('🔄 Triggering device sync...');
      
      let syncSuccess = true;
      let syncMessages: string[] = [];
      let latestSyncTime: string | null = null;
      
      // Trigger sync for all devices
      for (const device of devices) {
        try {
          const response = await apiService.syncDevice(device.id);
          if (response.success || response.data) {
            const deviceData = response.data?.device || {};
            const syncTime = deviceData.last_sync;
            console.log(`✅ Device ${device.serial_number} synced at:`, syncTime);
            
            // Track the latest sync time
            if (syncTime && (!latestSyncTime || new Date(syncTime) > new Date(latestSyncTime))) {
              latestSyncTime = syncTime;
            }
            
            if (response.data?.warning) {
              syncMessages.push(response.data.warning);
            }
          } else {
            syncSuccess = false;
            syncMessages.push(`${device.serial_number}: ${response.message || 'Sync failed'}`);
          }
        } catch (error) {
          console.error(`❌ Error syncing device ${device.serial_number}:`, error);
          syncSuccess = false;
        }
      }
      
      // Update lastSync with the actual sync time from the response
      if (latestSyncTime) {
        console.log('📅 Setting lastSync to:', latestSyncTime);
        setLastSync(latestSyncTime);
      }
      
      // Trigger VSCU sync if available
      if (dashboardStats?.integration_mode === 'vscu' || dashboardStats?.integration_mode === 'mixed') {
        try {
          await apiService.triggerVSCUSync();
        } catch (error) {
          console.log('ℹ️ VSCU sync not available');
        }
      }
      
      // Refresh other dashboard data (but lastSync is already set from sync response)
      await fetchDashboardData();
      
      // Re-apply the sync time after fetch (in case it got overwritten)
      if (latestSyncTime) {
        console.log('📅 Re-applying lastSync after fetch:', latestSyncTime);
        setLastSync(latestSyncTime);
      }
      
      if (syncSuccess) {
        Alert.alert('Success', syncMessages.length > 0 
          ? `Device sync completed.\n\n${syncMessages.join('\n')}`
          : 'Device sync completed successfully');
      } else {
        Alert.alert('Partial Success', `Some devices synced with issues:\n\n${syncMessages.join('\n')}`);
      }
    } catch (error) {
      console.error('❌ Error syncing devices:', error);
      Alert.alert('Error', 'Failed to sync devices. Please try again.');
    }
  };

  const handleRetryFailed = async () => {
    try {
      console.log('🔄 Retrying failed invoices...');
      const response = await apiService.retryAllFailed();
      
      if (response.success) {
        Alert.alert('Success', 'Failed invoices queued for retry');
        await fetchDashboardData(); // Refresh data
      } else {
        Alert.alert('Error', response.message || 'Failed to retry invoices');
      }
    } catch (error) {
      console.error('❌ Error retrying failed invoices:', error);
      Alert.alert('Error', 'Failed to retry invoices. Please try again.');
    }
  };

  const handleRetryInvoice = async (invoiceId: string) => {
    try {
      console.log('🔄 Retrying invoice:', invoiceId);
      const response = await apiService.resyncInvoice(invoiceId);
      
      if (response.success) {
        Alert.alert('Success', 'Invoice queued for retry');
        await fetchDashboardData(); // Refresh data
      } else {
        Alert.alert('Error', response.message || 'Failed to retry invoice');
      }
    } catch (error) {
      console.error('❌ Error retrying invoice:', error);
      Alert.alert('Error', 'Failed to retry invoice. Please try again.');
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return 'Good morning';
    } else if (hour >= 12 && hour < 17) {
      return 'Good afternoon';
    } else if (hour >= 17 && hour < 21) {
      return 'Good evening';
    } else {
      return 'Welcome back';
    }
  };

  const getUserDisplayName = () => {
    // Check all possible user name fields from the API response
    if (user) {
      return user.full_name || 
             user.first_name || 
             user.businessName || 
             (user as any).name || 
             (user as any).username || 
             (user as any).company_name || 
             'User';
    }
    return 'User';
  };


  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.userName}>
              {getUserDisplayName()}
            </Text>
          </View>
          <TouchableOpacity style={styles.profileButton}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileInitial}>
                {getUserDisplayName().charAt(0).toUpperCase()}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Icon name="wallet" size={32} color="#000000" />
            <Text style={styles.balanceLabel}>Total Revenue</Text>
          </View>
          <Text style={styles.balanceAmount}>
            KES {dashboardStats?.total_revenue ? Number(dashboardStats.total_revenue).toLocaleString() : '0.00'}
          </Text>
          <View style={styles.balanceActions}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => (navigation as any).navigate('Invoices')}
            >
              <Icon name="file-document-outline" size={16} color="#000000" style={{ marginRight: 4 }} />
              <Text style={styles.actionButtonText}>
                {dashboardStats?.total_invoices || 0} Invoices
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Icon name="trending-up" size={16} color="#000000" style={{ marginRight: 4 }} />
              <Text style={styles.actionButtonText}>
                {dashboardStats?.success_rate || 0}% Success
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Subscription Status Widget */}
        {subscription && (
          <TouchableOpacity 
            style={[
              styles.subscriptionCard,
              subscription.is_trial && styles.subscriptionCardTrial,
              subscription.status === 'expired' && styles.subscriptionCardExpired
            ]}
            onPress={() => (navigation as any).navigate('SubscriptionTab')}
          >
            <View style={styles.subscriptionHeader}>
              <View>
                <Text style={styles.subscriptionPlan}>{subscription.plan_name}</Text>
                <Text style={[
                  styles.subscriptionStatus,
                  { color: subscription.status === 'active' ? '#34C759' : subscription.status === 'trial' ? '#FF9500' : '#FF3B30' }
                ]}>
                  {subscription.status.toUpperCase()}
                  {subscription.is_trial && ` • ${subscription.trial_days_left} days left`}
                </Text>
              </View>
              <Text style={styles.subscriptionPrice}>
                {subscription.price === 0 ? 'FREE' : `${subscription.currency} ${subscription.price.toLocaleString()}`}
              </Text>
            </View>
            
            {subscription.invoices_limit !== -1 && (
              <View style={styles.subscriptionUsage}>
                <View style={styles.usageBar}>
                  <View style={[
                    styles.usageBarFill,
                    { width: `${Math.min((subscription.invoices_used / subscription.invoices_limit) * 100, 100)}%` }
                  ]} />
                </View>
                <Text style={styles.usageText}>
                  {subscription.invoices_used} / {subscription.invoices_limit} invoices used this month
                </Text>
              </View>
            )}
            
            {subscription.is_trial && subscription.trial_days_left <= 3 && (
              <View style={styles.subscriptionWarning}>
                <Text style={styles.warningText}>⚠️ Trial ending soon. Upgrade to continue using all features.</Text>
              </View>
            )}
            
            {subscription.status === 'expired' && (
              <View style={styles.subscriptionExpired}>
                <Text style={styles.expiredText}>❌ Subscription expired. Renew to continue.</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        
        {/* System Status Cards */}
        <View style={styles.statusContainer}>
          <View style={styles.statusCard}>
            <Icon name="server" size={24} color="#000000" style={{ marginBottom: 8 }} />
            <Text style={styles.statusLabel}>Integration Mode</Text>
            <Text style={styles.statusValue}>
              {getIntegrationModeDisplay(dashboardStats?.integration_mode || 'none')}
            </Text>
            <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(dashboardStats?.integration_mode === 'none' ? 'inactive' : 'active') }]} />
          </View>
          
          <View style={styles.statusCard}>
            <Icon name="devices" size={24} color="#000000" style={{ marginBottom: 8 }} />
            <Text style={styles.statusLabel}>Active Devices</Text>
            <Text style={styles.statusValue}>
              {dashboardStats?.active_devices || 0} / {devices.length}
            </Text>
            <TouchableOpacity onPress={handleDeviceRegistration} style={styles.addDeviceButton}>
              <Icon name="plus" size={16} color="#000000" />
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.statusContainer}>
          <TouchableOpacity 
            style={styles.statusCard}
            onPress={() => (navigation as any).navigate('Invoices')}
          >
            <Icon name="refresh" size={24} color="#000000" style={{ marginBottom: 8 }} />
            <Text style={styles.statusLabel}>Retry Queue</Text>
            <Text style={[styles.statusValue, { color: getStatusColor('retry') }]}>
              {retryQueueSize || 0}
            </Text>
            <Text style={styles.statusSubtext}>Invoices pending retry</Text>
          </TouchableOpacity>
          
          <View style={styles.statusCard}>
            <Icon name="sync" size={24} color="#000000" style={{ marginBottom: 8 }} />
            <Text style={styles.statusLabel}>Last Sync</Text>
            <Text style={styles.statusValue}>
              {lastSync ? new Date(lastSync).toLocaleTimeString() : 'Never'}
            </Text>
            <TouchableOpacity onPress={handleSyncDevices} style={styles.syncButton}>
              <Icon name="sync" size={14} color="#000000" style={{ marginRight: 4 }} />
              <Text style={styles.syncButtonText}>Sync</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Quick Actions */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>
        
        <View style={styles.quickActionsContainer}>
          <TouchableOpacity 
            style={styles.quickActionCard}
            onPress={() => (navigation as any).navigate('Invoices', { screen: 'CreateInvoice' })}
          >
            <Icon name="plus-circle" size={32} color="#000000" style={{ marginBottom: 8 }} />
            <Text style={styles.quickActionTitle}>Create Invoice</Text>
            <Text style={styles.quickActionSubtitle}>New transaction</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickActionCard}
            onPress={() => (navigation as any).navigate('Invoices')}
          >
            <Icon name="file-document-multiple" size={32} color="#000000" style={{ marginBottom: 8 }} />
            <Text style={styles.quickActionTitle}>View Invoices</Text>
            <Text style={styles.quickActionSubtitle}>All transactions</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickActionCard}
            onPress={() => (navigation as any).navigate('Reports')}
          >
            <Icon name="chart-bar" size={32} color="#000000" style={{ marginBottom: 8 }} />
            <Text style={styles.quickActionTitle}>Reports</Text>
            <Text style={styles.quickActionSubtitle}>Analytics</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickActionCard}
            onPress={() => (navigation as any).navigate('SettingsTab')}
          >
            <Icon name="cog" size={32} color="#000000" style={{ marginBottom: 8 }} />
            <Text style={styles.quickActionTitle}>Settings</Text>
            <Text style={styles.quickActionSubtitle}>Configuration</Text>
          </TouchableOpacity>
        </View>


        {/* Recent Invoices Header with Search */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Invoices</Text>
          <TouchableOpacity onPress={() => (navigation as any).navigate('Invoices')}>
            <Text style={styles.viewAllText}>View all</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Icon name="magnify" size={20} color="#000000" style={{ marginRight: spacing.sm }} />
          <TextInput
            placeholder="Search invoices..."
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              // Filter invoices based on search
              if (text.trim() === '') {
                setRecentInvoices(allInvoices.slice(0, 10));
              } else {
                const filtered = allInvoices.filter((inv: any) => {
                  const customerName = (inv.customer_name || inv.customerName || '').toLowerCase();
                  const invoiceNo = (inv.invoice_no || inv.invoiceNumber || '').toLowerCase();
                  const receiptNo = (inv.receipt_no || inv.receiptNo || '').toLowerCase();
                  const searchLower = text.toLowerCase();
                  return customerName.includes(searchLower) || 
                         invoiceNo.includes(searchLower) || 
                         receiptNo.includes(searchLower);
                });
                setRecentInvoices(filtered.slice(0, 10));
              }
            }}
            style={styles.searchInput}
            placeholderTextColor={colors.textSecondary}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => {
              setSearchQuery('');
              setRecentInvoices(allInvoices.slice(0, 10));
            }}>
              <Icon name="close-circle" size={20} color="#000000" />
            </TouchableOpacity>
          )}
        </View>

        {/* All Invoices List */}
        <View style={styles.transactionList}>
          {recentInvoices.length > 0 ? (
            recentInvoices.map((invoice, index) => (
              <TouchableOpacity 
                key={invoice.id}
                onPress={() => (navigation as any).navigate('Invoices', { 
                  screen: 'InvoiceDetails', 
                  params: { invoiceId: invoice.id } 
                })}
              >
                <View style={styles.transactionItem}>
                  <View style={styles.transactionIcon}>
                    <View style={[styles.iconCircle, { backgroundColor: getStatusColor(invoice.status) }]}>
                      <Text style={styles.iconText}>
                        {((invoice as any).customer_name || invoice.customerName || 'C').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.transactionDetails}>
                    <Text style={styles.transactionName}>{(invoice as any).customer_name || invoice.customerName || 'Unknown Customer'}</Text>
                    <Text style={styles.transactionDate}>
                      {(invoice as any).created_at ? new Date((invoice as any).created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 
                       invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No date'}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(invoice.status) }]}>
                      <Text style={styles.statusBadgeText}>{invoice.status?.toUpperCase() || 'UNKNOWN'}</Text>
                    </View>
                  </View>
                  <View style={styles.transactionAmount}>
                    <Text style={styles.amountText}>KES {(invoice as any).total_amount ? Number((invoice as any).total_amount).toLocaleString() : 
                      invoice.totalAmount ? invoice.totalAmount.toLocaleString() : '0'}</Text>
                    {((invoice as any).receipt_no) && (
                      <Text style={styles.receiptText}>#{(invoice as any).receipt_no}</Text>
                    )}
                    {invoice.status === 'failed' && (
                      <TouchableOpacity 
                        style={styles.invoiceRetryButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleRetryInvoice(invoice.id);
                        }}
                      >
                        <Text style={styles.invoiceRetryButtonText}>Retry</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                {searchQuery ? 'No invoices found' : 'No invoices yet'}
              </Text>
            </View>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  userName: {
    ...typography.h1,
    color: colors.text,
    fontWeight: '700',
  },
  profileButton: {
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
    ...typography.h2,
    color: colors.secondary,
    fontWeight: '600',
  },
  balanceCard: {
    backgroundColor: colors.primary,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    borderRadius: 16,
    padding: spacing.lg,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  balanceLabel: {
    ...typography.body,
    color: colors.secondary,
    opacity: 0.8,
    fontSize: 16,
    fontWeight: '600',
  },
  balanceAmount: {
    ...typography.h1,
    color: colors.secondary,
    fontWeight: '700',
    marginBottom: spacing.lg,
  },
  balanceActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    ...typography.body,
    color: colors.secondary,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h2,
    color: colors.text,
    fontWeight: '700',
  },
  viewAllText: {
    ...typography.body,
    color: colors.accent,
    fontWeight: '500',
  },
  transactionList: {
    paddingHorizontal: spacing.lg,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  transactionIcon: {
    marginRight: spacing.md,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    ...typography.body,
    color: colors.secondary,
    fontWeight: '600',
  },
  transactionDetails: {
    flex: 1,
  },
  transactionName: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.xs / 2,
  },
  transactionDate: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  emptyStateText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  // Quick Actions Styles
  quickActionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  quickActionCard: {
    width: '48%',
    backgroundColor: colors.card,
    padding: spacing.lg,
    borderRadius: 12,
    marginBottom: spacing.md,
    elevation: 2,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  quickActionTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  quickActionSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  adminActionCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  adminLoginCard: {
    backgroundColor: colors.primary,
    width: '100%',
  },
  // Status and Transaction Styles
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  statusCard: {
    width: '48%',
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: 12,
    position: 'relative',
  },
  statusLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  statusValue: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  statusSubtext: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  statusIndicator: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  addDeviceButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addDeviceText: {
    color: colors.secondary,
    fontWeight: 'bold',
    fontSize: 16,
  },
  syncButton: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.accent,
    borderRadius: 6,
  },
  syncButtonText: {
    ...typography.caption,
    color: colors.secondary,
    fontWeight: '600',
  },
  // Subscription Widget Styles
  subscriptionCard: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.border,
    elevation: 3,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  subscriptionCardTrial: {
    borderColor: '#FF9500',
    backgroundColor: '#FFF8E1',
  },
  subscriptionCardExpired: {
    borderColor: '#FF3B30',
    backgroundColor: '#FFE5E5',
  },
  subscriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  subscriptionPlan: {
    ...typography.h2,
    color: colors.text,
    fontWeight: '700',
    marginBottom: spacing.xs / 2,
  },
  subscriptionStatus: {
    ...typography.caption,
    fontWeight: '600',
  },
  subscriptionPrice: {
    ...typography.h3,
    color: colors.primary,
    fontWeight: '700',
  },
  subscriptionUsage: {
    marginTop: spacing.sm,
  },
  usageBar: {
    height: 8,
    backgroundColor: colors.divider,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  usageBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  usageText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  subscriptionWarning: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9500',
  },
  warningText: {
    ...typography.caption,
    color: '#856404',
    fontWeight: '500',
  },
  subscriptionExpired: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: '#F8D7DA',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF3B30',
  },
  expiredText: {
    ...typography.caption,
    color: '#721C24',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: 12,
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    ...typography.caption,
    color: colors.secondary,
    fontWeight: '600',
    fontSize: 10,
  },
  receiptText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs / 2,
  },
  retryButton: {
    marginTop: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  retryButtonText: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '600',
  },
  invoiceRetryButton: {
    marginTop: spacing.xs,
    paddingVertical: spacing.xs / 2,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  invoiceRetryButtonText: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: '600',
  },
  // Search container styles
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: typography.body.fontSize,
    color: colors.text,
  },
  // Legacy styles for compatibility
  quickAction: {
    width: '48%',
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  quickActionText: {
    ...typography.caption,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});

export default DashboardScreen;

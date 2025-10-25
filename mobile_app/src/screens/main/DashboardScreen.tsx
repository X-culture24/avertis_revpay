import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Card, Button, Chip, Divider } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useRecoilState, useRecoilValue } from 'recoil';
import { useNavigation } from '@react-navigation/native';

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

  const fetchDashboardData = async () => {
    try {
      const response = await apiService.getDashboardStats();
      if (response.success && response.data) {
        setDashboardStats(response.data);
      }

      // Fetch recent invoices
      const invoicesResponse = await apiService.getInvoices(1, 5);
      if (invoicesResponse.success && invoicesResponse.data) {
        setRecentInvoices(invoicesResponse.data.results || []);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
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
    switch (status) {
      case 'SYNCED': return colors.primary;
      case 'PENDING': return colors.textSecondary;
      case 'FAILED': return colors.primary;
      default: return colors.textSecondary;
    }
  };

  const StatCard = ({ title, value, subtitle, icon }: {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: string;
  }) => (
    <Card style={styles.statCard}>
      <Card.Content style={styles.statCardContent}>
        <View style={styles.statHeader}>
          <Ionicons name={icon as any} size={24} color={colors.primary} />
          <Text style={styles.statTitle}>{title}</Text>
        </View>
        <Text style={styles.statValue}>{value}</Text>
        {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
      </Card.Content>
    </Card>
  );

  const QuickActionButton = ({ title, icon, onPress, color = colors.primary }: {
    title: string;
    icon: string;
    onPress: () => void;
    color?: string;
  }) => (
    <TouchableOpacity style={[styles.quickAction, { borderColor: color }]} onPress={onPress}>
      <Ionicons name={icon as any} size={24} color={color} />
      <Text style={[styles.quickActionText, { color }]}>{title}</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Welcome back,</Text>
          <Text style={styles.businessName}>{user?.businessName}</Text>
        </View>
        <View style={styles.integrationStatus}>
          <Chip 
            mode="outlined" 
            style={[styles.modeChip, { borderColor: colors.primary }]}
            textStyle={{ color: colors.primary }}
          >
            {integrationSettings?.mode || 'OSCU'}
          </Chip>
        </View>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={styles.statsRow}>
          <StatCard
            title="Total Invoices"
            value={dashboardStats?.totalInvoices || 0}
            icon="document-text-outline"
          />
          <StatCard
            title="Synced"
            value={dashboardStats?.syncedCount || 0}
            subtitle={`${dashboardStats?.successRate || 0}% success`}
            icon="checkmark-circle-outline"
          />
        </View>
        <View style={styles.statsRow}>
          <StatCard
            title="Pending"
            value={dashboardStats?.pendingCount || 0}
            icon="time-outline"
          />
          <StatCard
            title="Failed"
            value={dashboardStats?.failedCount || 0}
            icon="alert-circle-outline"
          />
        </View>
      </View>

      {/* Monthly Revenue */}
      <Card style={styles.revenueCard}>
        <Card.Content>
          <View style={styles.revenueHeader}>
            <Ionicons name="trending-up-outline" size={24} color={colors.primary} />
            <Text style={styles.revenueTitle}>Monthly Revenue</Text>
          </View>
          <Text style={styles.revenueAmount}>
            KSh {(dashboardStats?.monthlyRevenue || 0).toLocaleString()}
          </Text>
          <Text style={styles.revenueSubtitle}>
            Last sync: {dashboardStats?.lastSyncTime ? 
              new Date(dashboardStats.lastSyncTime).toLocaleString() : 
              'Never'
            }
          </Text>
        </Card.Content>
      </Card>

      {/* Quick Actions */}
      <View style={styles.quickActionsContainer}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          <QuickActionButton
            title="Create Invoice"
            icon="add-circle-outline"
            onPress={() => navigation.navigate('CreateInvoice' as never)}
          />
          <QuickActionButton
            title="Sync VSCU"
            icon="sync-outline"
            onPress={() => {/* Handle VSCU sync */}}
          />
          <QuickActionButton
            title="View Reports"
            icon="bar-chart-outline"
            onPress={() => navigation.navigate('Reports' as never)}
          />
          <QuickActionButton
            title="Settings"
            icon="settings-outline"
            onPress={() => navigation.navigate('Settings' as never)}
          />
        </View>
      </View>

      {/* Recent Invoices */}
      <View style={styles.recentInvoicesContainer}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Invoices</Text>
          <Button
            mode="text"
            onPress={() => navigation.navigate('Invoices' as never)}
            textColor={colors.primary}
            compact
          >
            View All
          </Button>
        </View>
        
        <Card style={styles.invoicesCard}>
          <Card.Content style={styles.invoicesCardContent}>
            {recentInvoices.length > 0 ? (
              recentInvoices.map((invoice, index) => (
                <View key={invoice.id}>
                  <View style={styles.invoiceItem}>
                    <View style={styles.invoiceInfo}>
                      <Text style={styles.invoiceNumber}>#{invoice.invoiceNumber}</Text>
                      <Text style={styles.invoiceCustomer}>{invoice.customerName}</Text>
                      <Text style={styles.invoiceDate}>
                        {new Date(invoice.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                    <View style={styles.invoiceRight}>
                      <Text style={styles.invoiceAmount}>
                        KSh {invoice.totalAmount.toLocaleString()}
                      </Text>
                      <Chip 
                        mode="outlined"
                        style={[styles.statusChip, { borderColor: getStatusColor(invoice.status) }]}
                        textStyle={{ color: getStatusColor(invoice.status), fontSize: 12 }}
                        compact
                      >
                        {invoice.status}
                      </Chip>
                    </View>
                  </View>
                  {index < recentInvoices.length - 1 && <Divider style={styles.divider} />}
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="document-outline" size={48} color={colors.disabled} />
                <Text style={styles.emptyStateText}>No invoices yet</Text>
                <Button
                  mode="outlined"
                  onPress={() => navigation.navigate('CreateInvoice' as never)}
                  style={styles.emptyStateButton}
                  buttonColor={colors.background}
                  textColor={colors.primary}
                >
                  Create Your First Invoice
                </Button>
              </View>
            )}
          </Card.Content>
        </Card>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.md,
    paddingTop: spacing.lg,
  },
  welcomeText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  businessName: {
    ...typography.h2,
    marginTop: spacing.xs,
  },
  integrationStatus: {
    alignItems: 'flex-end',
  },
  modeChip: {
    backgroundColor: colors.background,
  },
  statsContainer: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  statCard: {
    flex: 1,
    marginHorizontal: spacing.xs,
    backgroundColor: colors.card,
    elevation: 1,
  },
  statCardContent: {
    padding: spacing.md,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statTitle: {
    ...typography.caption,
    marginLeft: spacing.sm,
    color: colors.textSecondary,
  },
  statValue: {
    ...typography.h2,
    marginBottom: spacing.xs,
  },
  statSubtitle: {
    ...typography.small,
    color: colors.textSecondary,
  },
  revenueCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.card,
    elevation: 1,
  },
  revenueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  revenueTitle: {
    ...typography.body,
    marginLeft: spacing.sm,
    fontWeight: '600',
  },
  revenueAmount: {
    ...typography.h1,
    marginBottom: spacing.xs,
  },
  revenueSubtitle: {
    ...typography.small,
    color: colors.textSecondary,
  },
  quickActionsContainer: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
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
  recentInvoicesContainer: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  invoicesCard: {
    backgroundColor: colors.card,
    elevation: 1,
  },
  invoicesCardContent: {
    padding: 0,
  },
  invoiceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  invoiceInfo: {
    flex: 1,
  },
  invoiceNumber: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  invoiceCustomer: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  invoiceDate: {
    ...typography.small,
    color: colors.textSecondary,
  },
  invoiceRight: {
    alignItems: 'flex-end',
  },
  invoiceAmount: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  statusChip: {
    backgroundColor: colors.background,
  },
  divider: {
    backgroundColor: colors.border,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyStateText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  emptyStateButton: {
    borderColor: colors.primary,
  },
});

export default DashboardScreen;

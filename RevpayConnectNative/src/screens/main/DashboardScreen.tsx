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
} from 'react-native';
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
        setDashboardStats(response.data as DashboardStats);
      }

      // Fetch recent invoices
      const invoicesResponse = await apiService.getInvoices(1, 5);
      if (invoicesResponse.success && invoicesResponse.data && typeof invoicesResponse.data === 'object' && invoicesResponse.data !== null && 'results' in invoicesResponse.data) {
        setRecentInvoices((invoicesResponse.data as any).results || []);
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
            <Text style={styles.greeting}>Good morning</Text>
            <Text style={styles.userName}>{user?.businessName || 'User'}</Text>
          </View>
          <TouchableOpacity style={styles.profileButton}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileInitial}>
                {(user?.businessName || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Total Revenue</Text>
          <Text style={styles.balanceAmount}>
            KES {dashboardStats?.total_revenue ? Number(dashboardStats.total_revenue).toLocaleString() : '0.00'}
          </Text>
          <View style={styles.balanceActions}>
            <TouchableOpacity style={styles.actionButton}>
              <Text style={styles.actionButtonText}>
                {dashboardStats?.total_invoices || 0} Invoices
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Text style={styles.actionButtonText}>
                {dashboardStats?.success_rate || 0}% Success
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Activity Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <TouchableOpacity>
            <Text style={styles.viewAllText}>View all</Text>
          </TouchableOpacity>
        </View>

        {/* Transaction List */}
        <View style={styles.transactionList}>
          {recentInvoices.length > 0 ? (
            recentInvoices.map((invoice, index) => (
              <TouchableOpacity key={invoice.id} style={styles.transactionItem}>
                <View style={styles.transactionIcon}>
                  <View style={[styles.iconCircle, { backgroundColor: invoice.status === 'SYNCED' ? '#34C759' : '#FF9500' }]}>
                    <Text style={styles.iconText}>
                      {invoice.customerName ? invoice.customerName.charAt(0).toUpperCase() : 'C'}
                    </Text>
                  </View>
                </View>
                <View style={styles.transactionDetails}>
                  <Text style={styles.transactionName}>{invoice.customerName || 'Unknown Customer'}</Text>
                  <Text style={styles.transactionDate}>
                    {invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No date'}
                  </Text>
                </View>
                <View style={styles.transactionAmount}>
                  <Text style={styles.amountText}>KES {invoice.totalAmount ? invoice.totalAmount.toLocaleString() : '0'}</Text>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No recent invoices</Text>
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
  balanceLabel: {
    ...typography.body,
    color: colors.secondary,
    opacity: 0.8,
    marginBottom: spacing.xs,
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
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
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

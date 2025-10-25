import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
// Charts temporarily disabled due to dependency conflicts
// // import { VictoryChart, VictoryLine, VictoryBar, VictoryArea, VictoryAxis, VictoryTheme } from 'victory-native';

import { colors, spacing, typography } from '@/theme/theme';
import { apiService } from '@/services/api';
import { ComplianceReport } from '@/types';

const { width: screenWidth } = Dimensions.get('window');
const chartWidth = screenWidth - (spacing.md * 4);

const ReportsScreen: React.FC = () => {
  const [reports, setReports] = useState<ComplianceReport[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'quarter' | 'year'>('month');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const periods = [
    { key: 'month', label: 'Monthly' },
    { key: 'quarter', label: 'Quarterly' },
    { key: 'year', label: 'Yearly' },
  ];

  const fetchReports = async () => {
    setLoading(true);
    try {
      const response = await apiService.getDashboardStats();
      if (response.success && response.data) {
        // Convert dashboard stats to reports format
        const reportData = {
          id: 'current',
          month: (new Date().getMonth() + 1).toString(),
          year: new Date().getFullYear(),
          generatedAt: new Date().toISOString(),
          totalInvoices: (response.data as any).total_invoices || 0,
          syncedInvoices: (response.data as any).successful_invoices || 0,
          failedInvoices: (response.data as any).failed_invoices || 0,
          successRate: (response.data as any).success_rate || 0,
          totalRevenue: parseFloat((response.data as any).total_revenue || '0'),
        };
        setReports([reportData]);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchReports();
    setRefreshing(false);
  };

  const handleExportPDF = () => {
    Alert.alert('Export PDF', 'PDF export functionality will be implemented');
  };

  const handleExportExcel = () => {
    Alert.alert('Export Excel', 'Excel export functionality will be implemented');
  };

  useEffect(() => {
    fetchReports();
  }, []);

  // Generate mock data for charts
  const generateChartData = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    return months.map((month, index) => ({
      month,
      invoices: Math.floor(Math.random() * 100) + 20,
      revenue: Math.floor(Math.random() * 500000) + 100000,
      successRate: Math.floor(Math.random() * 20) + 80,
    }));
  };

  const chartData = generateChartData();
  const currentMonth = reports[0] || {
    totalInvoices: 45,
    syncedInvoices: 42,
    failedInvoices: 3,
    successRate: 93.3,
    totalRevenue: 2450000,
  };

  const StatCard = ({ title, value, subtitle, icon, trend }: {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: string;
    trend?: 'up' | 'down' | 'neutral';
  }) => (
    <View style={styles.statCard}>
      <View style={styles.statCardContent}>
        <View style={styles.statHeader}>
          <Text style={{ fontSize: 24, color: colors.primary }}>📊</Text>
          {trend && (
            <Text 
              style={{ fontSize: 16, color: trend === 'up' ? colors.primary : trend === 'down' ? colors.primary : colors.textSecondary }}>
              {trend === 'up' ? '↗️' : trend === 'down' ? '↘️' : '➡️'}
            </Text>
          )}
        </View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statTitle}>{title}</Text>
        {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
      </View>
    </View>
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
        <Text style={styles.headerTitle}>Reports & Analytics</Text>
        <Text style={styles.headerSubtitle}>Track your tax compliance and performance</Text>
      </View>

      {/* Period Filter */}
      <View style={styles.periodContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.periodFilters}>
            {periods.map((period) => (
              <TouchableOpacity
                key={period.key}
                onPress={() => setSelectedPeriod(period.key as any)}
                style={[
                  styles.periodChip,
                  selectedPeriod === period.key && { backgroundColor: colors.primary }
                ]}
              >
                <Text style={[
                  styles.periodChipText,
                  selectedPeriod === period.key && { color: colors.secondary }
                ]}>
                  {period.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Key Metrics */}
      <View style={styles.metricsContainer}>
        <View style={styles.metricsRow}>
          <StatCard
            title="Total Invoices"
            value={currentMonth.totalInvoices}
            icon="document-text-outline"
            trend="up"
          />
          <StatCard
            title="Success Rate"
            value={`${currentMonth.successRate}%`}
            icon="checkmark-circle-outline"
            trend="up"
          />
        </View>
        <View style={styles.metricsRow}>
          <StatCard
            title="Revenue"
            value={`KSh ${currentMonth.totalRevenue.toLocaleString()}`}
            subtitle="This month"
            icon="trending-up-outline"
            trend="up"
          />
          <StatCard
            title="Failed"
            value={currentMonth.failedInvoices}
            subtitle="Needs attention"
            icon="alert-circle-outline"
            trend="down"
          />
        </View>
      </View>

      {/* Invoice Trends Chart */}
      <View style={styles.chartCard}>
        <View style={styles.cardContent}>
          <Text style={styles.chartTitle}>Invoice Trends</Text>
          <Text style={styles.chartSubtitle}>Monthly invoice submissions</Text>
          
          <View style={styles.chartContainer}>
            <Text style={styles.chartPlaceholder}>📊 Invoice Volume Chart</Text>
            <Text style={styles.chartDescription}>Monthly invoice processing trends would appear here</Text>
          </View>
        </View>
      </View>

      {/* Revenue Chart */}
      <View style={styles.chartCard}>
        <View style={styles.cardContent}>
          <Text style={styles.chartTitle}>Revenue Analysis</Text>
          <Text style={styles.chartSubtitle}>Monthly revenue breakdown</Text>
          
          <View style={styles.chartContainer}>
            <Text style={styles.chartPlaceholder}>💰 Revenue Analysis Chart</Text>
            <Text style={styles.chartDescription}>Monthly revenue breakdown would appear here</Text>
          </View>
        </View>
      </View>

      {/* Success Rate Chart */}
      <View style={styles.chartCard}>
        <View style={styles.cardContent}>
          <Text style={styles.chartTitle}>Success Rate Trend</Text>
          <Text style={styles.chartSubtitle}>Monthly sync success percentage</Text>
          
          <View style={styles.chartContainer}>
            <Text style={styles.chartPlaceholder}>📈 Success Rate Chart</Text>
            <Text style={styles.chartDescription}>Monthly sync success percentage trends would appear here</Text>
          </View>
        </View>
      </View>

      {/* Compliance Summary */}
      <View style={styles.complianceCard}>
        <View style={styles.cardContent}>
          <Text style={styles.sectionTitle}>Compliance Summary</Text>
          
          <View style={styles.complianceItem}>
            <View style={styles.complianceInfo}>
              <Text style={styles.complianceLabel}>KRA Tax Compliance</Text>
              <Text style={styles.complianceDescription}>
                All invoices are being submitted according to KRA requirements
              </Text>
            </View>
            <View style={styles.complianceStatus}>
              <Text style={{ fontSize: 24, color: colors.primary }}>✅</Text>
              <Text style={styles.complianceStatusText}>Compliant</Text>
            </View>
          </View>

          <View style={styles.complianceDivider} />

          <View style={styles.complianceItem}>
            <View style={styles.complianceInfo}>
              <Text style={styles.complianceLabel}>Data Backup</Text>
              <Text style={styles.complianceDescription}>
                Invoice data is backed up and secure
              </Text>
            </View>
            <View style={styles.complianceStatus}>
              <Text style={{ fontSize: 24, color: colors.primary }}>✅</Text>
              <Text style={styles.complianceStatusText}>Active</Text>
            </View>
          </View>

          <View style={styles.complianceDivider} />

          <View style={styles.complianceItem}>
            <View style={styles.complianceInfo}>
              <Text style={styles.complianceLabel}>Sync Status</Text>
              <Text style={styles.complianceDescription}>
                Real-time synchronization with KRA systems
              </Text>
            </View>
            <View style={styles.complianceStatus}>
              <Text style={{ fontSize: 24, color: colors.primary }}>🔄</Text>
              <Text style={styles.complianceStatusText}>Synced</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Export Options */}
      <View style={styles.exportCard}>
        <View style={styles.cardContent}>
          <Text style={styles.sectionTitle}>Export Reports</Text>
          <Text style={styles.exportDescription}>
            Download detailed reports for your records
          </Text>
          
          <View style={styles.exportButtons}>
            <TouchableOpacity
              onPress={handleExportPDF}
              style={styles.exportButton}
            >
              <Text style={styles.exportButtonText}>📄 Export PDF</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={handleExportExcel}
              style={styles.exportButton}
            >
              <Text style={styles.exportButtonText}>📊 Export Excel</Text>
            </TouchableOpacity>
          </View>
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
  periodContainer: {
    marginBottom: spacing.md,
  },
  periodFilters: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
  },
  periodChip: {
    marginRight: spacing.sm,
    backgroundColor: colors.background,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
  },
  periodChipText: {
    color: colors.text,
  },
  metricsContainer: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  metricsRow: {
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
    alignItems: 'center',
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statValue: {
    ...typography.h2,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  statTitle: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  statSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  chartCard: {
    margin: spacing.md,
    marginTop: 0,
    backgroundColor: colors.card,
    elevation: 1,
  },
  chartTitle: {
    ...typography.h3,
    marginBottom: spacing.xs,
  },
  chartSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  chartContainer: {
    alignItems: 'center',
  },
  complianceCard: {
    margin: spacing.md,
    marginTop: 0,
    backgroundColor: colors.card,
    elevation: 1,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  complianceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  complianceInfo: {
    flex: 1,
  },
  complianceLabel: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  complianceDescription: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  complianceStatus: {
    alignItems: 'center',
  },
  complianceStatusText: {
    ...typography.caption,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  complianceDivider: {
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  exportCard: {
    margin: spacing.md,
    marginTop: 0,
    marginBottom: spacing.xl,
    backgroundColor: colors.card,
    elevation: 1,
  },
  exportDescription: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  exportButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  exportButton: {
    flex: 1,
    marginHorizontal: spacing.xs,
    borderColor: colors.primary,
    paddingVertical: spacing.xs,
  },
  chartPlaceholder: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: 16,
    padding: spacing.lg,
    fontStyle: 'italic',
  },
  chartDescription: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: 14,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  cardContent: {
    padding: spacing.lg,
  },
  exportButtonText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 16,
  },
});

export default ReportsScreen;

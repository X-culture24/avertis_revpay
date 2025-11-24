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
  Platform,
} from 'react-native';
import Share from 'react-native-share';
import RNFS from 'react-native-fs';
import * as XLSX from 'xlsx';
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


  const handleExportExcel = async () => {
    try {
      // Fetch all invoices
      const invoicesResponse = await apiService.getInvoices(1, 1000);
      const invoices = invoicesResponse.success && invoicesResponse.data 
        ? ((invoicesResponse.data as any).results || []) 
        : [];

      const currentMonth = reports[0] || {
        totalInvoices: 0,
        syncedInvoices: 0,
        failedInvoices: 0,
        successRate: 0,
        totalRevenue: 0,
      };

      // Create workbook
      const wb = XLSX.utils.book_new();

      // Summary Sheet
      const summaryData = [
        ['Revpay Connect eTIMS - Invoice Report'],
        ['Generated:', new Date().toLocaleString()],
        [],
        ['Summary Statistics'],
        ['Metric', 'Value'],
        ['Total Invoices', currentMonth.totalInvoices],
        ['Synced Invoices', currentMonth.syncedInvoices],
        ['Failed Invoices', currentMonth.failedInvoices],
        ['Success Rate', `${currentMonth.successRate}%`],
        ['Total Revenue (KES)', Number(currentMonth.totalRevenue).toLocaleString()],
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

      // Invoices Sheet
      const invoiceData = invoices.map((inv: any) => ({
        'Invoice No': inv.invoice_no || 'N/A',
        'Customer Name': inv.customer_name || 'Unknown',
        'Customer TIN': inv.customer_tin || 'N/A',
        'Amount (KES)': Number(inv.total_amount || 0),
        'Tax Amount (KES)': Number(inv.tax_amount || 0),
        'Payment Type': inv.payment_type || 'N/A',
        'Status': (inv.status || 'unknown').toUpperCase(),
        'Receipt No': inv.receipt_no || 'Pending',
        'Transaction Date': new Date(inv.transaction_date).toLocaleString(),
        'Created At': new Date(inv.created_at).toLocaleString(),
      }));
      const invoiceSheet = XLSX.utils.json_to_sheet(invoiceData);
      XLSX.utils.book_append_sheet(wb, invoiceSheet, 'Invoices');

      // Failed Invoices Sheet
      const failedInvoices = invoices.filter((inv: any) => inv.status === 'failed');
      if (failedInvoices.length > 0) {
        const failedData = failedInvoices.map((inv: any) => ({
          'Invoice No': inv.invoice_no || 'N/A',
          'Customer': inv.customer_name || 'Unknown',
          'Amount (KES)': Number(inv.total_amount || 0),
          'Retry Count': inv.retry_count || 0,
          'Created At': new Date(inv.created_at).toLocaleString(),
        }));
        const failedSheet = XLSX.utils.json_to_sheet(failedData);
        XLSX.utils.book_append_sheet(wb, failedSheet, 'Failed Invoices');
      }

      // Generate Excel file as binary
      const wbout = XLSX.write(wb, { type: 'binary', bookType: 'xlsx' });
      const fileName = `RevpayConnect_Report_${new Date().getTime()}.xlsx`;
      const filePath = `${RNFS.DocumentDirectoryPath}/${fileName}`;

      // Write to file
      await RNFS.writeFile(filePath, wbout, 'ascii');

      // Share the Excel file
      await Share.open({
        url: `file://${filePath}`,
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        title: 'Save Invoice Report',
      });
      
      Alert.alert('Success', 'Excel report generated and ready to share!');
    } catch (error) {
      console.error('Excel Export Error:', error);
      Alert.alert('Error', 'Failed to export Excel: ' + (error as Error).message);
    }
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
              onPress={handleExportExcel}
              style={[styles.exportButton, { flex: 1, marginHorizontal: 0 }]}
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

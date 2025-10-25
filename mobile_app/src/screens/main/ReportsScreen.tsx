import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { Card, Button, Chip, Divider } from 'react-native-paper';
import { VictoryChart, VictoryLine, VictoryBar, VictoryArea, VictoryAxis, VictoryTheme } from 'victory-native';
import { Ionicons } from '@expo/vector-icons';

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
    try {
      const response = await apiService.getReports();
      if (response.success && response.data) {
        setReports(response.data);
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
    <Card style={styles.statCard}>
      <Card.Content style={styles.statCardContent}>
        <View style={styles.statHeader}>
          <Ionicons name={icon as any} size={24} color={colors.primary} />
          {trend && (
            <Ionicons 
              name={trend === 'up' ? 'trending-up' : trend === 'down' ? 'trending-down' : 'remove'} 
              size={16} 
              color={trend === 'up' ? colors.primary : trend === 'down' ? colors.primary : colors.textSecondary} 
            />
          )}
        </View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statTitle}>{title}</Text>
        {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
      </Card.Content>
    </Card>
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
        <Text style={styles.headerSubtitle}>Track your eTIMS compliance and performance</Text>
      </View>

      {/* Period Filter */}
      <View style={styles.periodContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.periodFilters}>
            {periods.map((period) => (
              <Chip
                key={period.key}
                mode={selectedPeriod === period.key ? 'flat' : 'outlined'}
                selected={selectedPeriod === period.key}
                onPress={() => setSelectedPeriod(period.key as any)}
                style={[
                  styles.periodChip,
                  selectedPeriod === period.key && { backgroundColor: colors.primary }
                ]}
                textStyle={[
                  styles.periodChipText,
                  selectedPeriod === period.key && { color: colors.secondary }
                ]}
              >
                {period.label}
              </Chip>
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
      <Card style={styles.chartCard}>
        <Card.Content>
          <Text style={styles.chartTitle}>Invoice Trends</Text>
          <Text style={styles.chartSubtitle}>Monthly invoice submissions</Text>
          
          <View style={styles.chartContainer}>
            <VictoryChart
              theme={VictoryTheme.material}
              width={chartWidth}
              height={200}
              padding={{ left: 60, top: 20, right: 40, bottom: 40 }}
            >
              <VictoryAxis
                dependentAxis
                tickFormat={(x) => `${x}`}
                style={{
                  axis: { stroke: colors.border },
                  tickLabels: { fontSize: 12, fill: colors.textSecondary },
                  grid: { stroke: colors.border, strokeWidth: 0.5 }
                }}
              />
              <VictoryAxis
                style={{
                  axis: { stroke: colors.border },
                  tickLabels: { fontSize: 12, fill: colors.textSecondary }
                }}
              />
              <VictoryArea
                data={chartData}
                x="month"
                y="invoices"
                style={{
                  data: { fill: colors.primary, fillOpacity: 0.1, stroke: colors.primary, strokeWidth: 2 }
                }}
                animate={{
                  duration: 1000,
                  onLoad: { duration: 500 }
                }}
              />
            </VictoryChart>
          </View>
        </Card.Content>
      </Card>

      {/* Revenue Chart */}
      <Card style={styles.chartCard}>
        <Card.Content>
          <Text style={styles.chartTitle}>Revenue Analysis</Text>
          <Text style={styles.chartSubtitle}>Monthly revenue breakdown</Text>
          
          <View style={styles.chartContainer}>
            <VictoryChart
              theme={VictoryTheme.material}
              width={chartWidth}
              height={200}
              padding={{ left: 80, top: 20, right: 40, bottom: 40 }}
            >
              <VictoryAxis
                dependentAxis
                tickFormat={(x) => `${x/1000}K`}
                style={{
                  axis: { stroke: colors.border },
                  tickLabels: { fontSize: 12, fill: colors.textSecondary },
                  grid: { stroke: colors.border, strokeWidth: 0.5 }
                }}
              />
              <VictoryAxis
                style={{
                  axis: { stroke: colors.border },
                  tickLabels: { fontSize: 12, fill: colors.textSecondary }
                }}
              />
              <VictoryBar
                data={chartData}
                x="month"
                y="revenue"
                style={{
                  data: { fill: colors.primary }
                }}
                animate={{
                  duration: 1000,
                  onLoad: { duration: 500 }
                }}
              />
            </VictoryChart>
          </View>
        </Card.Content>
      </Card>

      {/* Success Rate Chart */}
      <Card style={styles.chartCard}>
        <Card.Content>
          <Text style={styles.chartTitle}>Success Rate Trend</Text>
          <Text style={styles.chartSubtitle}>Monthly sync success percentage</Text>
          
          <View style={styles.chartContainer}>
            <VictoryChart
              theme={VictoryTheme.material}
              width={chartWidth}
              height={200}
              padding={{ left: 60, top: 20, right: 40, bottom: 40 }}
            >
              <VictoryAxis
                dependentAxis
                tickFormat={(x) => `${x}%`}
                domain={[0, 100]}
                style={{
                  axis: { stroke: colors.border },
                  tickLabels: { fontSize: 12, fill: colors.textSecondary },
                  grid: { stroke: colors.border, strokeWidth: 0.5 }
                }}
              />
              <VictoryAxis
                style={{
                  axis: { stroke: colors.border },
                  tickLabels: { fontSize: 12, fill: colors.textSecondary }
                }}
              />
              <VictoryLine
                data={chartData}
                x="month"
                y="successRate"
                style={{
                  data: { stroke: colors.primary, strokeWidth: 3 }
                }}
                animate={{
                  duration: 1000,
                  onLoad: { duration: 500 }
                }}
              />
            </VictoryChart>
          </View>
        </Card.Content>
      </Card>

      {/* Compliance Summary */}
      <Card style={styles.complianceCard}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Compliance Summary</Text>
          
          <View style={styles.complianceItem}>
            <View style={styles.complianceInfo}>
              <Text style={styles.complianceLabel}>KRA eTIMS Compliance</Text>
              <Text style={styles.complianceDescription}>
                All invoices are being submitted according to KRA requirements
              </Text>
            </View>
            <View style={styles.complianceStatus}>
              <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
              <Text style={styles.complianceStatusText}>Compliant</Text>
            </View>
          </View>

          <Divider style={styles.complianceDivider} />

          <View style={styles.complianceItem}>
            <View style={styles.complianceInfo}>
              <Text style={styles.complianceLabel}>Data Backup</Text>
              <Text style={styles.complianceDescription}>
                Invoice data is backed up and secure
              </Text>
            </View>
            <View style={styles.complianceStatus}>
              <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
              <Text style={styles.complianceStatusText}>Active</Text>
            </View>
          </View>

          <Divider style={styles.complianceDivider} />

          <View style={styles.complianceItem}>
            <View style={styles.complianceInfo}>
              <Text style={styles.complianceLabel}>Sync Status</Text>
              <Text style={styles.complianceDescription}>
                Real-time synchronization with KRA systems
              </Text>
            </View>
            <View style={styles.complianceStatus}>
              <Ionicons name="sync-circle" size={24} color={colors.primary} />
              <Text style={styles.complianceStatusText}>Synced</Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Export Options */}
      <Card style={styles.exportCard}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Export Reports</Text>
          <Text style={styles.exportDescription}>
            Download detailed reports for your records
          </Text>
          
          <View style={styles.exportButtons}>
            <Button
              mode="outlined"
              onPress={() => {/* Handle PDF export */}}
              style={styles.exportButton}
              buttonColor={colors.background}
              textColor={colors.primary}
              icon="file-pdf-box"
            >
              Export PDF
            </Button>
            
            <Button
              mode="outlined"
              onPress={() => {/* Handle Excel export */}}
              style={styles.exportButton}
              buttonColor={colors.background}
              textColor={colors.primary}
              icon="file-excel"
            >
              Export Excel
            </Button>
          </View>
        </Card.Content>
      </Card>
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
    ...typography.small,
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
    ...typography.small,
    color: colors.textSecondary,
  },
  complianceStatus: {
    alignItems: 'center',
  },
  complianceStatusText: {
    ...typography.small,
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
});

export default ReportsScreen;

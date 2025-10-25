import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Card, Chip, FAB, Searchbar, Button } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useRecoilState } from 'recoil';

import { colors, spacing, typography } from '@/theme/theme';
import { invoicesState } from '@/store/atoms';
import { apiService } from '@/services/api';
import { Invoice } from '@/types';

const InvoicesScreen: React.FC = () => {
  const navigation = useNavigation();
  const [invoices, setInvoices] = useRecoilState(invoicesState);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [refreshing, setRefreshing] = useState(false);

  const statusFilters = ['ALL', 'PENDING', 'SUBMITTED', 'SYNCED', 'FAILED'];

  const fetchInvoices = async () => {
    setInvoices(prev => ({ ...prev, loading: true }));
    try {
      const response = await apiService.getInvoices();
      if (response.success && response.data) {
        setInvoices({
          invoices: response.data.results || [],
          loading: false,
          error: null,
        });
      }
    } catch (error) {
      setInvoices(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to fetch invoices',
      }));
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchInvoices();
    setRefreshing(false);
  };

  const handleResync = async (invoiceId: string) => {
    try {
      const response = await apiService.resyncInvoice(invoiceId);
      if (response.success) {
        await fetchInvoices(); // Refresh the list
      }
    } catch (error) {
      console.error('Error resyncing invoice:', error);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SYNCED': return colors.primary;
      case 'PENDING': return colors.textSecondary;
      case 'SUBMITTED': return colors.accent;
      case 'FAILED': return colors.primary;
      default: return colors.textSecondary;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SYNCED': return 'checkmark-circle';
      case 'PENDING': return 'time';
      case 'SUBMITTED': return 'arrow-up-circle';
      case 'FAILED': return 'alert-circle';
      default: return 'help-circle';
    }
  };

  const filteredInvoices = invoices.invoices.filter(invoice => {
    const matchesSearch = invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         invoice.customerName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'ALL' || invoice.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const renderInvoiceItem = ({ item }: { item: Invoice }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate('InvoiceDetails' as never, { invoiceId: item.id } as never)}
    >
      <Card style={styles.invoiceCard}>
        <Card.Content style={styles.invoiceCardContent}>
          <View style={styles.invoiceHeader}>
            <View style={styles.invoiceInfo}>
              <Text style={styles.invoiceNumber}>#{item.invoiceNumber}</Text>
              <Text style={styles.customerName}>{item.customerName}</Text>
            </View>
            <View style={styles.invoiceStatus}>
              <Chip
                mode="outlined"
                icon={getStatusIcon(item.status)}
                style={[styles.statusChip, { borderColor: getStatusColor(item.status) }]}
                textStyle={{ color: getStatusColor(item.status), fontSize: 12 }}
                compact
              >
                {item.status}
              </Chip>
            </View>
          </View>

          <View style={styles.invoiceDetails}>
            <View style={styles.invoiceAmount}>
              <Text style={styles.amountLabel}>Total Amount</Text>
              <Text style={styles.amountValue}>KSh {item.totalAmount.toLocaleString()}</Text>
            </View>
            <View style={styles.invoiceDate}>
              <Text style={styles.dateLabel}>Created</Text>
              <Text style={styles.dateValue}>
                {new Date(item.createdAt).toLocaleDateString()}
              </Text>
            </View>
          </View>

          <View style={styles.invoiceActions}>
            <Text style={styles.integrationMode}>
              {item.integrationMode} • {item.items?.length || 0} items
            </Text>
            {item.status === 'FAILED' && (
              <Button
                mode="outlined"
                onPress={() => handleResync(item.id)}
                compact
                buttonColor={colors.background}
                textColor={colors.primary}
                style={styles.resyncButton}
              >
                Retry
              </Button>
            )}
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="document-outline" size={64} color={colors.disabled} />
      <Text style={styles.emptyStateTitle}>No invoices found</Text>
      <Text style={styles.emptyStateSubtitle}>
        {searchQuery || filterStatus !== 'ALL' 
          ? 'Try adjusting your search or filter'
          : 'Create your first invoice to get started'
        }
      </Text>
      {!searchQuery && filterStatus === 'ALL' && (
        <Button
          mode="contained"
          onPress={() => navigation.navigate('CreateInvoice' as never)}
          style={styles.emptyStateButton}
          buttonColor={colors.primary}
          textColor={colors.secondary}
        >
          Create Invoice
        </Button>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Invoices</Text>
        <Text style={styles.headerSubtitle}>
          {filteredInvoices.length} of {invoices.invoices.length} invoices
        </Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Search invoices..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
          inputStyle={styles.searchInput}
          iconColor={colors.textSecondary}
        />
      </View>

      {/* Status Filters */}
      <View style={styles.filtersContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={statusFilters}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <Chip
              mode={filterStatus === item ? 'flat' : 'outlined'}
              selected={filterStatus === item}
              onPress={() => setFilterStatus(item)}
              style={[
                styles.filterChip,
                filterStatus === item && { backgroundColor: colors.primary }
              ]}
              textStyle={[
                styles.filterChipText,
                filterStatus === item && { color: colors.secondary }
              ]}
            >
              {item}
            </Chip>
          )}
          contentContainerStyle={styles.filtersContent}
        />
      </View>

      {/* Invoices List */}
      <FlatList
        data={filteredInvoices}
        keyExtractor={(item) => item.id}
        renderItem={renderInvoiceItem}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />

      {/* FAB */}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => navigation.navigate('CreateInvoice' as never)}
        color={colors.secondary}
        customSize={56}
      />
    </View>
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
  searchContainer: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  searchbar: {
    backgroundColor: colors.surface,
    elevation: 0,
  },
  searchInput: {
    color: colors.text,
  },
  filtersContainer: {
    marginBottom: spacing.md,
  },
  filtersContent: {
    paddingHorizontal: spacing.md,
  },
  filterChip: {
    marginRight: spacing.sm,
    backgroundColor: colors.background,
    borderColor: colors.border,
  },
  filterChipText: {
    color: colors.text,
  },
  listContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
  },
  invoiceCard: {
    marginBottom: spacing.md,
    backgroundColor: colors.card,
    elevation: 1,
  },
  invoiceCardContent: {
    padding: spacing.md,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  invoiceInfo: {
    flex: 1,
  },
  invoiceNumber: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  customerName: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  invoiceStatus: {
    alignItems: 'flex-end',
  },
  statusChip: {
    backgroundColor: colors.background,
  },
  invoiceDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  invoiceAmount: {
    flex: 1,
  },
  amountLabel: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  amountValue: {
    ...typography.body,
    fontWeight: '600',
  },
  invoiceDate: {
    alignItems: 'flex-end',
  },
  dateLabel: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  dateValue: {
    ...typography.caption,
  },
  invoiceActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  integrationMode: {
    ...typography.small,
    color: colors.textSecondary,
  },
  resyncButton: {
    borderColor: colors.primary,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyStateTitle: {
    ...typography.h3,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyStateSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  emptyStateButton: {
    marginTop: spacing.md,
  },
  fab: {
    position: 'absolute',
    margin: spacing.md,
    right: 0,
    bottom: 0,
    backgroundColor: colors.primary,
  },
});

export default InvoicesScreen;

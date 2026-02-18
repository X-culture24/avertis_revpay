import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '@/types';
import { useRecoilState } from 'recoil';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { colors, spacing, typography } from '@/theme/theme';
import { invoicesState } from '@/store/atoms';
import { apiService } from '@/services/api';
import { Invoice } from '@/types';

type InvoicesScreenNavigationProp = StackNavigationProp<RootStackParamList, 'InvoicesList'>;

const InvoicesScreen: React.FC = () => {
  const navigation = useNavigation<InvoicesScreenNavigationProp>();
  const [invoices, setInvoices] = useRecoilState(invoicesState);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [refreshing, setRefreshing] = useState(false);

  const statusFilters = ['ALL', 'PENDING', 'SUBMITTED', 'SYNCED', 'FAILED'];

  const fetchInvoices = async () => {
    setInvoices(prev => ({ ...prev, loading: true }));
    try {
      console.log('📋 Fetching invoices...');
      const response = await apiService.getInvoices();
      console.log('📋 Invoices response:', response);
      
      if (response.success && response.data) {
        // Handle Django paginated response structure
        const invoicesData = (response.data as any).results || response.data;
        console.log('📋 Invoices data:', invoicesData);
        console.log('📋 Number of invoices:', Array.isArray(invoicesData) ? invoicesData.length : 0);
        
        setInvoices({
          invoices: Array.isArray(invoicesData) ? invoicesData : [],
          loading: false,
          error: null,
        });
      } else {
        console.error('📋 Failed to fetch invoices:', response.message);
        setInvoices(prev => ({
          ...prev,
          loading: false,
          error: 'Failed to fetch invoices',
        }));
      }
    } catch (error) {
      console.error('📋 Error fetching invoices:', error);
      setInvoices(prev => ({
        ...prev,
        loading: false,
        error: 'Network error occurred',
      }));
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchInvoices().finally(() => setRefreshing(false));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SYNCED':
        return colors.success;
      case 'PENDING':
        return colors.warning;
      case 'FAILED':
        return colors.error;
      default:
        return colors.textSecondary;
    }
  };

  const getStatusText = (status: string) => {
    // Map backend status values to display values
    const statusMap: { [key: string]: string } = {
      'pending': 'PENDING',
      'submitted': 'SUBMITTED',
      'confirmed': 'SYNCED',
      'failed': 'FAILED',
      'retry': 'PENDING',
    };
    return statusMap[status?.toLowerCase()] || status?.toUpperCase() || 'UNKNOWN';
  };

  const filteredInvoices = (invoices.invoices || []).filter((invoice: any) => {
    const customerName = invoice.customer_name || invoice.customerName || '';
    const invoiceNumber = invoice.invoice_no || invoice.invoiceNumber || '';
    const matchesSearch = customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Map filter status to backend status values
    let statusToMatch = filterStatus;
    if (filterStatus === 'SYNCED') statusToMatch = 'confirmed';
    if (filterStatus === 'PENDING') statusToMatch = 'pending';
    if (filterStatus === 'FAILED') statusToMatch = 'failed';
    
    const matchesFilter = filterStatus === 'ALL' || 
                         invoice.status?.toLowerCase() === statusToMatch.toLowerCase();
    return matchesSearch && matchesFilter;
  });

  const renderInvoiceItem = ({ item }: { item: any }) => {
    const invoiceNumber = item.invoice_no || item.invoiceNumber || 'N/A';
    const customerName = item.customer_name || item.customerName || 'Unknown Customer';
    const totalAmount = item.total_amount || item.totalAmount || 0;
    const createdAt = item.created_at || item.createdAt;
    const integrationMode = item.integration_mode || item.integrationMode;
    
    return (
      <TouchableOpacity
        onPress={() => navigation.navigate('InvoiceDetails', { invoiceId: item.id })}
      >
        <View style={styles.invoiceCard}>
          <View style={styles.cardContent}>
            <View style={styles.invoiceHeader}>
              <View style={styles.invoiceInfo}>
                <Text style={styles.invoiceNumber}>#{invoiceNumber}</Text>
                <Text style={styles.customerName}>{customerName}</Text>
              </View>
              <View style={styles.invoiceAmount}>
                <Text style={styles.amount}>KSh {parseFloat(totalAmount).toLocaleString()}</Text>
                <View style={styles.statusChip}>
                  <Text style={styles.statusText}>
                    {getStatusText(item.status)}
                  </Text>
                </View>
              </View>
            </View>
            
            <View style={styles.invoiceFooter}>
              <Text style={styles.dateText}>
                {createdAt ? new Date(createdAt).toLocaleDateString() : 'No date'}
              </Text>
              {integrationMode && (
                <Text style={styles.modeText}>{integrationMode}</Text>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateTitle}>No invoices found</Text>
      <Text style={styles.emptyStateSubtitle}>
        {searchQuery || filterStatus !== 'ALL' 
          ? 'Try adjusting your search or filter'
          : 'Create your first invoice to get started'
        }
      </Text>
      {!searchQuery && filterStatus === 'ALL' && (
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => navigation.navigate('CreateInvoice')}
        >
          <Icon name="plus-circle" size={20} color={colors.background} style={{ marginRight: spacing.sm }} />
          <Text style={styles.createButtonText}>Create Invoice</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Invoices</Text>
        
        {/* Search - Custom TextInput to replace Searchbar */}
        <View style={styles.searchContainer}>
          <Icon name="magnify" size={20} color="#000000" style={{ marginRight: spacing.sm }} />
          <TextInput
            placeholder="Search invoices..."
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={styles.searchInput}
            placeholderTextColor={colors.textSecondary}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="close-circle" size={20} color="#000000" />
            </TouchableOpacity>
          )}
        </View>
        
        {/* Status Filters */}
        <FlatList
          data={statusFilters}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setFilterStatus(item)}
              style={[
                styles.filterChip,
                filterStatus === item && styles.selectedFilterChip
              ]}
            >
              <Text style={[
                styles.filterChipText,
                filterStatus === item && styles.selectedFilterChipText
              ]}>
                {item}
              </Text>
            </TouchableOpacity>
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

      {/* Create Button */}
      <TouchableOpacity
        style={styles.createButton}
        onPress={() => (navigation as any).navigate('CreateInvoice')}
      >
        <Icon name="plus-circle" size={20} color={colors.background} style={{ marginRight: spacing.sm }} />
        <Text style={styles.createButtonText}>Create Invoice</Text>
      </TouchableOpacity>
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
    ...typography.h1,
    marginBottom: spacing.md,
    color: colors.text,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
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
  filtersContent: {
    paddingHorizontal: spacing.xs,
  },
  filterChip: {
    marginHorizontal: spacing.xs,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedFilterChip: {
    backgroundColor: colors.primary,
  },
  filterChipText: {
    color: colors.text,
  },
  selectedFilterChipText: {
    color: colors.secondary,
  },
  listContainer: {
    padding: spacing.md,
    paddingTop: 0,
  },
  invoiceCard: {
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  cardContent: {
    padding: spacing.md,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  invoiceInfo: {
    flex: 1,
  },
  invoiceNumber: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  customerName: {
    ...typography.body,
    color: colors.textSecondary,
  },
  invoiceAmount: {
    alignItems: 'flex-end',
  },
  amount: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  statusChip: {
    height: 24,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  invoiceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  dateText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  modeText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  emptyStateTitle: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  createButton: {
    margin: spacing.md,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  createButtonText: {
    color: colors.background,
    fontSize: typography.body.fontSize,
    fontWeight: 'bold',
  },
});

export default InvoicesScreen;

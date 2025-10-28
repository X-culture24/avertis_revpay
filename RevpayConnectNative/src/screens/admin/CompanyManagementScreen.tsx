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
  TextInput,
  Picker,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { colors, spacing, typography } from '@/theme/theme';
import { apiService } from '@/services/api';

type CompanyManagementScreenNavigationProp = StackNavigationProp<any, 'CompanyManagement'>;

interface Company {
  id: string;
  company_name: string;
  tin: string;
  contact_person: string;
  contact_email: string;
  contact_phone: string;
  business_address: string;
  business_type: string;
  status: string;
  is_sandbox: boolean;
  onboarding_date: string;
  subscription_plan: string;
  device_count?: number;
  active_devices?: number;
}

const CompanyManagementScreen: React.FC = () => {
  const navigation = useNavigation<CompanyManagementScreenNavigationProp>();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [filteredCompanies, setFilteredCompanies] = useState<Company[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchCompanies();
  }, []);

  useEffect(() => {
    filterCompanies();
  }, [companies, searchQuery, statusFilter]);

  const fetchCompanies = async () => {
    try {
      const response = await apiService.getCompanies();
      if (response.success && response.data) {
        setCompanies(response.data);
      } else {
        Alert.alert('Error', 'Failed to fetch companies');
      }
    } catch (error) {
      console.error('Error fetching companies:', error);
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCompanies();
  };

  const filterCompanies = () => {
    let filtered = companies;

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(company =>
        company.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        company.tin.includes(searchQuery) ||
        company.contact_email.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(company => company.status === statusFilter);
    }

    setFilteredCompanies(filtered);
  };

  const handleUpdateCompanyStatus = async (companyId: string, newStatus: string) => {
    try {
      const response = await apiService.updateCompanyStatus(companyId, newStatus);
      
      if (response.success) {
        Alert.alert('Success', `Company status updated to ${newStatus}`);
        await fetchCompanies(); // Refresh data
      } else {
        Alert.alert('Error', response.message || 'Failed to update company status');
      }
    } catch (error) {
      console.error('Update status error:', error);
      Alert.alert('Error', 'Failed to update company status');
    }
  };

  const showStatusUpdateOptions = (company: Company) => {
    const statusOptions = [
      { label: 'Active', value: 'active' },
      { label: 'Inactive', value: 'inactive' },
      { label: 'Suspended', value: 'suspended' },
      { label: 'Pending Approval', value: 'pending_approval' },
    ];

    const buttons = statusOptions
      .filter(option => option.value !== company.status)
      .map(option => ({
        text: option.label,
        onPress: () => handleUpdateCompanyStatus(company.id, option.value)
      }));

    buttons.push({ text: 'Cancel', onPress: () => {}, style: 'cancel' });

    Alert.alert(
      'Update Company Status',
      `Current status: ${company.status}`,
      buttons
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#34C759';
      case 'inactive': return '#8E8E93';
      case 'suspended': return '#FF3B30';
      case 'pending_approval': return '#FF9500';
      default: return colors.textSecondary;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return '✅';
      case 'inactive': return '⚫';
      case 'suspended': return '🚫';
      case 'pending_approval': return '⏳';
      default: return '❓';
    }
  };

  const renderCompanyCard = (company: Company) => (
    <View key={company.id} style={styles.companyCard}>
      <View style={styles.companyHeader}>
        <View style={styles.companyInfo}>
          <Text style={styles.companyName}>{company.company_name}</Text>
          <Text style={styles.companyTin}>TIN: {company.tin}</Text>
        </View>
        <View style={styles.statusBadge}>
          <Text style={styles.statusIcon}>{getStatusIcon(company.status)}</Text>
          <Text style={[styles.statusText, { color: getStatusColor(company.status) }]}>
            {company.status}
          </Text>
        </View>
      </View>

      <View style={styles.companyDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Contact:</Text>
          <Text style={styles.detailValue}>{company.contact_person}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Email:</Text>
          <Text style={styles.detailValue}>{company.contact_email}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Phone:</Text>
          <Text style={styles.detailValue}>{company.contact_phone}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Business Type:</Text>
          <Text style={styles.detailValue}>{company.business_type || 'Not specified'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Environment:</Text>
          <Text style={styles.detailValue}>{company.is_sandbox ? 'Sandbox' : 'Production'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Onboarded:</Text>
          <Text style={styles.detailValue}>
            {new Date(company.onboarding_date).toLocaleDateString()}
          </Text>
        </View>
        {company.device_count !== undefined && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Devices:</Text>
            <Text style={styles.detailValue}>
              {company.active_devices || 0} / {company.device_count} active
            </Text>
          </View>
        )}
      </View>

      <View style={styles.companyActions}>
        <TouchableOpacity
          onPress={() => navigation.navigate('CompanyDetails', { companyId: company.id })}
          style={[styles.actionButton, styles.primaryButton]}
        >
          <Text style={styles.primaryButtonText}>View Details</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => showStatusUpdateOptions(company)}
          style={[styles.actionButton, styles.secondaryButton]}
        >
          <Text style={styles.secondaryButtonText}>Update Status</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate('DeviceRegistration', { companyId: company.id })}
          style={[styles.actionButton, styles.tertiaryButton]}
        >
          <Text style={styles.tertiaryButtonText}>Add Device</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading companies...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Company Management</Text>
        <Text style={styles.subtitle}>Manage registered companies and devices</Text>
      </View>

      <View style={styles.filtersContainer}>
        <View style={styles.searchContainer}>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
            placeholder="Search companies..."
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        <View style={styles.filterContainer}>
          <Picker
            selectedValue={statusFilter}
            onValueChange={setStatusFilter}
            style={styles.filterPicker}
          >
            <Picker.Item label="All Status" value="all" />
            <Picker.Item label="Active" value="active" />
            <Picker.Item label="Inactive" value="inactive" />
            <Picker.Item label="Suspended" value="suspended" />
            <Picker.Item label="Pending Approval" value="pending_approval" />
          </Picker>
        </View>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{companies.length}</Text>
          <Text style={styles.statLabel}>Total Companies</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {companies.filter(c => c.status === 'active').length}
          </Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {companies.filter(c => c.status === 'pending_approval').length}
          </Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
      </View>

      <ScrollView
        style={styles.companiesContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredCompanies.length > 0 ? (
          filteredCompanies.map(renderCompanyCard)
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchQuery || statusFilter !== 'all' 
                ? 'No companies match your filters' 
                : 'No companies registered yet'
              }
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.fabContainer}>
        <TouchableOpacity
          onPress={() => navigation.navigate('CompanyOnboarding')}
          style={styles.fab}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
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
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  searchContainer: {
    flex: 2,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    backgroundColor: colors.card,
    color: colors.text,
    fontSize: 16,
  },
  filterContainer: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.card,
  },
  filterPicker: {
    color: colors.text,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: spacing.md,
    marginHorizontal: spacing.xs,
    borderRadius: 8,
    elevation: 2,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statValue: {
    ...typography.h3,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  companiesContainer: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  companyCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.md,
    elevation: 4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  companyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  companyInfo: {
    flex: 1,
  },
  companyName: {
    ...typography.h4,
    marginBottom: spacing.xs,
  },
  companyTin: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
  },
  statusIcon: {
    fontSize: 16,
    marginRight: spacing.xs,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '600',
  },
  companyDetails: {
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  detailLabel: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textSecondary,
    flex: 1,
  },
  detailValue: {
    ...typography.body,
    color: colors.text,
    flex: 2,
    textAlign: 'right',
  },
  companyActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  secondaryButton: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tertiaryButton: {
    backgroundColor: '#34C759',
  },
  primaryButtonText: {
    color: colors.secondary,
    fontWeight: '600',
    fontSize: 14,
  },
  secondaryButtonText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 14,
  },
  tertiaryButtonText: {
    color: colors.secondary,
    fontWeight: '600',
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  fabContainer: {
    position: 'absolute',
    bottom: spacing.lg,
    right: spacing.lg,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabText: {
    fontSize: 24,
    color: colors.secondary,
    fontWeight: 'bold',
  },
});

export default CompanyManagementScreen;

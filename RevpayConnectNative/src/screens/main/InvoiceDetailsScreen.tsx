import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
// Using native React Native components instead of react-native-paper
import { useRoute, useNavigation } from '@react-navigation/native';

import { colors, spacing, typography } from '@/theme/theme';
import { apiService } from '@/services/api';
import { Invoice } from '@/types';

const InvoiceDetailsScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { invoiceId } = route.params as { invoiceId: string };
  
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [resyncing, setResyncing] = useState(false);

  const fetchInvoiceDetails = async () => {
    try {
      console.log('Fetching invoice details for ID:', invoiceId);
      const response = await apiService.getInvoiceDetails(invoiceId);
      console.log('Invoice details response:', response);
      
      if (response.success && response.data) {
        setInvoice(response.data as Invoice);
      } else {
        console.error('Failed to fetch invoice details:', response.message);
        Alert.alert('Error', response.message || 'Failed to load invoice details');
      }
    } catch (error) {
      console.error('Error fetching invoice details:', error);
      Alert.alert('Error', 'Failed to load invoice details. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleResync = async () => {
    if (!invoice) return;
    
    setResyncing(true);
    try {
      const response = await apiService.resyncInvoice(invoice.id);
      if (response.success) {
        Alert.alert('Success', 'Invoice resync initiated successfully');
        await fetchInvoiceDetails(); // Refresh details
      } else {
        Alert.alert('Error', response.message || 'Failed to resync invoice');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setResyncing(false);
    }
  };

  useEffect(() => {
    fetchInvoiceDetails();
  }, [invoiceId]);

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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading invoice details...</Text>
      </View>
    );
  }

  if (!invoice) {
    return (
      <View style={styles.errorContainer}>
        <Text style={{ fontSize: 48, color: colors.textSecondary }}>⚠️</Text>
        <Text style={styles.errorText}>Invoice not found</Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.headerCard}>
        <View style={styles.cardContent}>
          <View style={styles.headerContent}>
            <View style={styles.invoiceInfo}>
              <Text style={styles.invoiceNumber}>#{invoice.invoiceNumber}</Text>
              <Text style={styles.customerName}>{invoice.customerName}</Text>
              {invoice.customerPin && (
                <Text style={styles.customerPin}>PIN: {invoice.customerPin}</Text>
              )}
            </View>
            <View style={styles.statusContainer}>
              <View
                style={[styles.statusChip, { borderColor: getStatusColor(invoice.status) }]}
              >
                <Text style={[styles.statusText, { color: getStatusColor(invoice.status) }]}>
                  {invoice.status}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Invoice Details */}
      <View style={styles.card}>
        <View style={styles.cardContent}>
          <Text style={styles.sectionTitle}>Invoice Information</Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Created:</Text>
            <Text style={styles.detailValue}>
              {new Date(invoice.createdAt).toLocaleString()}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Last Updated:</Text>
            <Text style={styles.detailValue}>
              {new Date(invoice.updatedAt).toLocaleString()}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Integration Mode:</Text>
            <Text style={styles.detailValue}>{invoice.integrationMode}</Text>
          </View>
          
          {invoice.retryCount && invoice.retryCount > 0 && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Retry Count:</Text>
              <Text style={styles.detailValue}>{invoice.retryCount}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Items */}
      <View style={styles.card}>
        <View style={styles.cardContent}>
          <Text style={styles.sectionTitle}>Items ({invoice.items?.length || 0})</Text>
          
          {invoice.items?.map((item, index) => (
            <View key={item.id || index} style={styles.itemContainer}>
              <Text style={styles.itemDescription}>{item.description}</Text>
              <View style={styles.itemDetails}>
                <Text style={styles.itemDetail}>
                  Qty: {item.quantity} × KSh {item.unitPrice.toLocaleString()}
                </Text>
                <Text style={styles.itemDetail}>
                  Tax: {((item.taxRate || 0) * 100).toFixed(0)}%
                </Text>
              </View>
              <Text style={styles.itemTotal}>
                KSh {item.totalAmount.toLocaleString()}
              </Text>
              {index < (invoice.items?.length || 0) - 1 && (
                <View style={styles.itemDivider} />
              )}
            </View>
          ))}
        </View>
      </View>

      {/* Totals */}
      <View style={styles.card}>
        <View style={styles.cardContent}>
          <Text style={styles.sectionTitle}>Summary</Text>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal:</Text>
            <Text style={styles.summaryValue}>
              KSh {invoice.amount.toLocaleString()}
            </Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tax Amount:</Text>
            <Text style={styles.summaryValue}>
              KSh {invoice.taxAmount.toLocaleString()}
            </Text>
          </View>
          
          <View style={styles.summaryDivider} />
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryTotalLabel}>Total Amount:</Text>
            <Text style={styles.summaryTotalValue}>
              KSh {invoice.totalAmount.toLocaleString()}
            </Text>
          </View>
        </View>
      </View>

      {/* Submission Details */}
      {(invoice.jsonPayload || invoice.submissionResponse) && (
        <View style={styles.card}>
          <View style={styles.cardContent}>
            <Text style={styles.sectionTitle}>Submission Details</Text>
            
            {invoice.jsonPayload && (
              <View style={styles.submissionSection}>
                <Text style={styles.submissionLabel}>Request Payload:</Text>
                <View style={styles.codeContainer}>
                  <Text style={styles.codeText}>
                    {JSON.stringify(JSON.parse(invoice.jsonPayload), null, 2)}
                  </Text>
                </View>
              </View>
            )}
            
            {invoice.submissionResponse && (
              <View style={styles.submissionSection}>
                <Text style={styles.submissionLabel}>Response:</Text>
                <View style={styles.codeContainer}>
                  <Text style={styles.codeText}>
                    {JSON.stringify(JSON.parse(invoice.submissionResponse), null, 2)}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actionsContainer}>
        {invoice.status === 'FAILED' && (
          <TouchableOpacity
            onPress={handleResync}
            disabled={resyncing}
            style={[styles.actionButton, styles.primaryButton]}
          >
            <Text style={styles.primaryButtonText}>
              {resyncing ? 'Retrying...' : 'Retry Sync'}
            </Text>
          </TouchableOpacity>
        )}
        
        {invoice.status === 'PENDING' && invoice.integrationMode === 'VSCU' && (
          <TouchableOpacity
            onPress={handleResync}
            disabled={resyncing}
            style={[styles.actionButton, styles.outlinedButton]}
          >
            <Text style={styles.outlinedButtonText}>
              {resyncing ? 'Syncing...' : 'Manual Sync'}
            </Text>
          </TouchableOpacity>
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
    color: colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  errorText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  backButton: {
    borderColor: colors.primary,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: 4,
    alignItems: 'center',
  },
  backButtonText: {
    ...typography.body,
    color: colors.primary,
  },
  headerCard: {
    margin: spacing.md,
    backgroundColor: colors.card,
    elevation: 2,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  invoiceInfo: {
    flex: 1,
  },
  invoiceNumber: {
    ...typography.h2,
    marginBottom: spacing.xs,
  },
  customerName: {
    ...typography.body,
    marginBottom: spacing.xs,
  },
  customerPin: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  statusChip: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '600',
  },
  cardContent: {
    padding: spacing.md,
  },
  card: {
    margin: spacing.md,
    marginTop: 0,
    backgroundColor: colors.card,
    elevation: 1,
  },
  sectionTitle: {
    ...typography.h3,
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
    color: colors.textSecondary,
  },
  detailValue: {
    ...typography.body,
    fontWeight: '500',
  },
  itemContainer: {
    marginBottom: spacing.md,
  },
  itemDescription: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  itemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  itemDetail: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  itemTotal: {
    ...typography.body,
    fontWeight: '600',
    textAlign: 'right',
  },
  itemDivider: {
    marginTop: spacing.md,
    backgroundColor: colors.border,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  summaryLabel: {
    ...typography.body,
  },
  summaryValue: {
    ...typography.body,
    fontWeight: '500',
  },
  summaryDivider: {
    marginVertical: spacing.md,
    backgroundColor: colors.border,
  },
  summaryTotalLabel: {
    ...typography.body,
    fontWeight: '600',
    fontSize: 18,
  },
  summaryTotalValue: {
    ...typography.body,
    fontWeight: '600',
    fontSize: 18,
  },
  submissionSection: {
    marginBottom: spacing.lg,
  },
  submissionLabel: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  codeContainer: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  codeText: {
    ...typography.caption,
    fontFamily: 'monospace',
    color: colors.text,
  },
  actionsContainer: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  actionButton: {
    marginBottom: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 4,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  primaryButtonText: {
    ...typography.body,
    color: colors.secondary,
    fontWeight: '600',
  },
  outlinedButton: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  outlinedButtonText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
});

export default InvoiceDetailsScreen;

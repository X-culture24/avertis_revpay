import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { Card, Button, Chip, Divider } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
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
      const response = await apiService.getInvoiceDetails(invoiceId);
      if (response.success && response.data) {
        setInvoice(response.data);
      }
    } catch (error) {
      console.error('Error fetching invoice details:', error);
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
        <Ionicons name="alert-circle-outline" size={48} color={colors.textSecondary} />
        <Text style={styles.errorText}>Invoice not found</Text>
        <Button
          mode="outlined"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          buttonColor={colors.background}
          textColor={colors.primary}
        >
          Go Back
        </Button>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <Card style={styles.headerCard}>
        <Card.Content>
          <View style={styles.headerContent}>
            <View style={styles.invoiceInfo}>
              <Text style={styles.invoiceNumber}>#{invoice.invoiceNumber}</Text>
              <Text style={styles.customerName}>{invoice.customerName}</Text>
              {invoice.customerPin && (
                <Text style={styles.customerPin}>PIN: {invoice.customerPin}</Text>
              )}
            </View>
            <View style={styles.statusContainer}>
              <Chip
                mode="outlined"
                icon={getStatusIcon(invoice.status)}
                style={[styles.statusChip, { borderColor: getStatusColor(invoice.status) }]}
                textStyle={{ color: getStatusColor(invoice.status) }}
              >
                {invoice.status}
              </Chip>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Invoice Details */}
      <Card style={styles.card}>
        <Card.Content>
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
        </Card.Content>
      </Card>

      {/* Items */}
      <Card style={styles.card}>
        <Card.Content>
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
                <Divider style={styles.itemDivider} />
              )}
            </View>
          ))}
        </Card.Content>
      </Card>

      {/* Totals */}
      <Card style={styles.card}>
        <Card.Content>
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
          
          <Divider style={styles.summaryDivider} />
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryTotalLabel}>Total Amount:</Text>
            <Text style={styles.summaryTotalValue}>
              KSh {invoice.totalAmount.toLocaleString()}
            </Text>
          </View>
        </Card.Content>
      </Card>

      {/* Submission Details */}
      {(invoice.jsonPayload || invoice.submissionResponse) && (
        <Card style={styles.card}>
          <Card.Content>
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
          </Card.Content>
        </Card>
      )}

      {/* Actions */}
      <View style={styles.actionsContainer}>
        {invoice.status === 'FAILED' && (
          <Button
            mode="contained"
            onPress={handleResync}
            loading={resyncing}
            disabled={resyncing}
            style={styles.actionButton}
            buttonColor={colors.primary}
            textColor={colors.secondary}
            icon="sync"
          >
            Retry Sync
          </Button>
        )}
        
        {invoice.status === 'PENDING' && invoice.integrationMode === 'VSCU' && (
          <Button
            mode="outlined"
            onPress={handleResync}
            loading={resyncing}
            disabled={resyncing}
            style={styles.actionButton}
            buttonColor={colors.background}
            textColor={colors.primary}
            icon="cloud-upload"
          >
            Manual Sync
          </Button>
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
    ...typography.small,
    fontFamily: 'monospace',
    color: colors.text,
  },
  actionsContainer: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  actionButton: {
    marginBottom: spacing.sm,
    paddingVertical: spacing.xs,
  },
});

export default InvoiceDetailsScreen;

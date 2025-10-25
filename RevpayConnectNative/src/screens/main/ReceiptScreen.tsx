import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Share,
  TouchableOpacity,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { colors, spacing, typography } from '@/theme/theme';
import { Invoice, MainStackParamList } from '@/types';
import { apiService } from '@/services/api';

type ReceiptScreenRouteProp = RouteProp<MainStackParamList, 'Receipt'>;

const ReceiptScreen: React.FC = () => {
  const route = useRoute<ReceiptScreenRouteProp>();
  const navigation = useNavigation<StackNavigationProp<any>>();
  const { invoiceId } = route.params;
  
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInvoiceDetails();
  }, [invoiceId]);

  const loadInvoiceDetails = async () => {
    try {
      const response = await apiService.getReceiptData(invoiceId);
      if (response.success && response.data) {
        setInvoice(response.data as Invoice);
      } else {
        Alert.alert('Error', 'Failed to load receipt details');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintReceipt = async () => {
    Alert.alert('Print Receipt', 'Print functionality will be implemented');
  };

  const handleShareReceipt = async () => {
    if (!invoice) return;
    
    const receiptText = `
REVPAY CONNECT RECEIPT
=====================

Store Information:
Revpay Connect Business
TIN: N/A

Transaction:
Date: ${new Date(invoice.createdAt).toLocaleString()}
Invoice No: ${invoice.invoiceNumber}
Receipt No: Pending

Customer:
Name: ${invoice.customerName || 'Walk-in Customer'}
PIN: ${invoice.customerPin || 'N/A'}

Items:
${invoice.items?.map(item => 
  `${item.description} - Qty: ${item.quantity} @ KES ${item.unitPrice}`
).join('\n') || 'No items'}

Payment Information:
Payment Method: Cash
Subtotal: KES ${invoice.amount?.toFixed(2)}
Tax Amount: KES ${invoice.taxAmount?.toFixed(2)}
Total Amount: KES ${invoice.totalAmount?.toFixed(2)}

KRA Information:
Status: ${invoice.status}
Internal Data: Available
Receipt Signature: Verified

Thank you for your business!
    `;

    try {
      await Share.share({
        message: receiptText,
        title: 'Receipt - ' + invoice.invoiceNumber,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share receipt');
    }
  };

  const handleNewReceipt = () => {
    navigation.navigate('CreateInvoice');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading receipt...</Text>
      </View>
    );
  }

  if (!invoice) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Receipt not found</Text>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={[styles.actionButton, { backgroundColor: colors.primary, marginTop: 16 }]}
        >
          <Text style={{ color: colors.secondary }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Receipt</Text>
        <Text style={styles.headerSubtitle}>Transaction completed successfully</Text>
      </View>

      {/* Receipt Card */}
      <View style={styles.receiptCard}>
        <View style={styles.receiptContent}>
          {/* Store Information */}
          <View style={styles.section}>
            <Text style={styles.storeName}>REVPAY CONNECT</Text>
            <Text style={styles.storeInfo}>Revpay Connect Business</Text>
            <Text style={styles.storeInfo}>TIN: N/A</Text>
          </View>

          <View style={styles.divider} />

          {/* Transaction Info */}
          <View style={styles.section}>
            <View style={styles.row}>
              <Text style={styles.label}>Date:</Text>
              <Text style={styles.value}>
                {new Date(invoice.createdAt).toLocaleString()}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Invoice No:</Text>
              <Text style={styles.value}>{invoice.invoiceNumber}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Receipt No:</Text>
              <Text style={styles.value}>Pending</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Customer Info */}
          <View style={styles.section}>
            <View style={styles.row}>
              <Text style={styles.label}>Customer:</Text>
              <Text style={styles.value}>{invoice.customerName || 'Walk-in Customer'}</Text>
            </View>
            {invoice.customerPin && (
              <View style={styles.row}>
                <Text style={styles.label}>Customer PIN:</Text>
                <Text style={styles.value}>{invoice.customerPin}</Text>
              </View>
            )}
          </View>

          <View style={styles.divider} />

          {/* Items */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Items</Text>
            {invoice.items?.map((item, index) => (
              <View key={index} style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.description}</Text>
                  <Text style={styles.itemDetails}>
                    Qty: {item.quantity} × KES {item.unitPrice?.toFixed(2)}
                  </Text>
                </View>
                <Text style={styles.itemTotal}>
                  KES {item.totalAmount?.toFixed(2)}
                </Text>
              </View>
            )) || (
              <Text style={styles.noItems}>No items available</Text>
            )}
          </View>

          <View style={styles.divider} />

          {/* Payment Summary */}
          <View style={styles.section}>
            <View style={styles.row}>
              <Text style={styles.label}>Payment Method:</Text>
              <Text style={styles.value}>Cash</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Subtotal:</Text>
              <Text style={styles.value}>KES {invoice.amount?.toFixed(2)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Tax Amount:</Text>
              <Text style={styles.value}>KES {invoice.taxAmount?.toFixed(2)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Amount:</Text>
              <Text style={styles.totalValue}>KES {invoice.totalAmount?.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* KRA Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>KRA Information</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Status:</Text>
              <Text style={[styles.value, { color: invoice.status === 'SYNCED' ? colors.success : colors.warning }]}>
                {invoice.status?.toUpperCase()}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Internal Data:</Text>
              <Text style={styles.value}>Available</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Receipt Signature:</Text>
              <Text style={styles.value}>Verified</Text>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Thank you for your business!</Text>
            <Text style={styles.footerSubtext}>Powered by Revpay Connect</Text>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          onPress={handlePrintReceipt}
          style={[styles.actionButton, { borderWidth: 1, borderColor: colors.primary }]}
        >
          🖨️ Print Receipt
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={handleShareReceipt}
          style={[styles.actionButton, { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.primary }]}
        >
          <Text style={{ color: colors.primary }}>📤 Share Receipt</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={handleNewReceipt}
          style={[styles.actionButton, { backgroundColor: colors.primary }]}
        >
          <Text style={{ color: colors.secondary }}>New Receipt</Text>
        </TouchableOpacity>
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
    ...typography.h2,
    color: colors.error,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  header: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.h1,
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  receiptCard: {
    margin: spacing.md,
    backgroundColor: colors.card,
    elevation: 4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderRadius: 12,
  },
  receiptContent: {
    padding: spacing.lg,
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.sm,
  },
  storeName: {
    ...typography.h2,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  storeInfo: {
    ...typography.body,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  label: {
    ...typography.body,
    color: colors.textSecondary,
    flex: 1,
  },
  value: {
    ...typography.body,
    flex: 1,
    textAlign: 'right',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalLabel: {
    ...typography.h3,
  },
  totalValue: {
    ...typography.h3,
    color: colors.primary,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    ...typography.body,
    marginBottom: spacing.xs,
  },
  itemDetails: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  itemTotal: {
    ...typography.body,
    marginLeft: spacing.md,
  },
  noItems: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  divider: {
    marginVertical: spacing.md,
    backgroundColor: colors.border,
  },
  footer: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  footerText: {
    ...typography.h3,
    marginBottom: spacing.xs,
  },
  footerSubtext: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  actions: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  actionButton: {
    borderRadius: 12,
  },
});

export default ReceiptScreen;

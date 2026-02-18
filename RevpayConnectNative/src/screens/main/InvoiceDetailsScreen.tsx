import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Share,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
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
  const [exportingPDF, setExportingPDF] = useState(false);

  const fetchInvoiceDetails = async () => {
    try {
      console.log('Fetching invoice details for ID:', invoiceId);
      const response = await apiService.getInvoiceDetails(invoiceId);
      console.log('Invoice details response:', response);
      
      if (response.success && response.data) {
        // Handle API response format compatibility
        const invoiceData = response.data as any;
        const normalizedInvoice = {
          ...invoiceData,
          id: invoiceData.id || invoiceData.invoice_id || invoiceId,
          invoiceNumber: invoiceData.invoice_no || invoiceData.invoiceNumber || 'N/A',
          customerName: invoiceData.customer_name || invoiceData.customerName || 'Unknown Customer',
          customerPin: invoiceData.customer_tin || invoiceData.customerPin || '',
          amount: parseFloat(invoiceData.amount || invoiceData.total_amount || '0'),
          taxAmount: parseFloat(invoiceData.tax_amount || invoiceData.taxAmount || '0'),
          totalAmount: parseFloat(invoiceData.total_amount || invoiceData.totalAmount || '0'),
          createdAt: invoiceData.created_at || invoiceData.createdAt || new Date().toISOString(),
          updatedAt: invoiceData.updated_at || invoiceData.updatedAt || new Date().toISOString(),
          status: invoiceData.status || 'PENDING',
          integrationMode: invoiceData.integration_mode || invoiceData.integrationMode || 'OSCU',
          retryCount: invoiceData.retry_count || invoiceData.retryCount || 0,
          receiptType: invoiceData.receipt_type || invoiceData.receiptType || 'normal',
          transactionType: invoiceData.transaction_type || invoiceData.transactionType || 'sale',
          qrCodeData: invoiceData.qr_code_data || invoiceData.qrCodeData || null,
          receiptNo: invoiceData.receipt_no || invoiceData.receiptNo || null,
          receiptSignature: invoiceData.receipt_signature || invoiceData.receiptSignature || null,
          internalData: invoiceData.internal_data || invoiceData.internalData || null,
          items: (invoiceData.items || []).map((item: any) => ({
            ...item,
            description: item.description || item.item_description || 'No description',
            unitPrice: parseFloat(item.unit_price || item.unitPrice || '0'),
            totalAmount: parseFloat(item.total_amount || item.totalAmount || '0'),
            taxRate: parseFloat(item.tax_rate || item.taxRate || '0') / 100, // Convert percentage to decimal
            quantity: parseFloat(item.quantity || '0'),
          })),
        };
        setInvoice(normalizedInvoice as Invoice);
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
    if (!invoice || !invoice.id) return;
    
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
      console.error('Resync error:', error);
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setResyncing(false);
    }
  };

  const handleExportPDF = async () => {
    if (!invoice || !invoice.id) return;
    
    setExportingPDF(true);
    try {
      // Call backend to generate PDF
      const response = await apiService.get(`/receipts/${invoice.id}/pdf/`);
      
      if (response.success && response.data) {
        // PDF URL or base64 data
        const pdfData = response.data as any;
        
        if (pdfData.pdf_url) {
          // Share the PDF URL
          await Share.share({
            message: `Invoice ${invoice.invoiceNumber} PDF`,
            url: pdfData.pdf_url,
            title: `Invoice ${invoice.invoiceNumber}`,
          });
        } else if (pdfData.pdf_base64) {
          // Handle base64 PDF data
          Alert.alert('Success', 'PDF generated successfully');
        } else {
          Alert.alert('Success', 'PDF export initiated');
        }
      } else {
        Alert.alert('Error', response.message || 'Failed to export PDF');
      }
    } catch (error) {
      console.error('PDF export error:', error);
      Alert.alert('Error', 'Failed to export PDF. Please try again.');
    } finally {
      setExportingPDF(false);
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
              <Text style={styles.invoiceNumber}>#{invoice.invoiceNumber || 'N/A'}</Text>
              <Text style={styles.customerName}>{invoice.customerName || 'Unknown Customer'}</Text>
              {invoice.customerPin ? (
                <Text style={styles.customerPin}>PIN: {invoice.customerPin}</Text>
              ) : null}
            </View>
            <View style={styles.statusContainer}>
              <View
                style={[styles.statusChip, { borderColor: getStatusColor(invoice.status) }]}
              >
                <Text style={[styles.statusText, { color: getStatusColor(invoice.status) }]}>
                  {invoice.status || 'PENDING'}
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
              {(() => {
                try {
                  return new Date(invoice.createdAt || new Date()).toLocaleString();
                } catch (e) {
                  return 'Invalid date';
                }
              })()}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Last Updated:</Text>
            <Text style={styles.detailValue}>
              {(() => {
                try {
                  return new Date(invoice.updatedAt || new Date()).toLocaleString();
                } catch (e) {
                  return 'Invalid date';
                }
              })()}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Integration Mode:</Text>
            <Text style={styles.detailValue}>{invoice.integrationMode || 'OSCU'}</Text>
          </View>
          
          {invoice.retryCount && invoice.retryCount > 0 ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Retry Count:</Text>
              <Text style={styles.detailValue}>{invoice.retryCount}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Items */}
      <View style={styles.card}>
        <View style={styles.cardContent}>
          <Text style={styles.sectionTitle}>Items ({invoice.items?.length || 0})</Text>
          
          {invoice.items?.map((item, index) => (
            <View key={item.id || index} style={styles.itemContainer}>
              <Text style={styles.itemDescription}>{item.description || 'No description'}</Text>
              <View style={styles.itemDetails}>
                <Text style={styles.itemDetail}>
                  Qty: {item.quantity || 0} × KSh {(item.unitPrice || 0).toLocaleString()}
                </Text>
                <Text style={styles.itemDetail}>
                  Tax: {((item.taxRate || 0) * 100).toFixed(0)}%
                </Text>
              </View>
              <Text style={styles.itemTotal}>
                KSh {(item.totalAmount || 0).toLocaleString()}
              </Text>
              {index < (invoice.items?.length || 0) - 1 ? (
                <View style={styles.itemDivider} />
              ) : null}
            </View>
          ))}
        </View>
      </View>

      {/* KRA Approval Section - QR Code and Digital Signature */}
      {(invoice.status === 'confirmed' || invoice.status === 'SYNCED' || invoice.receiptNo) && (
        <View style={styles.card}>
          <View style={styles.cardContent}>
            <View style={styles.approvalHeader}>
              <Icon name="check-decagram" size={24} color="#34C759" />
              <Text style={styles.approvalTitle}>KRA Approved</Text>
            </View>
            
            {invoice.receiptNo && (
              <View style={styles.receiptNoContainer}>
                <Text style={styles.receiptNoLabel}>KRA Receipt Number</Text>
                <Text style={styles.receiptNoValue}>{invoice.receiptNo}</Text>
              </View>
            )}

            {/* QR Code */}
            {invoice.qrCodeData && (
              <View style={styles.qrSection}>
                <Text style={styles.qrTitle}>Verification QR Code</Text>
                <View style={styles.qrContainer}>
                  <Image
                    source={{ 
                      uri: invoice.qrCodeData.startsWith('data:') 
                        ? invoice.qrCodeData 
                        : `data:image/png;base64,${invoice.qrCodeData}` 
                    }}
                    style={styles.qrCode}
                    resizeMode="contain"
                  />
                  <Text style={styles.qrLabel}>Scan to verify with KRA eTIMS</Text>
                </View>
              </View>
            )}

            {/* Digital Signature */}
            {(invoice as any).receiptSignature && (
              <View style={styles.signatureSection}>
                <View style={styles.signatureHeader}>
                  <Icon name="shield-check" size={20} color="#000000" />
                  <Text style={styles.signatureTitle}>Digital Signature</Text>
                </View>
                <View style={styles.signatureContainer}>
                  <Text style={styles.signatureText} numberOfLines={3} ellipsizeMode="middle">
                    {(invoice as any).receiptSignature}
                  </Text>
                </View>
                <Text style={styles.signatureNote}>
                  This signature verifies the invoice has been approved by KRA
                </Text>
              </View>
            )}

            {/* Internal Data */}
            {(invoice as any).internalData && (
              <View style={styles.internalDataSection}>
                <Text style={styles.internalDataLabel}>KRA Internal Reference</Text>
                <View style={styles.internalDataContainer}>
                  <Text style={styles.internalDataText} numberOfLines={2} ellipsizeMode="middle">
                    {(invoice as any).internalData}
                  </Text>
                </View>
              </View>
            )}

            {/* Export PDF Button */}
            <TouchableOpacity
              onPress={handleExportPDF}
              disabled={exportingPDF}
              style={styles.exportPDFButton}
            >
              {exportingPDF ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Icon name="file-pdf-box" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.exportPDFText}>Export as PDF</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* QR Code Section - Legacy (for non-approved invoices) */}
      {invoice.qrCodeData && !(invoice.status === 'confirmed' || invoice.status === 'SYNCED' || invoice.receiptNo) ? (
        <View style={styles.card}>
          <View style={styles.cardContent}>
            <Text style={styles.sectionTitle}>Receipt QR Code</Text>
            <View style={styles.qrContainer}>
              <Image
                source={{ 
                  uri: invoice.qrCodeData.startsWith('data:') 
                    ? invoice.qrCodeData 
                    : `data:image/png;base64,${invoice.qrCodeData}` 
                }}
                style={styles.qrCode}
                resizeMode="contain"
              />
              <Text style={styles.qrLabel}>Scan for verification</Text>
            </View>
            {invoice.receiptNo && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>KRA Receipt No:</Text>
                <Text style={styles.detailValue}>{invoice.receiptNo}</Text>
              </View>
            )}
          </View>
        </View>
      ) : null}

      {/* Totals */}
      <View style={styles.card}>
        <View style={styles.cardContent}>
          <Text style={styles.sectionTitle}>Summary</Text>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal:</Text>
            <Text style={styles.summaryValue}>
              KSh {(invoice.amount || 0).toLocaleString()}
            </Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tax Amount:</Text>
            <Text style={styles.summaryValue}>
              KSh {(invoice.taxAmount || 0).toLocaleString()}
            </Text>
          </View>
          
          <View style={styles.summaryDivider} />
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryTotalLabel}>Total Amount:</Text>
            <Text style={styles.summaryTotalValue}>
              KSh {(invoice.totalAmount || 0).toLocaleString()}
            </Text>
          </View>
        </View>
      </View>

      {/* Submission Details */}
      {(invoice.jsonPayload || invoice.submissionResponse) ? (
        <View style={styles.card}>
          <View style={styles.cardContent}>
            <Text style={styles.sectionTitle}>Submission Details</Text>
            
            {invoice.jsonPayload ? (
              <View style={styles.submissionSection}>
                <Text style={styles.submissionLabel}>Request Payload:</Text>
                <View style={styles.codeContainer}>
                  <Text style={styles.codeText}>
                    {(() => {
                      try {
                        return JSON.stringify(JSON.parse(invoice.jsonPayload), null, 2);
                      } catch (e) {
                        return invoice.jsonPayload || '';
                      }
                    })()}
                  </Text>
                </View>
              </View>
            ) : null}
            
            {invoice.submissionResponse ? (
              <View style={styles.submissionSection}>
                <Text style={styles.submissionLabel}>Response:</Text>
                <View style={styles.codeContainer}>
                  <Text style={styles.codeText}>
                    {(() => {
                      try {
                        return JSON.stringify(JSON.parse(invoice.submissionResponse), null, 2);
                      } catch (e) {
                        return invoice.submissionResponse || '';
                      }
                    })()}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* Actions */}
      <View style={styles.actionsContainer}>
        {invoice.status === 'FAILED' ? (
          <TouchableOpacity
            onPress={handleResync}
            disabled={resyncing}
            style={[styles.actionButton, styles.primaryButton]}
          >
            <Text style={styles.primaryButtonText}>
              {resyncing ? 'Retrying...' : 'Retry Sync'}
            </Text>
          </TouchableOpacity>
        ) : null}
        
        {invoice.status === 'PENDING' && invoice.integrationMode === 'VSCU' ? (
          <TouchableOpacity
            onPress={handleResync}
            disabled={resyncing}
            style={[styles.actionButton, styles.outlinedButton]}
          >
            <Text style={styles.outlinedButtonText}>
              {resyncing ? 'Syncing...' : 'Manual Sync'}
            </Text>
          </TouchableOpacity>
        ) : null}
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
    height: 1,
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
    height: 1,
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
  qrContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  qrCode: {
    width: 200,
    height: 200,
    marginBottom: spacing.md,
  },
  qrLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  // KRA Approval Styles
  approvalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  approvalTitle: {
    ...typography.h2,
    color: '#34C759',
    marginLeft: spacing.sm,
    fontWeight: '700',
  },
  receiptNoContainer: {
    backgroundColor: '#F0F9FF',
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  receiptNoLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  receiptNoValue: {
    ...typography.h3,
    color: '#007AFF',
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  qrSection: {
    marginBottom: spacing.lg,
  },
  qrTitle: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  signatureSection: {
    marginBottom: spacing.lg,
  },
  signatureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  signatureTitle: {
    ...typography.body,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  signatureContainer: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  signatureText: {
    ...typography.caption,
    fontFamily: 'monospace',
    color: colors.text,
    lineHeight: 18,
  },
  signatureNote: {
    ...typography.caption,
    color: colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  internalDataSection: {
    marginBottom: spacing.lg,
  },
  internalDataLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  internalDataContainer: {
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  internalDataText: {
    ...typography.caption,
    fontFamily: 'monospace',
    color: colors.text,
    fontSize: 10,
  },
  exportPDFButton: {
    backgroundColor: '#FF3B30',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    marginTop: spacing.md,
  },
  exportPDFText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
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

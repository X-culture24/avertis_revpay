import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  TextInput,
} from 'react-native';
// Using native React Native components instead of react-native-paper
import { useNavigation } from '@react-navigation/native';
import { useRecoilValue } from 'recoil';

import { colors, spacing, typography } from '@/theme/theme';
import { authState } from '@/store/atoms';
import { apiService } from '@/services/api';
import { Invoice, InvoiceItem } from '@/types';

const CreateInvoiceScreen: React.FC = () => {
  const navigation = useNavigation();
  // const integrationSettings = useRecoilValue(integrationSettingsState);
  const { user } = useRecoilValue(authState);
  
  const [loading, setLoading] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);
  const [subscription, setSubscription] = useState<any>(null);
  const [invoiceData, setInvoiceData] = useState({
    customerName: '',
    customerPin: '',
    receiptType: 'normal' as 'normal' | 'copy' | 'proforma' | 'training',
    transactionType: 'sale' as 'sale' | 'refund',
  });

  // Fetch user's devices and subscription on mount
  React.useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch devices
        const response = await apiService.getDevices();
        if (response.success && response.data) {
          const deviceData = (response.data as any).results || response.data;
          setDevices(Array.isArray(deviceData) ? deviceData : [deviceData]);
        }
        
        // Fetch subscription status
        const subResponse = await apiService.get('/subscription/current/');
        if (subResponse.success && subResponse.data) {
          setSubscription(subResponse.data.subscription);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
    fetchData();
  }, []);
  
  const [items, setItems] = useState<Partial<InvoiceItem>[]>([
    {
      description: '',
      quantity: 1,
      unitPrice: 0,
      taxRate: 16, // Default VAT rate in Kenya
    }
  ]);

  const updateInvoiceData = (field: string, value: string) => {
    setInvoiceData(prev => ({ ...prev, [field]: value }));
  };

  const updateItem = (index: number, field: string, value: string | number) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    // Calculate total amount for the item
    if (field === 'quantity' || field === 'unitPrice' || field === 'taxRate') {
      const item = updatedItems[index];
      const subtotal = (item.quantity || 0) * (item.unitPrice || 0);
      const taxAmount = subtotal * ((item.taxRate || 0) / 100);
      updatedItems[index].totalAmount = subtotal + taxAmount;
    }
    
    setItems(updatedItems);
  };

  const addItem = () => {
    setItems([...items, {
      description: '',
      quantity: 1,
      unitPrice: 0,
      taxRate: 16,
    }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => {
      return sum + ((item.quantity || 0) * (item.unitPrice || 0));
    }, 0);
    
    const taxAmount = items.reduce((sum, item) => {
      const itemSubtotal = (item.quantity || 0) * (item.unitPrice || 0);
      return sum + (itemSubtotal * ((item.taxRate || 0) / 100));
    }, 0);
    
    const total = subtotal + taxAmount;
    
    return { subtotal, taxAmount, total };
  };

  const validateForm = () => {
    if (!invoiceData.customerName) {
      Alert.alert('Error', 'Please fill in customer name');
      return false;
    }

    if (items.some(item => !item.description || !item.quantity || !item.unitPrice)) {
      Alert.alert('Error', 'Please fill in all item details');
      return false;
    }

    return true;
  };

  const handleCreateInvoice = async () => {
    if (!validateForm()) return;

    // Check subscription limits before creating invoice
    try {
      const limitCheck = await apiService.post('/subscription/check-limits/', {
        action: 'create_invoice'
      });
      
      if (!limitCheck.success || !limitCheck.data?.allowed) {
        const reason = limitCheck.data?.reason || 'unknown';
        const message = limitCheck.data?.message || 'Cannot create invoice';
        
        if (reason === 'subscription_expired') {
          Alert.alert(
            'Subscription Expired',
            'Your subscription has expired. Please renew to continue creating invoices.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Renew', onPress: () => (navigation as any).navigate('SubscriptionTab') }
            ]
          );
          return;
        } else if (reason === 'invoice_limit_reached') {
          Alert.alert(
            'Invoice Limit Reached',
            `${message}\n\nUpgrade your plan to create more invoices.`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Upgrade', onPress: () => (navigation as any).navigate('SubscriptionTab') }
            ]
          );
          return;
        } else {
          Alert.alert('Error', message);
          return;
        }
      }
    } catch (error: any) {
      console.error('Error checking subscription limits:', error);
      // Continue anyway if limit check fails (don't block user)
    }

    setLoading(true);
    try {
      const { subtotal, taxAmount, total } = calculateTotals();
      
      const companyTin = (user as any)?.company?.tin;
      if (!companyTin) {
        Alert.alert('Error', 'Company TIN not found. Please complete your profile.');
        setLoading(false);
        return;
      }

      const activeDevice = devices.find(d => d.status === 'active');
      if (!activeDevice) {
        Alert.alert('Error', 'No active device found. Please register a device first.');
        setLoading(false);
        return;
      }

      const payload = {
        tin: companyTin,
        customer_name: invoiceData.customerName,
        customer_tin: invoiceData.customerPin || '',
        total_amount: parseFloat(total.toFixed(2)),
        tax_amount: parseFloat(taxAmount.toFixed(2)),
        currency: 'KES',
        payment_type: 'CASH',
        receipt_type: invoiceData.receiptType,
        transaction_type: invoiceData.transactionType,
        transaction_date: new Date().toISOString(),
        device_serial_number: activeDevice.serial_number,
        items: items.map(item => ({
          item_code: 'ITEM001',
          item_name: item.description || '',
          quantity: parseFloat(String(item.quantity || 0)),
          unit_price: parseFloat(String(item.unitPrice || 0)),
          tax_type: 'B',
          tax_rate: parseFloat(String(item.taxRate || 16)),
          unit_of_measure: 'EA',
        })),
      };

      console.log('Creating invoice with payload:', JSON.stringify(payload, null, 2));
      const response = await apiService.createInvoice(payload);
      
      console.log('Invoice creation response:', response);
      
      if (response.success) {
        Alert.alert(
          'Success', 
          'Invoice created successfully!\nInvoice number auto-generated by system.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        const errorMessage = response.message || 'Failed to create invoice';
        console.error('Invoice creation failed:', errorMessage);
        Alert.alert('Error', errorMessage);
      }
    } catch (error: any) {
      console.error('Invoice creation error:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      Alert.alert(
        'Error', 
        `Network error: ${error.message || 'Please try again.'}\n\nCheck console for details.`
      );
    } finally {
      setLoading(false);
    }
  };

  const { subtotal, taxAmount, total } = calculateTotals();

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Invoice Details */}
        <View style={styles.card}>
          <View style={styles.cardContent}>
            <Text style={styles.sectionTitle}>Invoice Details</Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Invoice Number</Text>
              <View style={[styles.textInput, { backgroundColor: colors.border, justifyContent: 'center' }]}>
                <Text style={{ color: colors.textSecondary, fontStyle: 'italic' }}>
                  Auto-generated by system
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
                Sequential number assigned automatically per KRA requirements
              </Text>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Customer Name *</Text>
              <TextInput
                value={invoiceData.customerName}
                onChangeText={(value) => updateInvoiceData('customerName', value)}
                style={styles.textInput}
                placeholder="Enter customer name"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Customer PIN (Optional)</Text>
              <TextInput
                value={invoiceData.customerPin}
                onChangeText={(value) => updateInvoiceData('customerPin', value)}
                style={styles.textInput}
                placeholder="Enter customer PIN"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          </View>
        </View>

        {/* Items */}
        <View style={styles.card}>
          <View style={styles.cardContent}>
            <View style={styles.itemsHeader}>
              <Text style={styles.sectionTitle}>Items</Text>
              <TouchableOpacity
                onPress={addItem}
                style={styles.addButton}
              >
                <Text style={styles.addButtonText}>Add Item</Text>
              </TouchableOpacity>
            </View>

            {items.map((item, index) => (
              <View key={index} style={styles.itemContainer}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemTitle}>Item {index + 1}</Text>
                  {items.length > 1 && (
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => removeItem(index)}
                    >
                      <Text style={[styles.removeButtonText, { color: colors.error }]}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Description *</Text>
                  <TextInput
                    value={item.description}
                    onChangeText={(value) => updateItem(index, 'description', value)}
                    style={styles.textInput}
                    placeholder="Enter item description"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>

                <View style={styles.itemRow}>
                  <View style={[styles.inputContainer, styles.itemRowInput]}>
                    <Text style={styles.inputLabel}>Quantity *</Text>
                    <TextInput
                      value={item.quantity?.toString() || ''}
                      onChangeText={(value) => updateItem(index, 'quantity', parseInt(value) || 0)}
                      keyboardType="numeric"
                      style={styles.textInput}
                      placeholder="0"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>

                  <View style={[styles.inputContainer, styles.itemRowInput]}>
                    <Text style={styles.inputLabel}>Unit Price *</Text>
                    <TextInput
                      value={item.unitPrice?.toString() || ''}
                      onChangeText={(value) => updateItem(index, 'unitPrice', parseFloat(value) || 0)}
                      keyboardType="numeric"
                      style={styles.textInput}
                      placeholder="0.00"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>
                </View>

                <View style={styles.itemRow}>
                  <View style={[styles.inputContainer, styles.itemRowInput]}>
                    <Text style={styles.inputLabel}>Tax Rate (%)</Text>
                    <TextInput
                      value={item.taxRate?.toString() || ''}
                      onChangeText={(value) => updateItem(index, 'taxRate', parseFloat(value) || 0)}
                      keyboardType="numeric"
                      style={styles.textInput}
                      placeholder="16"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>

                  <View style={[styles.itemRowInput, styles.totalContainer]}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalValue}>
                      KSh {(item.totalAmount || 0).toLocaleString()}
                    </Text>
                  </View>
                </View>

                {index < items.length - 1 && <View style={styles.itemDivider} />}
              </View>
            ))}
          </View>
        </View>

        {/* Summary */}
        <View style={styles.card}>
          <View style={styles.cardContent}>
            <Text style={styles.sectionTitle}>Summary</Text>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal:</Text>
              <Text style={styles.summaryValue}>KSh {subtotal.toLocaleString()}</Text>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tax Amount:</Text>
              <Text style={styles.summaryValue}>KSh {taxAmount.toLocaleString()}</Text>
            </View>
            
            <View style={styles.summaryDivider} />
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryTotalLabel}>Total Amount:</Text>
              <Text style={styles.summaryTotalValue}>KSh {total.toLocaleString()}</Text>
            </View>

            <View style={styles.integrationInfo}>
              <Text style={styles.integrationText}>
                Integration Mode: OSCU
              </Text>
            </View>
          </View>
        </View>

        {/* Create Button */}
        <TouchableOpacity
          onPress={handleCreateInvoice}
          disabled={loading}
          style={[styles.createButton, { 
            backgroundColor: colors.primary,
            margin: 16,
            marginTop: 8,
            marginBottom: 24,
            paddingVertical: 12,
            alignItems: 'center',
            borderRadius: 4
          }]}
        >
          <Text style={{ color: colors.secondary, fontSize: 16, fontWeight: 'bold' }}>
            {loading ? 'Creating...' : 'Create Invoice'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  card: {
    margin: spacing.md,
    backgroundColor: colors.card,
    elevation: 1,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  input: {
    marginBottom: spacing.md,
    backgroundColor: colors.background,
  },
  cardContent: {
    padding: spacing.md,
  },
  inputContainer: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    ...typography.caption,
    color: colors.text,
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    padding: spacing.sm,
    backgroundColor: colors.background,
    ...typography.body,
    color: colors.text,
  },
  itemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  addButton: {
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.background,
  },
  addButtonText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  itemContainer: {
    marginBottom: spacing.lg,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  itemTitle: {
    ...typography.body,
    fontWeight: '600',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemRowInput: {
    flex: 1,
    marginHorizontal: spacing.xs,
  },
  totalContainer: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    backgroundColor: colors.surface,
    borderRadius: 4,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  totalLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  totalValue: {
    ...typography.body,
    fontWeight: '600',
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
  integrationInfo: {
    marginTop: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 4,
  },
  integrationText: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  createButton: {
    margin: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    paddingVertical: spacing.xs,
  },
  removeButton: {
    padding: spacing.xs,
    borderRadius: 12,
  },
  removeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: spacing.xs,
    borderRadius: 12,
  },
  closeButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
});

export default CreateInvoiceScreen;

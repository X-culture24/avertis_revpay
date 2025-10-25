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
  
  const [loading, setLoading] = useState(false);
  const [invoiceData, setInvoiceData] = useState({
    customerName: '',
    customerPin: '',
    invoiceNumber: '',
  });
  
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
    if (!invoiceData.customerName || !invoiceData.invoiceNumber) {
      Alert.alert('Error', 'Please fill in customer name and invoice number');
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

    setLoading(true);
    try {
      const { subtotal, taxAmount, total } = calculateTotals();
      
      const payload = {
        ...invoiceData,
        items: items.map((item, index) => ({
          ...item,
          id: `item_${index}`,
          totalAmount: item.totalAmount || 0,
        })),
        amount: subtotal,
        taxAmount,
        totalAmount: total,
        integrationMode: 'OSCU',
      };

      const response = await apiService.createInvoice(payload);
      
      if (response.success) {
        Alert.alert(
          'Success', 
          'Invoice created successfully!',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert('Error', response.message || 'Failed to create invoice');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.');
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
              <Text style={styles.inputLabel}>Invoice Number *</Text>
              <TextInput
                value={invoiceData.invoiceNumber}
                onChangeText={(value) => updateInvoiceData('invoiceNumber', value)}
                style={styles.textInput}
                placeholder="Enter invoice number"
                placeholderTextColor={colors.textSecondary}
              />
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

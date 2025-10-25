import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { TextInput, Button, Card, Divider, IconButton } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useRecoilValue } from 'recoil';

import { colors, spacing, typography } from '@/theme/theme';
import { integrationSettingsState } from '@/store/atoms';
import { apiService } from '@/services/api';
import { InvoiceItem } from '@/types';

const CreateInvoiceScreen: React.FC = () => {
  const navigation = useNavigation();
  const integrationSettings = useRecoilValue(integrationSettingsState);
  
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
        integrationMode: integrationSettings?.mode || 'OSCU',
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
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Invoice Details</Text>
            
            <TextInput
              label="Invoice Number *"
              value={invoiceData.invoiceNumber}
              onChangeText={(value) => updateInvoiceData('invoiceNumber', value)}
              mode="outlined"
              style={styles.input}
              theme={{
                colors: {
                  primary: colors.primary,
                  outline: colors.border,
                }
              }}
            />

            <TextInput
              label="Customer Name *"
              value={invoiceData.customerName}
              onChangeText={(value) => updateInvoiceData('customerName', value)}
              mode="outlined"
              style={styles.input}
              theme={{
                colors: {
                  primary: colors.primary,
                  outline: colors.border,
                }
              }}
            />

            <TextInput
              label="Customer PIN (Optional)"
              value={invoiceData.customerPin}
              onChangeText={(value) => updateInvoiceData('customerPin', value)}
              mode="outlined"
              style={styles.input}
              theme={{
                colors: {
                  primary: colors.primary,
                  outline: colors.border,
                }
              }}
            />
          </Card.Content>
        </Card>

        {/* Items */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.itemsHeader}>
              <Text style={styles.sectionTitle}>Items</Text>
              <Button
                mode="outlined"
                onPress={addItem}
                compact
                buttonColor={colors.background}
                textColor={colors.primary}
                style={styles.addButton}
              >
                Add Item
              </Button>
            </View>

            {items.map((item, index) => (
              <View key={index} style={styles.itemContainer}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemTitle}>Item {index + 1}</Text>
                  {items.length > 1 && (
                    <IconButton
                      icon="close"
                      size={20}
                      onPress={() => removeItem(index)}
                      iconColor={colors.textSecondary}
                    />
                  )}
                </View>

                <TextInput
                  label="Description *"
                  value={item.description}
                  onChangeText={(value) => updateItem(index, 'description', value)}
                  mode="outlined"
                  style={styles.input}
                  theme={{
                    colors: {
                      primary: colors.primary,
                      outline: colors.border,
                    }
                  }}
                />

                <View style={styles.itemRow}>
                  <TextInput
                    label="Quantity *"
                    value={item.quantity?.toString() || ''}
                    onChangeText={(value) => updateItem(index, 'quantity', parseInt(value) || 0)}
                    mode="outlined"
                    keyboardType="numeric"
                    style={[styles.input, styles.itemRowInput]}
                    theme={{
                      colors: {
                        primary: colors.primary,
                        outline: colors.border,
                      }
                    }}
                  />

                  <TextInput
                    label="Unit Price *"
                    value={item.unitPrice?.toString() || ''}
                    onChangeText={(value) => updateItem(index, 'unitPrice', parseFloat(value) || 0)}
                    mode="outlined"
                    keyboardType="numeric"
                    style={[styles.input, styles.itemRowInput]}
                    theme={{
                      colors: {
                        primary: colors.primary,
                        outline: colors.border,
                      }
                    }}
                  />
                </View>

                <View style={styles.itemRow}>
                  <TextInput
                    label="Tax Rate (%)"
                    value={item.taxRate?.toString() || ''}
                    onChangeText={(value) => updateItem(index, 'taxRate', parseFloat(value) || 0)}
                    mode="outlined"
                    keyboardType="numeric"
                    style={[styles.input, styles.itemRowInput]}
                    theme={{
                      colors: {
                        primary: colors.primary,
                        outline: colors.border,
                      }
                    }}
                  />

                  <View style={[styles.itemRowInput, styles.totalContainer]}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalValue}>
                      KSh {(item.totalAmount || 0).toLocaleString()}
                    </Text>
                  </View>
                </View>

                {index < items.length - 1 && <Divider style={styles.itemDivider} />}
              </View>
            ))}
          </Card.Content>
        </Card>

        {/* Summary */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Summary</Text>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal:</Text>
              <Text style={styles.summaryValue}>KSh {subtotal.toLocaleString()}</Text>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tax Amount:</Text>
              <Text style={styles.summaryValue}>KSh {taxAmount.toLocaleString()}</Text>
            </View>
            
            <Divider style={styles.summaryDivider} />
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryTotalLabel}>Total Amount:</Text>
              <Text style={styles.summaryTotalValue}>KSh {total.toLocaleString()}</Text>
            </View>

            <View style={styles.integrationInfo}>
              <Text style={styles.integrationText}>
                Integration Mode: {integrationSettings?.mode || 'OSCU'}
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* Create Button */}
        <Button
          mode="contained"
          onPress={handleCreateInvoice}
          loading={loading}
          disabled={loading}
          style={styles.createButton}
          buttonColor={colors.primary}
          textColor={colors.secondary}
        >
          Create Invoice
        </Button>
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
  itemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  addButton: {
    borderColor: colors.primary,
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
    ...typography.small,
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
});

export default CreateInvoiceScreen;

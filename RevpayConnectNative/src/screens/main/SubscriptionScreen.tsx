import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { colors } from '@/theme/theme';
// import apiService from '@/services/api'; // TODO: Implement API integration

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: 'monthly' | 'yearly';
  features: string[];
  limits: {
    invoices: number | 'unlimited';
    devices: number;
    users: number;
    storage: string;
  };
  recommended?: boolean;
}

interface CurrentSubscription {
  plan: string;
  status: 'active' | 'expired' | 'cancelled' | 'trial';
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  invoicesUsed: number;
  invoicesLimit: number | 'unlimited';
}

const SubscriptionScreen: React.FC = () => {
  const [refreshing, setRefreshing] = useState(false);
  const [currentSubscription, setCurrentSubscription] = useState<CurrentSubscription>({
    plan: 'SME',
    status: 'active',
    startDate: '2024-10-01',
    endDate: '2024-11-01',
    autoRenew: true,
    invoicesUsed: 45,
    invoicesLimit: 100,
  });

  const [plans] = useState<SubscriptionPlan[]>([
    {
      id: 'free',
      name: 'Free',
      price: 0,
      currency: 'KES',
      interval: 'monthly',
      features: [
        'Up to 10 invoices per month',
        '1 device',
        'Basic reporting',
        'Email support',
        'VSCU mode only',
      ],
      limits: {
        invoices: 10,
        devices: 1,
        users: 1,
        storage: '100 MB',
      },
    },
    {
      id: 'sme',
      name: 'SME',
      price: 2500,
      currency: 'KES',
      interval: 'monthly',
      features: [
        'Up to 100 invoices per month',
        'Up to 3 devices',
        'Advanced reporting',
        'Priority email support',
        'OSCU & VSCU modes',
        'Compliance reports',
        'Data export',
      ],
      limits: {
        invoices: 100,
        devices: 3,
        users: 3,
        storage: '1 GB',
      },
      recommended: true,
    },
    {
      id: 'corporate',
      name: 'Corporate',
      price: 7500,
      currency: 'KES',
      interval: 'monthly',
      features: [
        'Unlimited invoices',
        'Unlimited devices',
        'Custom reporting',
        '24/7 phone & email support',
        'OSCU & VSCU modes',
        'Compliance reports',
        'Data export',
        'API access',
        'Dedicated account manager',
        'Custom integrations',
      ],
      limits: {
        invoices: 'unlimited',
        devices: 999,
        users: 10,
        storage: '10 GB',
      },
    },
  ]);

  useEffect(() => {
    loadSubscriptionData();
  }, []);

  const loadSubscriptionData = async () => {
    try {
      // TODO: Load from API
      // const response = await apiService.getSubscription();
      // setCurrentSubscription(response.data);
    } catch (error) {
      console.error('Error loading subscription:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSubscriptionData();
    setRefreshing(false);
  };

  const handleUpgrade = (planId: string) => {
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;

    Alert.alert(
      'Upgrade Subscription',
      `Upgrade to ${plan.name} plan for ${plan.currency} ${plan.price}/${plan.interval}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Upgrade',
          onPress: async () => {
            try {
              // TODO: Call API to upgrade subscription
              Alert.alert('Success', 'Subscription upgraded successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to upgrade subscription');
            }
          },
        },
      ]
    );
  };

  const handleCancelSubscription = () => {
    Alert.alert(
      'Cancel Subscription',
      'Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your billing period.',
      [
        { text: 'Keep Subscription', style: 'cancel' },
        {
          text: 'Cancel Subscription',
          style: 'destructive',
          onPress: async () => {
            try {
              // TODO: Call API to cancel subscription
              Alert.alert('Cancelled', 'Your subscription will end on ' + currentSubscription.endDate);
            } catch (error) {
              Alert.alert('Error', 'Failed to cancel subscription');
            }
          },
        },
      ]
    );
  };

  const handleManagePayment = () => {
    Alert.alert('Manage Payment', 'Payment management coming soon');
    // TODO: Navigate to payment management screen
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return colors.success;
      case 'trial': return colors.warning;
      case 'expired': return colors.error;
      case 'cancelled': return colors.textSecondary;
      default: return colors.text;
    }
  };

  const getUsagePercentage = () => {
    if (currentSubscription.invoicesLimit === 'unlimited') return 0;
    return (currentSubscription.invoicesUsed / currentSubscription.invoicesLimit) * 100;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Subscription</Text>
      </View>

      {/* Current Subscription Card */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current Plan</Text>
        <View style={styles.currentPlanCard}>
          <View style={styles.planHeader}>
            <View>
              <Text style={styles.currentPlanName}>{currentSubscription.plan}</Text>
              <View style={styles.statusBadge}>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor(currentSubscription.status) }]} />
                <Text style={[styles.statusText, { color: getStatusColor(currentSubscription.status) }]}>
                  {currentSubscription.status.toUpperCase()}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.planDetails}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Started</Text>
              <Text style={styles.detailValue}>{formatDate(currentSubscription.startDate)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Renews</Text>
              <Text style={styles.detailValue}>{formatDate(currentSubscription.endDate)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Auto-Renew</Text>
              <Text style={styles.detailValue}>{currentSubscription.autoRenew ? 'Enabled' : 'Disabled'}</Text>
            </View>
          </View>

          {/* Usage */}
          <View style={styles.usageSection}>
            <View style={styles.usageHeader}>
              <Text style={styles.usageLabel}>Invoice Usage</Text>
              <Text style={styles.usageValue}>
                {currentSubscription.invoicesUsed} / {currentSubscription.invoicesLimit === 'unlimited' ? '∞' : currentSubscription.invoicesLimit}
              </Text>
            </View>
            {currentSubscription.invoicesLimit !== 'unlimited' && (
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${getUsagePercentage()}%` }]} />
              </View>
            )}
          </View>

          {/* Actions */}
          <View style={styles.planActions}>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleManagePayment}>
              <Text style={styles.secondaryButtonText}>Manage Payment</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dangerButton} onPress={handleCancelSubscription}>
              <Text style={styles.dangerButtonText}>Cancel Plan</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Available Plans */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Available Plans</Text>
        {plans.map(plan => (
          <View key={plan.id} style={[styles.planCard, plan.recommended && styles.recommendedCard]}>
            {plan.recommended && (
              <View style={styles.recommendedBadge}>
                <Text style={styles.recommendedText}>RECOMMENDED</Text>
              </View>
            )}
            
            <View style={styles.planCardHeader}>
              <Text style={styles.planName}>{plan.name}</Text>
              <View style={styles.priceContainer}>
                <Text style={styles.currency}>{plan.currency}</Text>
                <Text style={styles.price}>{plan.price.toLocaleString()}</Text>
                <Text style={styles.interval}>/{plan.interval}</Text>
              </View>
            </View>

            <View style={styles.featuresContainer}>
              {plan.features.map((feature, index) => (
                <View key={index} style={styles.featureRow}>
                  <Text style={styles.checkmark}>✓</Text>
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>

            <View style={styles.limitsContainer}>
              <View style={styles.limitItem}>
                <Text style={styles.limitValue}>{plan.limits.invoices === 'unlimited' ? '∞' : plan.limits.invoices}</Text>
                <Text style={styles.limitLabel}>Invoices</Text>
              </View>
              <View style={styles.limitItem}>
                <Text style={styles.limitValue}>{plan.limits.devices}</Text>
                <Text style={styles.limitLabel}>Devices</Text>
              </View>
              <View style={styles.limitItem}>
                <Text style={styles.limitValue}>{plan.limits.users}</Text>
                <Text style={styles.limitLabel}>Users</Text>
              </View>
              <View style={styles.limitItem}>
                <Text style={styles.limitValue}>{plan.limits.storage}</Text>
                <Text style={styles.limitLabel}>Storage</Text>
              </View>
            </View>

            {currentSubscription.plan.toLowerCase() !== plan.id && (
              <TouchableOpacity
                style={[styles.upgradeButton, plan.recommended && styles.recommendedButton]}
                onPress={() => handleUpgrade(plan.id)}
              >
                <Text style={styles.upgradeButtonText}>
                  {plan.price === 0 ? 'Downgrade' : 'Upgrade'}
                </Text>
              </TouchableOpacity>
            )}
            {currentSubscription.plan.toLowerCase() === plan.id && (
              <View style={styles.currentBadge}>
                <Text style={styles.currentBadgeText}>Current Plan</Text>
              </View>
            )}
          </View>
        ))}
      </View>

      {/* Billing History */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Billing History</Text>
        <View style={styles.historyCard}>
          <View style={styles.historyItem}>
            <View>
              <Text style={styles.historyDate}>October 1, 2024</Text>
              <Text style={styles.historyDescription}>SME Plan - Monthly</Text>
            </View>
            <Text style={styles.historyAmount}>KES 2,500</Text>
          </View>
          <View style={styles.historyItem}>
            <View>
              <Text style={styles.historyDate}>September 1, 2024</Text>
              <Text style={styles.historyDescription}>SME Plan - Monthly</Text>
            </View>
            <Text style={styles.historyAmount}>KES 2,500</Text>
          </View>
          <TouchableOpacity style={styles.viewAllButton}>
            <Text style={styles.viewAllText}>View All Invoices</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: colors.primary,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  section: {
    padding: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 15,
  },
  currentPlanCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  currentPlanName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  planDetails: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingVertical: 15,
    marginBottom: 15,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  usageSection: {
    marginBottom: 20,
  },
  usageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  usageLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  usageValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  planActions: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  dangerButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.error,
    alignItems: 'center',
  },
  dangerButtonText: {
    color: colors.error,
    fontSize: 14,
    fontWeight: '600',
  },
  planCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recommendedCard: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  recommendedBadge: {
    position: 'absolute',
    top: -10,
    right: 20,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  recommendedText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  planCardHeader: {
    marginBottom: 20,
  },
  planName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  currency: {
    fontSize: 16,
    color: colors.textSecondary,
    marginRight: 4,
  },
  price: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text,
  },
  interval: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  featuresContainer: {
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  checkmark: {
    fontSize: 16,
    color: colors.success,
    marginRight: 10,
    fontWeight: 'bold',
  },
  featureText: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  limitsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 15,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  limitItem: {
    alignItems: 'center',
  },
  limitValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 4,
  },
  limitLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  upgradeButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  recommendedButton: {
    backgroundColor: colors.primary,
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  currentBadge: {
    backgroundColor: colors.success,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  currentBadgeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  historyDate: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  historyDescription: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  historyAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  viewAllButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  viewAllText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default SubscriptionScreen;

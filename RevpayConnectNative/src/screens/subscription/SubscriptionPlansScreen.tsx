import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors, spacing, typography } from '@/theme/theme';
import { apiService } from '@/services/api';

interface Plan {
  id: string;
  name: string;
  price: number;
  invoice_limit_per_month: number;
  device_limit: number;
  features: Record<string, boolean> | string[];
  is_popular?: boolean;
}

const SubscriptionPlansScreen: React.FC = () => {
  const navigation = useNavigation();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await apiService.getSubscriptionPlans();
      if (response.success && response.data) {
        setPlans((response.data as any).plans || []);
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
      Alert.alert('Error', 'Failed to load subscription plans');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = (planId: string) => {
    setSelectedPlan(planId);
  };

  const handleContinue = () => {
    if (!selectedPlan) {
      Alert.alert('Select a Plan', 'Please select a subscription plan to continue');
      return;
    }

    const plan = plans.find(p => p.id === selectedPlan);
    // Navigate to registration with selected plan
    (navigation as any).navigate('BusinessRegistration', { 
      planId: selectedPlan,
      planName: plan?.name,
      planPrice: plan?.price,
    });
  };

  const renderPlanCard = (plan: Plan) => {
    const isSelected = selectedPlan === plan.id;
    const isFree = plan.price === 0;

    return (
      <TouchableOpacity
        key={plan.id}
        style={[
          styles.planCard,
          isSelected && styles.selectedPlanCard,
          plan.is_popular && styles.popularPlanCard,
        ]}
        onPress={() => handleSelectPlan(plan.id)}
      >
        {plan.is_popular && (
          <View style={styles.popularBadge}>
            <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
          </View>
        )}

        <Text style={styles.planName}>{plan.name}</Text>
        
        <View style={styles.priceContainer}>
          <Text style={styles.currency}>KES</Text>
          <Text style={styles.price}>
            {plan.price.toLocaleString()}
          </Text>
          <Text style={styles.period}>/month</Text>
        </View>

        {isFree && (
          <Text style={styles.freeNote}>Perfect to get started</Text>
        )}

        <View style={styles.featuresContainer}>
          <View style={styles.featureRow}>
            <Icon name="file-document" size={20} color={colors.primary} style={styles.featureIcon} />
            <Text style={styles.featureText}>
              {plan.invoice_limit_per_month === -1
                ? 'Unlimited invoices'
                : `${plan.invoice_limit_per_month} invoices/month`}
            </Text>
          </View>

          <View style={styles.featureRow}>
            <Icon name="cellphone" size={20} color={colors.primary} style={styles.featureIcon} />
            <Text style={styles.featureText}>
              {plan.device_limit === -1
                ? 'Unlimited devices'
                : `Up to ${plan.device_limit} device${plan.device_limit > 1 ? 's' : ''}`}
            </Text>
          </View>

          {plan.features && Array.isArray(plan.features) && plan.features.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <Icon name="check" size={20} color={colors.primary} style={styles.featureIcon} />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
          
          {plan.features && typeof plan.features === 'object' && !Array.isArray(plan.features) && 
            Object.entries(plan.features).map(([key, value], index) => (
              value && (
                <View key={index} style={styles.featureRow}>
                  <Icon name="check" size={20} color={colors.primary} style={styles.featureIcon} />
                  <Text style={styles.featureText}>
                    {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Text>
                </View>
              )
            ))
          }
        </View>

        {isSelected && (
          <View style={styles.selectedIndicator}>
            <Icon name="check-circle" size={20} color={colors.primary} />
            <Text style={styles.selectedIndicatorText}>Selected</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading plans...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.header}>Choose Your Plan</Text>
        <Text style={styles.subheader}>
          Select the perfect plan for your business. All plans include KRA eTIMS integration, digital signatures, QR codes, and PDF export.
        </Text>

        <View style={styles.benefitsContainer}>
          <View style={styles.benefitRow}>
            <Icon name="check-circle" size={20} color={colors.primary} />
            <Text style={styles.benefitText}>KRA eTIMS Compliant Invoices</Text>
          </View>
          <View style={styles.benefitRow}>
            <Icon name="qrcode" size={20} color={colors.primary} />
            <Text style={styles.benefitText}>QR Code Verification</Text>
          </View>
          <View style={styles.benefitRow}>
            <Icon name="file-pdf-box" size={20} color={colors.primary} />
            <Text style={styles.benefitText}>PDF Export & Printing</Text>
          </View>
          <View style={styles.benefitRow}>
            <Icon name="shield-check" size={20} color={colors.primary} />
            <Text style={styles.benefitText}>Digital Signatures</Text>
          </View>
        </View>

        {plans.map(renderPlanCard)}

        <View style={styles.guaranteeContainer}>
          <Icon name="shield-check" size={24} color={colors.primary} style={{ marginRight: spacing.sm }} />
          <Text style={styles.guaranteeText}>
            Secure payment • Cancel anytime • No hidden fees
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.loginButton}
          onPress={() => (navigation as any).navigate('Login')}
        >
          <Text style={styles.loginButtonText}>Already have an account? Login</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.continueButton,
            !selectedPlan && styles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!selectedPlan}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
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
  },
  loadingText: {
    ...typography.body,
    marginTop: spacing.md,
    color: colors.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.xl,
  },
  header: {
    ...typography.h1,
    marginBottom: spacing.sm,
    color: colors.text,
  },
  subheader: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 22,
  },
  benefitsContainer: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  benefitText: {
    ...typography.body,
    color: colors.text,
    marginLeft: spacing.sm,
    flex: 1,
  },
  planCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
  },
  selectedPlanCard: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  popularPlanCard: {
    borderColor: colors.primary,
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    right: spacing.lg,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularBadgeText: {
    ...typography.caption,
    color: colors.secondary,
    fontWeight: '700',
    fontSize: 10,
  },
  planName: {
    ...typography.h2,
    marginBottom: spacing.sm,
    color: colors.text,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  currency: {
    ...typography.body,
    color: colors.textSecondary,
    marginRight: 4,
  },
  price: {
    ...typography.h1,
    fontSize: 36,
    color: colors.text,
  },
  period: {
    ...typography.body,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  freeNote: {
    ...typography.caption,
    color: colors.primary,
    marginBottom: spacing.md,
  },
  featuresContainer: {
    marginTop: spacing.md,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  featureIcon: {
    marginRight: spacing.sm,
  },
  featureText: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  selectedIndicator: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedIndicatorText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
  guaranteeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 8,
  },
  guaranteeText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  loginButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  loginButtonText: {
    ...typography.body,
    color: colors.primary,
  },
  continueButton: {
    paddingVertical: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.text,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: colors.border,
  },
  continueButtonText: {
    ...typography.body,
    color: colors.background,
    fontWeight: '600',
  },
});

export default SubscriptionPlansScreen;

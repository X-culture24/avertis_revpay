import React, { useState, useEffect } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { useRecoilState } from 'recoil';

import { colors, spacing, typography } from '@/theme/theme';
import { authState } from '@/store/atoms';
import { apiService } from '@/services/api';
import { User } from '@/types';

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation();
  const [auth, setAuth] = useRecoilState(authState);
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    businessName: '',
    kraPin: '',
    email: '',
    phone: '',
    posDetails: '',
  });

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const loadUserData = () => {
    if (auth.user) {
      setFormData({
        full_name: auth.user.full_name || auth.user.first_name || '',
        businessName: auth.user.businessName || '',
        kraPin: auth.user.kraPin || '',
        email: auth.user.email || '',
        phone: auth.user.phone || '',
        posDetails: auth.user.posDetails || '',
      });
    }
  };

  const handleUpdateProfile = async () => {
    if (!formData.full_name || !formData.businessName || !formData.kraPin || !formData.email || !formData.phone) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const response = await apiService.updateUserProfile(formData);
      
      if (response.success && response.data) {
        setAuth(prev => ({
          ...prev,
          user: {
            ...prev.user,
            ...response.data,
            full_name: response.data.user?.full_name || formData.full_name,
            first_name: response.data.user?.first_name,
            last_name: response.data.user?.last_name,
          } as User,
        }));
        Alert.alert('Success', 'Profile updated successfully');
      } else {
        Alert.alert('Error', response.message || 'Failed to update profile');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUserData();
  }, [auth.user]);

  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.headerCard}>
          <View style={styles.headerContent}>
            <View style={styles.avatar}>
              <Text style={styles.avatarLabel}>
                {getInitials(formData.full_name || formData.businessName || 'User')}
              </Text>
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.businessName}>
                {formData.full_name || formData.businessName || 'User'}
              </Text>
              <Text style={styles.subscriptionType}>
                {auth.user?.subscriptionType || 'Free'} Plan
              </Text>
              {auth.user?.subscriptionExpiry && (
                <Text style={styles.subscriptionExpiry}>
                  Expires: {new Date(auth.user.subscriptionExpiry).toLocaleDateString()}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Profile Form */}
        <View style={styles.card}>
          <View style={styles.cardContent}>
            <Text style={styles.sectionTitle}>Personal Information</Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Full Name *</Text>
              <TextInput
                value={formData.full_name}
                onChangeText={(value) => updateFormData('full_name', value)}
                style={styles.textInput}
                placeholder="Enter your full name"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Email Address *</Text>
              <TextInput
                value={formData.email}
                onChangeText={(value) => updateFormData('email', value)}
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.textInput}
                placeholder="Enter email address"
                placeholderTextColor={colors.textSecondary}
                editable={false}
              />
              <Text style={styles.helperText}>Email cannot be changed</Text>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Phone Number *</Text>
              <TextInput
                value={formData.phone}
                onChangeText={(value) => updateFormData('phone', value)}
                keyboardType="phone-pad"
                style={styles.textInput}
                placeholder="Enter phone number"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          </View>
        </View>

        {/* Business Information */}
        <View style={styles.card}>
          <View style={styles.cardContent}>
            <Text style={styles.sectionTitle}>Business Information</Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Business Name *</Text>
              <TextInput
                value={formData.businessName}
                onChangeText={(value) => updateFormData('businessName', value)}
                style={styles.textInput}
                placeholder="Enter business name"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>KRA PIN *</Text>
              <TextInput
                value={formData.kraPin}
                onChangeText={(value) => updateFormData('kraPin', value)}
                autoCapitalize="characters"
                style={styles.textInput}
                placeholder="Enter KRA PIN"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Business Address (Optional)</Text>
              <TextInput
                value={formData.posDetails}
                onChangeText={(value) => updateFormData('posDetails', value)}
                multiline
                numberOfLines={3}
                style={[styles.textInput, styles.multilineInput]}
                placeholder="Enter business address"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <TouchableOpacity
              onPress={handleUpdateProfile}
              disabled={loading}
              style={[styles.updateButton, styles.primaryButton]}
            >
              <Text style={styles.primaryButtonText}>
                {loading ? 'Updating...' : 'Update Profile'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Account Stats */}
        <View style={styles.card}>
          <View style={styles.cardContent}>
            <Text style={styles.sectionTitle}>Account Statistics</Text>
            
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{auth.user?.totalInvoices || 0}</Text>
                <Text style={styles.statLabel}>Total Invoices</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{auth.user?.monthlyInvoices || 0}</Text>
                <Text style={styles.statLabel}>This Month</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{auth.user?.successRate || 0}%</Text>
                <Text style={styles.statLabel}>Success Rate</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Account Actions */}
        <View style={styles.card}>
          <View style={styles.cardContent}>
            <Text style={styles.sectionTitle}>Account Actions</Text>
            
            <TouchableOpacity
              onPress={() => Alert.alert('Change Password', 'Password change functionality will be implemented')}
              style={[styles.actionButton, styles.outlinedButton]}
            >
              <Text style={styles.outlinedButtonText}>Change Password</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => Alert.alert('Export Data', 'Data export functionality will be implemented')}
              style={[styles.actionButton, styles.outlinedButton]}
            >
              <Text style={styles.outlinedButtonText}>Export Data</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => Alert.alert('Delete Account', 'Are you sure you want to delete your account? This action cannot be undone.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => Alert.alert('Account deletion functionality will be implemented') }
              ])}
              style={[styles.actionButton, styles.outlinedButton, styles.dangerButton]}
            >
              <Text style={[styles.outlinedButtonText, styles.dangerButtonText]}>Delete Account</Text>
            </TouchableOpacity>
          </View>
        </View>
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
  headerCard: {
    margin: spacing.md,
    backgroundColor: colors.card,
    elevation: 2,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
  },
  avatar: {
    backgroundColor: colors.primary,
    marginRight: spacing.md,
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLabel: {
    color: colors.secondary,
    fontWeight: 'bold',
  },
  headerInfo: {
    flex: 1,
  },
  businessName: {
    ...typography.h3,
    marginBottom: spacing.xs,
  },
  subscriptionType: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  subscriptionExpiry: {
    ...typography.caption,
    color: colors.textSecondary,
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
  input: {
    marginBottom: spacing.md,
    backgroundColor: colors.background,
  },
  updateButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.xs,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    ...typography.h2,
    marginBottom: spacing.xs,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  actionButton: {
    marginBottom: spacing.md,
    borderColor: colors.primary,
    paddingVertical: spacing.xs,
  },
  dangerButton: {
    borderColor: colors.primary,
  },
  cardContent: {
    padding: spacing.lg,
  },
  inputContainer: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.xs,
    color: colors.text,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: 16,
  },
  multilineInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  primaryButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  primaryButtonText: {
    color: colors.secondary,
    fontWeight: 'bold',
    fontSize: 16,
  },
  outlinedButton: {
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  outlinedButtonText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 16,
  },
  dangerButtonText: {
    color: colors.secondary,
    fontWeight: 'bold',
    fontSize: 16,
  },
  helperText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
});

export default ProfileScreen;

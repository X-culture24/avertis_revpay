import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { TextInput, Button, Card, Avatar } from 'react-native-paper';
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
        businessName: auth.user.businessName || '',
        kraPin: auth.user.kraPin || '',
        email: auth.user.email || '',
        phone: auth.user.phone || '',
        posDetails: auth.user.posDetails || '',
      });
    }
  };

  const handleUpdateProfile = async () => {
    if (!formData.businessName || !formData.kraPin || !formData.email || !formData.phone) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const response = await apiService.updateUserProfile(formData);
      
      if (response.success && response.data) {
        setAuth(prev => ({
          ...prev,
          user: response.data,
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
        <Card style={styles.headerCard}>
          <Card.Content style={styles.headerContent}>
            <Avatar.Text 
              size={80} 
              label={getInitials(formData.businessName || 'Business')}
              style={styles.avatar}
              labelStyle={styles.avatarLabel}
            />
            <View style={styles.headerInfo}>
              <Text style={styles.businessName}>{formData.businessName || 'Business Name'}</Text>
              <Text style={styles.subscriptionType}>
                {auth.user?.subscriptionType || 'Free'} Plan
              </Text>
              {auth.user?.subscriptionExpiry && (
                <Text style={styles.subscriptionExpiry}>
                  Expires: {new Date(auth.user.subscriptionExpiry).toLocaleDateString()}
                </Text>
              )}
            </View>
          </Card.Content>
        </Card>

        {/* Profile Form */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Business Information</Text>
            
            <TextInput
              label="Business Name *"
              value={formData.businessName}
              onChangeText={(value) => updateFormData('businessName', value)}
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
              label="KRA PIN *"
              value={formData.kraPin}
              onChangeText={(value) => updateFormData('kraPin', value)}
              mode="outlined"
              autoCapitalize="characters"
              style={styles.input}
              theme={{
                colors: {
                  primary: colors.primary,
                  outline: colors.border,
                }
              }}
            />

            <TextInput
              label="Email Address *"
              value={formData.email}
              onChangeText={(value) => updateFormData('email', value)}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
              theme={{
                colors: {
                  primary: colors.primary,
                  outline: colors.border,
                }
              }}
            />

            <TextInput
              label="Phone Number *"
              value={formData.phone}
              onChangeText={(value) => updateFormData('phone', value)}
              mode="outlined"
              keyboardType="phone-pad"
              style={styles.input}
              theme={{
                colors: {
                  primary: colors.primary,
                  outline: colors.border,
                }
              }}
            />

            <TextInput
              label="POS Details (Optional)"
              value={formData.posDetails}
              onChangeText={(value) => updateFormData('posDetails', value)}
              mode="outlined"
              multiline
              numberOfLines={3}
              style={styles.input}
              theme={{
                colors: {
                  primary: colors.primary,
                  outline: colors.border,
                }
              }}
              placeholder="Enter details about your POS system"
            />

            <Button
              mode="contained"
              onPress={handleUpdateProfile}
              loading={loading}
              disabled={loading}
              style={styles.updateButton}
              buttonColor={colors.primary}
              textColor={colors.secondary}
            >
              Update Profile
            </Button>
          </Card.Content>
        </Card>

        {/* Account Stats */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Account Statistics</Text>
            
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>0</Text>
                <Text style={styles.statLabel}>Total Invoices</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>0</Text>
                <Text style={styles.statLabel}>This Month</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>0%</Text>
                <Text style={styles.statLabel}>Success Rate</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Account Actions */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Account Actions</Text>
            
            <Button
              mode="outlined"
              onPress={() => {/* Handle password change */}}
              style={styles.actionButton}
              buttonColor={colors.background}
              textColor={colors.primary}
              icon="lock"
            >
              Change Password
            </Button>

            <Button
              mode="outlined"
              onPress={() => {/* Handle data export */}}
              style={styles.actionButton}
              buttonColor={colors.background}
              textColor={colors.primary}
              icon="download"
            >
              Export Data
            </Button>

            <Button
              mode="outlined"
              onPress={() => {/* Handle account deletion */}}
              style={[styles.actionButton, styles.dangerButton]}
              buttonColor={colors.background}
              textColor={colors.primary}
              icon="delete"
            >
              Delete Account
            </Button>
          </Card.Content>
        </Card>
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
    ...typography.small,
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
});

export default ProfileScreen;

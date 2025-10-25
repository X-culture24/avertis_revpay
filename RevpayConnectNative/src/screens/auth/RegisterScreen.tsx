import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSetRecoilState } from 'recoil';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { colors, spacing, typography } from '@/theme/theme';
import { authState } from '@/store/atoms';
import { apiService } from '@/services/api';
import { AuthStackParamList } from '@/types';
import { StackNavigationProp } from '@react-navigation/stack';

type RegisterScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'Register'>;

const RegisterScreen: React.FC = () => {
  const navigation = useNavigation<RegisterScreenNavigationProp>();
  const setAuth = useSetRecoilState(authState);
  
  const [formData, setFormData] = useState({
    businessName: '',
    kraPin: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    posDetails: '',
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    const { businessName, kraPin, email, phone, password, confirmPassword } = formData;
    
    if (!businessName || !kraPin || !email || !phone || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all required fields');
      return false;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return false;
    }

    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters long');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return false;
    }

    return true;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const { confirmPassword, ...registrationData } = formData;
      const response = await apiService.register(registrationData);
      
      if (response.success && response.data) {
        await AsyncStorage.setItem('auth_tokens', JSON.stringify(response.data.tokens));
        await AsyncStorage.setItem('user_data', JSON.stringify(response.data.user));
        
        setAuth({
          isAuthenticated: true,
          user: response.data.user,
          tokens: response.data.tokens,
          loading: false,
        });
        
        Alert.alert('Success', 'Account created successfully!');
      } else {
        Alert.alert('Registration Failed', response.message || 'Unable to create account');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join Revpay Connect Tax Platform</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardContent}>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Business Name *</Text>
              <TextInput
                value={formData.businessName}
                onChangeText={(value) => updateFormData('businessName', value)}
                style={styles.textInput}
                placeholder="Enter your business name"
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
                placeholder="Enter your KRA PIN"
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
                placeholder="Enter your email address"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Phone Number *</Text>
              <TextInput
                value={formData.phone}
                onChangeText={(value) => updateFormData('phone', value)}
                keyboardType="phone-pad"
                style={styles.textInput}
                placeholder="Enter your phone number"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>POS Details (Optional)</Text>
              <TextInput
                value={formData.posDetails}
                onChangeText={(value) => updateFormData('posDetails', value)}
                multiline
                numberOfLines={2}
                style={styles.multilineInput}
                placeholder="Enter POS details (optional)"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Password *</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  value={formData.password}
                  onChangeText={(value) => updateFormData('password', value)}
                  secureTextEntry={!showPassword}
                  style={styles.textInput}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.textSecondary}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.showPasswordButton}
                >
                  <Text style={styles.showPasswordText}>{showPassword ? "Hide" : "Show"}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Confirm Password *</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  value={formData.confirmPassword}
                  onChangeText={(value) => updateFormData('confirmPassword', value)}
                  secureTextEntry={!showConfirmPassword}
                  style={styles.textInput}
                  placeholder="Confirm your password"
                  placeholderTextColor={colors.textSecondary}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.showPasswordButton}
                >
                  <Text style={styles.showPasswordText}>{showConfirmPassword ? "Hide" : "Show"}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleRegister}
              disabled={loading}
              style={[styles.registerButton, loading && styles.disabledButton]}
            >
              <Text style={styles.registerButtonText}>
                {loading ? 'Creating Account...' : 'Create Account'}
              </Text>
            </TouchableOpacity>

            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={styles.loginButton}
              >
                <Text style={styles.loginButtonText}>Sign In</Text>
              </TouchableOpacity>
            </View>
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
  scrollContainer: {
    flexGrow: 1,
    padding: spacing.md,
    paddingTop: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h2,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.caption,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.card,
    elevation: 4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    borderRadius: 16,
  },
  cardContent: {
    padding: spacing.lg,
  },
  input: {
    marginBottom: spacing.md,
    backgroundColor: colors.background,
  },
  passwordContainer: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  passwordInput: {
    marginBottom: 0,
    paddingRight: 60,
  },
  showPasswordButton: {
    position: 'absolute',
    right: 8,
    top: 8,
    minWidth: 50,
  },
  registerButton: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    elevation: 2,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    ...typography.body,
    color: colors.textSecondary,
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
  showPasswordText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.6,
  },
  registerButtonText: {
    color: colors.secondary,
    fontWeight: 'bold',
    fontSize: 16,
  },
  loginButton: {
    padding: spacing.xs,
  },
  loginButtonText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 16,
  },
});

export default RegisterScreen;

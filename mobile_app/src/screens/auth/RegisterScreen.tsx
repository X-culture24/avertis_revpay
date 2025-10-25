import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { TextInput, Button, Card } from 'react-native-paper';
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
          <Text style={styles.subtitle}>Join Revpay Connect eTIMS Platform</Text>
        </View>

        <Card style={styles.card}>
          <Card.Content style={styles.cardContent}>
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
              numberOfLines={2}
              style={styles.input}
              theme={{
                colors: {
                  primary: colors.primary,
                  outline: colors.border,
                }
              }}
            />

            <TextInput
              label="Password *"
              value={formData.password}
              onChangeText={(value) => updateFormData('password', value)}
              mode="outlined"
              secureTextEntry={!showPassword}
              right={
                <TextInput.Icon 
                  icon={showPassword ? "eye-off" : "eye"} 
                  onPress={() => setShowPassword(!showPassword)}
                />
              }
              style={styles.input}
              theme={{
                colors: {
                  primary: colors.primary,
                  outline: colors.border,
                }
              }}
            />

            <TextInput
              label="Confirm Password *"
              value={formData.confirmPassword}
              onChangeText={(value) => updateFormData('confirmPassword', value)}
              mode="outlined"
              secureTextEntry={!showConfirmPassword}
              right={
                <TextInput.Icon 
                  icon={showConfirmPassword ? "eye-off" : "eye"} 
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                />
              }
              style={styles.input}
              theme={{
                colors: {
                  primary: colors.primary,
                  outline: colors.border,
                }
              }}
            />

            <Button
              mode="contained"
              onPress={handleRegister}
              loading={loading}
              disabled={loading}
              style={styles.registerButton}
              buttonColor={colors.primary}
              textColor={colors.secondary}
            >
              Create Account
            </Button>

            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <Button
                mode="text"
                onPress={() => navigation.goBack()}
                textColor={colors.primary}
                compact
              >
                Sign In
              </Button>
            </View>
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
    elevation: 2,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardContent: {
    padding: spacing.lg,
  },
  input: {
    marginBottom: spacing.md,
    backgroundColor: colors.background,
  },
  registerButton: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    paddingVertical: spacing.xs,
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
});

export default RegisterScreen;

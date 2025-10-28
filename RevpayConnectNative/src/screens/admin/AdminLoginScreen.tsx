import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
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
import { StackNavigationProp } from '@react-navigation/stack';

type AdminLoginScreenNavigationProp = StackNavigationProp<any, 'AdminLogin'>;

const AdminLoginScreen: React.FC = () => {
  const navigation = useNavigation<AdminLoginScreenNavigationProp>();
  const setAuth = useSetRecoilState(authState);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    admin_code: '',
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    const { email, password } = formData;
    
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all required fields');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return false;
    }

    return true;
  };

  const handleAdminLogin = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const response = await apiService.adminLogin(formData);
      
      if (response.success && response.data) {
        const { user, tokens } = response.data;
        
        // Verify admin permissions
        if (!user.is_staff && !user.is_superuser) {
          Alert.alert('Access Denied', 'You do not have administrator privileges');
          return;
        }

        await AsyncStorage.setItem('auth_tokens', JSON.stringify(tokens));
        await AsyncStorage.setItem('user_data', JSON.stringify(user));
        
        setAuth({
          isAuthenticated: true,
          user: user,
          tokens: tokens,
          loading: false,
        });
        
        Alert.alert('Success', 'Admin login successful!', [
          {
            text: 'OK',
            onPress: () => navigation.navigate('SystemAdmin')
          }
        ]);
      } else {
        Alert.alert('Login Failed', response.message || 'Invalid admin credentials');
      }
    } catch (error) {
      console.error('Admin login error:', error);
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
      <View style={styles.header}>
        <Text style={styles.title}>Administrator Login</Text>
        <Text style={styles.subtitle}>Access system administration features</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardContent}>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Admin Email *</Text>
            <TextInput
              value={formData.email}
              onChangeText={(value) => updateFormData('email', value)}
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.textInput}
              placeholder="Enter admin email address"
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
                placeholder="Enter admin password"
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
            <Text style={styles.inputLabel}>Admin Code (Optional)</Text>
            <TextInput
              value={formData.admin_code}
              onChangeText={(value) => updateFormData('admin_code', value)}
              style={styles.textInput}
              placeholder="Enter admin access code"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <TouchableOpacity
            onPress={handleAdminLogin}
            disabled={loading}
            style={[styles.loginButton, loading && styles.disabledButton]}
          >
            <Text style={styles.loginButtonText}>
              {loading ? 'Authenticating...' : 'Admin Login'}
            </Text>
          </TouchableOpacity>

          <View style={styles.warningContainer}>
            <Text style={styles.warningText}>
              ⚠️ Administrator access provides full system control including company management, 
              device configuration, and system settings. Only authorized personnel should access this area.
            </Text>
          </View>

          <View style={styles.backContainer}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Text style={styles.backButtonText}>← Back to User Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h2,
    marginBottom: spacing.xs,
    color: colors.primary,
  },
  subtitle: {
    ...typography.caption,
    textAlign: 'center',
    color: colors.textSecondary,
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
  passwordContainer: {
    position: 'relative',
  },
  showPasswordButton: {
    position: 'absolute',
    right: 8,
    top: 8,
    minWidth: 50,
    padding: spacing.sm,
  },
  showPasswordText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  loginButton: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 12,
    elevation: 2,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  loginButtonText: {
    color: colors.secondary,
    fontWeight: 'bold',
    fontSize: 16,
  },
  disabledButton: {
    opacity: 0.6,
  },
  warningContainer: {
    padding: spacing.md,
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFEAA7',
    marginBottom: spacing.md,
  },
  warningText: {
    ...typography.caption,
    color: '#856404',
    textAlign: 'center',
    lineHeight: 18,
  },
  backContainer: {
    alignItems: 'center',
  },
  backButton: {
    padding: spacing.md,
  },
  backButtonText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 16,
  },
});

export default AdminLoginScreen;

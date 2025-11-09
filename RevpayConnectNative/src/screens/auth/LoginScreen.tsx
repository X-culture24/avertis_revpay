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

type LoginScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'Login'>;

const LoginScreen: React.FC = () => {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const setAuth = useSetRecoilState(authState);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      // Test connectivity first - try to find working URL
      console.log('Testing backend connectivity...');
      console.log('Available URLs to test:', ['https://5b47348c2dfb.ngrok-free.app']);
      
      const workingURL = await apiService.findWorkingURL();
      console.log('🔍 Working URL result:', workingURL);
      
      // Try to login even if findWorkingURL fails - the server might still work
      console.log('🚀 Attempting login regardless of URL test result...');
      
      if (!workingURL) {
        console.log('⚠️ No working URL found in test, but trying login anyway...');
        
        // Test each URL individually and show results
        for (const url of ['https://5b47348c2dfb.ngrok-free.app']) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            
            const testResponse = await fetch(url + '/api/mobile/', { 
              method: 'GET',
              signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            console.log(`${url}/api/mobile/ - Response: ${testResponse.status}`);
          } catch (error: any) {
            console.log(`${url}/api/mobile/ - Error: ${error.message}`);
          }
        }
        
        console.log('⚠️ Connection test failed, but attempting login anyway...');
      }
      console.log('✅ Found working backend URL:', workingURL);

      console.log('Backend is reachable, attempting login...');
      const response = await apiService.login({ email, password });
      console.log('Login attempt completed:', response);
      
      if (response.success) {
        console.log('✅ Login successful, storing tokens and setting auth state');
        setAuth({
          isAuthenticated: true,
          user: response.data?.user || { email },
          tokens: { access: response.data?.token || '', refresh: response.data?.refresh || '' },
          loading: false
        });
      } else {
        Alert.alert('Login Failed', response.message || 'Invalid credentials');
      }
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Error', 'Network error occurred');
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
          <Text style={styles.title}>Revpay Connect</Text>
          <Text style={styles.subtitle}>Tax Compliance Platform</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardContent}>
            <Text style={styles.welcomeText}>Welcome Back</Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Username</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                style={styles.textInput}
                placeholder="Enter your username"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
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

            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              style={[styles.loginButton, loading && styles.disabledButton]}
            >
              <Text style={styles.loginButtonText}>
                {loading ? 'Signing In...' : 'Sign In'}
              </Text>
            </TouchableOpacity>

            <View style={styles.registerContainer}>
              <Text style={styles.registerText}>Don't have an account? </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Register')}
                style={styles.registerButton}
              >
                <Text style={styles.registerButtonText}>Create Account</Text>
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
    justifyContent: 'center',
    padding: spacing.md,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.h1,
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
  welcomeText: {
    ...typography.h2,
    textAlign: 'center',
    marginBottom: spacing.lg,
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
  loginButton: {
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
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerText: {
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
  showPasswordText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: colors.secondary,
    fontWeight: 'bold',
    fontSize: 16,
  },
  registerButton: {
    padding: spacing.xs,
  },
  registerButtonText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 16,
  },
});

export default LoginScreen;

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSetRecoilState } from 'recoil';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors, spacing, typography } from '@/theme/theme';
import { apiService } from '@/services/api';
import { authState } from '@/store/atoms';

const LoginScreen: React.FC = () => {
  const navigation = useNavigation();
  const setAuth = useSetRecoilState(authState);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter your email and password');
      return;
    }

    setLoading(true);
    try {
      const response = await apiService.login({ email, password });
      
      if (response.success && response.data) {
        setAuth({
          isAuthenticated: true,
          user: response.data.user,
          token: response.data.token,
        });
        // Navigation will automatically go to Main/Subscription screen
      } else {
        Alert.alert('Login Failed', response.message || 'Invalid credentials');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Email</Text>

        <View style={styles.inputContainer}>
          <Icon name="email-outline" size={20} color={colors.textSecondary} style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Enter your email address"
            placeholderTextColor={colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <Text style={styles.subtitle}>Password</Text>
        <View style={styles.inputContainer}>
          <Icon name="lock-outline" size={20} color={colors.textSecondary} style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Enter your password"
            placeholderTextColor={colors.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Icon
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.forgotPassword}>
          <Text style={styles.forgotPasswordText}>Forgot password?</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.loginButton}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.secondary} />
          ) : (
            <Text style={styles.loginButtonText}>Login</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.createAccount}
          onPress={() => (navigation as any).navigate('BusinessRegistration')}
        >
          <Text style={styles.createAccountText}>
            Create account? <Text style={styles.createAccountLink}>Register</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: 'center',
  },
  title: {
    ...typography.h1,
    fontSize: 28,
    marginBottom: spacing.xl,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.card,
  },
  icon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.text,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: spacing.xl,
  },
  forgotPasswordText: {
    ...typography.caption,
    color: colors.primary,
  },
  loginButton: {
    backgroundColor: colors.text,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  loginButtonText: {
    ...typography.body,
    color: colors.background,
    fontWeight: '600',
  },
  createAccount: {
    alignItems: 'center',
  },
  createAccountText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  createAccountLink: {
    color: colors.primary,
    fontWeight: '600',
  },
});

export default LoginScreen;

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
      const response = await apiService.login(email, password);
      
      if (response.success && response.data) {
        await AsyncStorage.setItem('auth_tokens', JSON.stringify(response.data.tokens));
        await AsyncStorage.setItem('user_data', JSON.stringify(response.data.user));
        
        setAuth({
          isAuthenticated: true,
          user: response.data.user,
          tokens: response.data.tokens,
          loading: false,
        });
      } else {
        Alert.alert('Login Failed', response.message || 'Invalid credentials');
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
          <Text style={styles.title}>Revpay Connect</Text>
          <Text style={styles.subtitle}>eTIMS Integration Platform</Text>
        </View>

        <Card style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <Text style={styles.welcomeText}>Welcome Back</Text>
            
            <TextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
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
              label="Password"
              value={password}
              onChangeText={setPassword}
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

            <Button
              mode="contained"
              onPress={handleLogin}
              loading={loading}
              disabled={loading}
              style={styles.loginButton}
              buttonColor={colors.primary}
              textColor={colors.secondary}
            >
              Sign In
            </Button>

            <View style={styles.registerContainer}>
              <Text style={styles.registerText}>Don't have an account? </Text>
              <Button
                mode="text"
                onPress={() => navigation.navigate('Register')}
                textColor={colors.primary}
                compact
              >
                Create Account
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
    elevation: 2,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
  loginButton: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    paddingVertical: spacing.xs,
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
});

export default LoginScreen;

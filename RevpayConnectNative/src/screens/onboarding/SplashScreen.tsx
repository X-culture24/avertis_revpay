import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRecoilState } from 'recoil';
import { authState } from '@/store/atoms';
import { colors, spacing, typography } from '@/theme/theme';

const SplashScreen: React.FC = () => {
  const navigation = useNavigation();
  const [auth, setAuth] = useRecoilState(authState);

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      // Check if user has auth token
      const authToken = await AsyncStorage.getItem('auth_token');
      
      // Wait a bit for splash effect
      await new Promise(resolve => setTimeout(resolve, 2000));

      if (authToken) {
        // User is logged in, go to main app
        setAuth({
          isAuthenticated: true,
          token: authToken,
          user: null, // Will be loaded from API
        });
        (navigation as any).replace('Main');
      } else {
        // Always show onboarding screens (removed onboarding_completed check)
        (navigation as any).replace('Welcome');
      }
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      // Default to onboarding on error
      (navigation as any).replace('Welcome');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.logo}>💳</Text>
        <Text style={styles.title}>RevPay Connect</Text>
        <Text style={styles.subtitle}>KRA eTIMS Solution</Text>
        <ActivityIndicator 
          size="large" 
          color={colors.primary} 
          style={styles.loader}
        />
      </View>
      <Text style={styles.footer}>Powered by RevPay</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    fontSize: 100,
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h1,
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  loader: {
    marginTop: spacing.xl,
  },
  footer: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
});

export default SplashScreen;

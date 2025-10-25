import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSetRecoilState } from 'recoil';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { colors, spacing, typography } from '@/theme/theme';
import { authState } from '@/store/atoms';
import { apiService } from '@/services/api';
import { AuthStackParamList } from '@/types';
import { StackNavigationProp } from '@react-navigation/stack';

type OTPScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'OTP'>;

interface OTPScreenParams {
  email: string;
  phone: string;
}

const OTPScreen: React.FC = () => {
  const navigation = useNavigation<OTPScreenNavigationProp>();
  const route = useRoute();
  const { email, phone } = route.params as OTPScreenParams;
  const setAuth = useSetRecoilState(authState);
  
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  
  const inputRefs = useRef<TextInput[]>([]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleOtpChange = (value: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOTP = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      Alert.alert('Error', 'Please enter the complete 6-digit code');
      return;
    }

    setLoading(true);
    try {
      const response = await apiService.verifyOTP(email, otpCode);
      
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
        Alert.alert('Error', response.message || 'Invalid verification code');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to verify code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (countdown > 0) return;

    setResendLoading(true);
    try {
      const response = await apiService.resendOTP(email);
      if (response.success) {
        setCountdown(60);
        Alert.alert('Success', 'Verification code sent successfully');
      } else {
        Alert.alert('Error', response.message || 'Failed to resend code');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to resend code. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>RC</Text>
          </View>
        </View>

        <Text style={styles.title}>Verification</Text>
        <Text style={styles.subtitle}>
          We've sent a 6-digit verification code to{'\n'}
          <Text style={styles.phoneNumber}>{phone}</Text>
        </Text>

        <View style={styles.otpContainer}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => {
                if (ref) inputRefs.current[index] = ref;
              }}
              style={[
                styles.otpInput,
                digit ? styles.otpInputFilled : null
              ]}
              value={digit}
              onChangeText={(value) => handleOtpChange(value, index)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
              keyboardType="numeric"
              maxLength={1}
              textAlign="center"
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.verifyButton, loading && styles.verifyButtonDisabled]}
          onPress={handleVerifyOTP}
          disabled={loading}
        >
          <Text style={styles.verifyButtonText}>
            {loading ? 'Verifying...' : 'Verify'}
          </Text>
        </TouchableOpacity>

        <View style={styles.resendContainer}>
          <Text style={styles.resendText}>Didn't receive the code? </Text>
          <TouchableOpacity
            onPress={handleResendOTP}
            disabled={countdown > 0 || resendLoading}
          >
            <Text style={[
              styles.resendLink,
              (countdown > 0 || resendLoading) && styles.resendLinkDisabled
            ]}>
              {countdown > 0 ? `Resend in ${countdown}s` : 'Resend'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 18,
    color: colors.text,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: spacing.xxxl,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    ...typography.h2,
    color: colors.secondary,
    fontWeight: '700',
  },
  title: {
    ...typography.h1,
    color: colors.text,
    fontWeight: '700',
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xxxl,
    lineHeight: 24,
  },
  phoneNumber: {
    color: colors.text,
    fontWeight: '600',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xxxl,
    paddingHorizontal: spacing.md,
  },
  otpInput: {
    width: 45,
    height: 55,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
  },
  otpInputFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.background,
  },
  verifyButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxxl,
    borderRadius: 25,
    marginBottom: spacing.xl,
    minWidth: 200,
  },
  verifyButtonDisabled: {
    opacity: 0.6,
  },
  verifyButtonText: {
    ...typography.body,
    color: colors.secondary,
    fontWeight: '600',
    textAlign: 'center',
  },
  resendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resendText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  resendLink: {
    ...typography.body,
    color: colors.accent,
    fontWeight: '600',
  },
  resendLinkDisabled: {
    color: colors.textSecondary,
  },
});

export default OTPScreen;

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors, spacing, typography } from '@/theme/theme';
import { apiService } from '@/services/api';

const BusinessRegistrationScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const params = route.params as any;
  const planId = params?.planId || 'free'; // Default to free plan
  const planName = params?.planName || 'Free Trial';
  const planPrice = params?.planPrice || 0;

  // User details
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Business details
  const [businessName, setBusinessName] = useState('');
  const [kraPin, setKraPin] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');

  // Device details
  const [deviceSerial, setDeviceSerial] = useState('');
  const [deviceType, setDeviceType] = useState<'oscu' | 'vscu'>('oscu');

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleRegister = async () => {
    // Validation
    if (!fullName || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all user details');
      return;
    }

    if (!businessName || !phoneNumber || !businessAddress) {
      Alert.alert('Error', 'Please fill in all business details');
      return;
    }

    if (!email.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    // Generate TIN if not provided (for testing)
    let finalKraPin = kraPin;
    if (!finalKraPin || finalKraPin.length !== 11) {
      // Generate temporary TIN for testing
      const timestamp = Date.now().toString();
      finalKraPin = `P${timestamp.slice(-10)}`;
      console.log('Generated temporary TIN:', finalKraPin);
    }

    // Generate device serial if not provided (for testing)
    let finalDeviceSerial = deviceSerial;
    if (!finalDeviceSerial) {
      const timestamp = Date.now().toString();
      finalDeviceSerial = `DEV${timestamp}`;
      console.log('Generated device serial:', finalDeviceSerial);
    }

    setLoading(true);
    try {
      // Register user, business, and device in one call
      const response = await apiService.post('/auth/register-business/', {
        // User details
        full_name: fullName,
        email,
        password,
        
        // Business details
        company_name: businessName,
        tin: finalKraPin,
        contact_phone: phoneNumber,
        business_address: businessAddress,
        contact_person: fullName,
        contact_email: email,
        
        // Device details
        device_serial_number: finalDeviceSerial,
        device_type: deviceType,
        
        // Subscription
        plan_id: planId,
      });

      if (response.success) {
        Alert.alert(
          'Registration Successful!',
          `Your business has been registered with KRA eTIMS.\n\n${!kraPin ? `Generated TIN: ${finalKraPin}\n` : ''}${!deviceSerial ? `Generated Device Serial: ${finalDeviceSerial}\n` : ''}\nYou can now login to access your dashboard.`,
          [
            {
              text: 'Login',
              onPress: () => (navigation as any).navigate('Login'),
            },
          ]
        );
      } else {
        Alert.alert('Registration Failed', response.message || 'Failed to register business');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'An error occurred during registration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Register Your Business</Text>
        <View style={styles.planBadge}>
          <Text style={styles.planBadgeText}>
            {planName} - KES {planPrice}/month
          </Text>
        </View>

        {/* User Details Section */}
        <Text style={styles.sectionTitle}>Your Details</Text>

        <Text style={styles.label}>Full Name</Text>
        <View style={styles.inputContainer}>
          <Icon name="account-outline" size={20} color={colors.textSecondary} style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Enter your full name"
            placeholderTextColor={colors.textSecondary}
            value={fullName}
            onChangeText={setFullName}
          />
        </View>

        <Text style={styles.label}>Email</Text>
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

        <Text style={styles.label}>Password</Text>
        <View style={styles.inputContainer}>
          <Icon name="lock-outline" size={20} color={colors.textSecondary} style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Enter password (min 8 characters)"
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

        <Text style={styles.label}>Confirm Password</Text>
        <View style={styles.inputContainer}>
          <Icon name="lock-check-outline" size={20} color={colors.textSecondary} style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Confirm your password"
            placeholderTextColor={colors.textSecondary}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />
        </View>

        {/* Business Details Section */}
        <Text style={styles.sectionTitle}>Business Details</Text>

        <Text style={styles.label}>Business Name</Text>
        <View style={styles.inputContainer}>
          <Icon name="domain" size={20} color={colors.textSecondary} style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Enter your business name"
            placeholderTextColor={colors.textSecondary}
            value={businessName}
            onChangeText={setBusinessName}
          />
        </View>

        <Text style={styles.label}>KRA PIN (TIN)</Text>
        <Text style={styles.helpText}>
          Your 11-character Tax Identification Number from KRA
        </Text>
        <Text style={styles.helpTextSmall}>
          For testing: Leave empty to generate a temporary TIN
        </Text>
        <View style={styles.inputContainer}>
          <Icon name="identifier" size={20} color={colors.textSecondary} style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="e.g., A001234567B (optional for testing)"
            placeholderTextColor={colors.textSecondary}
            value={kraPin}
            onChangeText={setKraPin}
            autoCapitalize="characters"
            maxLength={11}
          />
        </View>

        <Text style={styles.label}>Phone Number</Text>
        <View style={styles.inputContainer}>
          <Icon name="phone" size={20} color={colors.textSecondary} style={styles.icon} />
          <Text style={styles.prefix}>+254 |</Text>
          <TextInput
            style={styles.input}
            placeholder="7XX XXX XXX"
            placeholderTextColor={colors.textSecondary}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
          />
        </View>

        <Text style={styles.label}>Business Address</Text>
        <View style={styles.inputContainer}>
          <Icon name="map-marker" size={20} color={colors.textSecondary} style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Enter business address"
            placeholderTextColor={colors.textSecondary}
            value={businessAddress}
            onChangeText={setBusinessAddress}
            multiline
          />
        </View>

        {/* Device Details Section */}
        <Text style={styles.sectionTitle}>Device Registration</Text>

        <Text style={styles.label}>Device Serial Number</Text>
        <Text style={styles.helpText}>
          The serial number from your KRA-certified device
        </Text>
        <Text style={styles.helpTextSmall}>
          For testing: Leave empty to generate automatically
        </Text>
        <View style={styles.inputContainer}>
          <Icon name="barcode" size={20} color={colors.textSecondary} style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="e.g., DEV2026021800001 (optional)"
            placeholderTextColor={colors.textSecondary}
            value={deviceSerial}
            onChangeText={setDeviceSerial}
            autoCapitalize="characters"
          />
        </View>

        <Text style={styles.label}>Device Type</Text>
        <View style={styles.deviceTypeContainer}>
          <TouchableOpacity
            style={[
              styles.deviceTypeButton,
              deviceType === 'oscu' && styles.deviceTypeButtonActive,
            ]}
            onPress={() => setDeviceType('oscu')}
          >
            <Icon
              name="cloud-check"
              size={24}
              color={deviceType === 'oscu' ? colors.secondary : colors.text}
            />
            <Text
              style={[
                styles.deviceTypeText,
                deviceType === 'oscu' && styles.deviceTypeTextActive,
              ]}
            >
              OSCU
            </Text>
            <Text style={styles.deviceTypeDescription}>Real-time</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.deviceTypeButton,
              deviceType === 'vscu' && styles.deviceTypeButtonActive,
            ]}
            onPress={() => setDeviceType('vscu')}
          >
            <Icon
              name="cloud-upload"
              size={24}
              color={deviceType === 'vscu' ? colors.secondary : colors.text}
            />
            <Text
              style={[
                styles.deviceTypeText,
                deviceType === 'vscu' && styles.deviceTypeTextActive,
              ]}
            >
              VSCU
            </Text>
            <Text style={styles.deviceTypeDescription}>Batch</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.registerButton}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.registerButtonText}>Register Business</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.loginLink}
          onPress={() => (navigation as any).navigate('Login')}
        >
          <Text style={styles.loginLinkText}>
            Already have an account? <Text style={styles.loginLinkBold}>Login</Text>
          </Text>
        </TouchableOpacity>
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
  content: {
    padding: spacing.xl,
  },
  title: {
    ...typography.h1,
    fontSize: 28,
    marginBottom: spacing.sm,
  },
  planBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: spacing.xl,
  },
  planBadgeText: {
    ...typography.caption,
    color: colors.secondary,
    fontWeight: '600',
  },
  sectionTitle: {
    ...typography.h3,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  label: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
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
  prefix: {
    ...typography.body,
    color: colors.text,
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.text,
  },
  helpText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    fontStyle: 'italic',
  },
  helpTextSmall: {
    ...typography.caption,
    fontSize: 11,
    color: '#FF9800',
    marginBottom: spacing.sm,
    fontStyle: 'italic',
  },
  deviceTypeContainer: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  deviceTypeButton: {
    flex: 1,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: spacing.xs,
  },
  deviceTypeButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  deviceTypeText: {
    ...typography.body,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  deviceTypeTextActive: {
    color: colors.secondary,
  },
  deviceTypeDescription: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  registerButton: {
    backgroundColor: colors.text,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  registerButtonText: {
    ...typography.body,
    color: colors.background,
    fontWeight: '600',
  },
  loginLink: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  loginLinkText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  loginLinkBold: {
    color: colors.primary,
    fontWeight: '600',
  },
});

export default BusinessRegistrationScreen;

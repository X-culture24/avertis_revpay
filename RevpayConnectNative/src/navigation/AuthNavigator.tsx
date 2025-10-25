import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import OnboardingScreen from '@/screens/OnboardingScreen';
import WelcomeScreen from '@/screens/WelcomeScreen';
import LoginScreen from '@/screens/auth/LoginScreen';
import RegisterScreen from '@/screens/auth/RegisterScreen';
import OTPScreen from '@/screens/auth/OTPScreen';
import { AuthStackParamList } from '@/types';
import { colors } from '@/theme/theme';

const Stack = createStackNavigator<AuthStackParamList>();

const AuthNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="Onboarding"
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.background,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: 'bold',
          color: colors.text,
        },
        cardStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen 
        name="Onboarding" 
        component={OnboardingScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="Welcome" 
        component={WelcomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="Login" 
        component={LoginScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="Register" 
        component={RegisterScreen}
        options={{ 
          title: 'Create Account',
          headerBackTitleVisible: false,
        }}
      />
      <Stack.Screen 
        name="OTP" 
        component={OTPScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};

export default AuthNavigator;

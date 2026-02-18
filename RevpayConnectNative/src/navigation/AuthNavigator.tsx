import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import LoginScreen from '@/screens/auth/LoginScreen';
import SubscriptionPlansScreen from '@/screens/subscription/SubscriptionPlansScreen';
import BusinessRegistrationScreen from '@/screens/subscription/BusinessRegistrationScreen';
import { AuthStackParamList } from '@/types';
import { colors } from '@/theme/theme';

const Stack = createStackNavigator<AuthStackParamList>();

/**
 * Auth Navigator - Glovo-like subscription-first flow
 * 
 * Flow:
 * 1. Login Screen (existing users)
 * 2. Subscription Plans Screen (new users see plans first)
 * 3. Business Registration Screen (complete registration with selected plan)
 * 4. Auto-login and redirect to Dashboard
 */
const AuthNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="Login"
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
        name="Login" 
        component={LoginScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="SubscriptionPlans" 
        component={SubscriptionPlansScreen}
        options={{ 
          headerShown: false,
          // Prevent going back to login from plans screen
          gestureEnabled: false,
        }}
      />
      <Stack.Screen 
        name="BusinessRegistration" 
        component={BusinessRegistrationScreen}
        options={{ 
          title: 'Complete Registration',
          headerBackTitleVisible: false,
        }}
      />
    </Stack.Navigator>
  );
};

export default AuthNavigator;

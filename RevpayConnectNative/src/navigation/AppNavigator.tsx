import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useRecoilValue } from 'recoil';

import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import BrandedSplashScreen from '@/screens/onboarding/BrandedSplashScreen';
import SplashScreen from '@/screens/onboarding/SplashScreen';
import WelcomeScreen from '@/screens/onboarding/WelcomeScreen';
import { authState } from '@/store/atoms';
import { RootStackParamList } from '@/types';

const Stack = createStackNavigator<RootStackParamList>();

const AppNavigator: React.FC = () => {
  const { isAuthenticated } = useRecoilValue(authState);

  return (
    <Stack.Navigator 
      initialRouteName="BrandedSplash"
      screenOptions={{ headerShown: false }}
    >
      {/* Branded Splash - First screen */}
      <Stack.Screen name="BrandedSplash" component={BrandedSplashScreen} />
      
      {/* Onboarding Screens - Always available */}
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      
      {/* Auth and Main Stacks */}
      {isAuthenticated ? (
        <Stack.Screen name="Main" component={MainNavigator} />
      ) : (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;

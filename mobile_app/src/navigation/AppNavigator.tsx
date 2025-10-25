import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useRecoilValue } from 'recoil';

import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import { authState } from '@/store/atoms';
import { RootStackParamList } from '@/types';

const Stack = createStackNavigator<RootStackParamList>();

const AppNavigator: React.FC = () => {
  const { isAuthenticated } = useRecoilValue(authState);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <Stack.Screen name="Main" component={MainNavigator} />
      ) : (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;

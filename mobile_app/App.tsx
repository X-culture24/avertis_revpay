import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { RecoilRoot } from 'recoil';
import { NavigationContainer } from '@react-navigation/native';
import { Provider as PaperProvider } from 'react-native-paper';
import Toast from 'react-native-toast-message';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import AppNavigator from './src/navigation/AppNavigator';
import { theme } from './src/theme/theme';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <RecoilRoot>
        <PaperProvider theme={theme}>
          <NavigationContainer>
            <AppNavigator />
            <StatusBar style="dark" backgroundColor="#ffffff" />
            <Toast />
          </NavigationContainer>
        </PaperProvider>
      </RecoilRoot>
    </GestureHandlerRootView>
  );
}

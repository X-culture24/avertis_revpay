/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import './src/polyfills'; // Import polyfills first
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { RecoilRoot } from 'recoil';
import { StatusBar, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <View style={{ flex: 1 }}>
      <RecoilRoot>
        <SafeAreaProvider>
          <NavigationContainer>
            <AppNavigator />
            <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
          </NavigationContainer>
        </SafeAreaProvider>
      </RecoilRoot>
    </View>
  );
}

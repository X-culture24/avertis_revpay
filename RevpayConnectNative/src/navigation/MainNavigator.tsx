import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Text } from 'react-native';

import DashboardScreen from '@/screens/main/DashboardScreen';
import InvoicesScreen from '@/screens/main/InvoicesScreen';
import CreateInvoiceScreen from '@/screens/main/CreateInvoiceScreen';
import InvoiceDetailsScreen from '@/screens/main/InvoiceDetailsScreen';
import ReceiptScreen from '@/screens/main/ReceiptScreen';
import ReportsScreen from '@/screens/main/ReportsScreen';
import SettingsScreen from '@/screens/main/SettingsScreen';
import ProfileScreen from '@/screens/main/ProfileScreen';
import CompanyRegistrationScreen from '@/screens/setup/CompanyRegistrationScreen';
import DeviceSetupScreen from '@/screens/setup/DeviceSetupScreen';
import { MainTabParamList, RootStackParamList } from '@/types';
import { colors } from '@/theme/theme';

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createStackNavigator<RootStackParamList>();

const InvoiceStack = () => (
  <Stack.Navigator
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
    }}
  >
    <Stack.Screen 
      name="InvoicesList" 
      component={InvoicesScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen 
      name="CreateInvoice" 
      component={CreateInvoiceScreen}
      options={{ 
        title: 'Create Invoice',
        headerBackTitleVisible: false,
      }}
    />
    <Stack.Screen 
      name="InvoiceDetails" 
      component={InvoiceDetailsScreen}
      options={{ 
        title: 'Invoice Details',
        headerBackTitleVisible: false,
      }}
    />
    <Stack.Screen 
      name="Receipt" 
      component={ReceiptScreen}
      options={{ 
        title: 'Receipt',
        headerBackTitleVisible: false,
      }}
    />
  </Stack.Navigator>
);

const SettingsStack = () => (
  <Stack.Navigator
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
    }}
  >
    <Stack.Screen 
      name="SettingsMain" 
      component={SettingsScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen 
      name="Profile" 
      component={ProfileScreen}
      options={{ 
        title: 'Profile',
        headerBackTitleVisible: false,
      }}
    />
    <Stack.Screen 
      name="CompanyRegistration" 
      component={CompanyRegistrationScreen}
      options={{ 
        title: 'Company Registration',
        headerBackTitleVisible: false,
      }}
    />
    <Stack.Screen 
      name="DeviceSetup" 
      component={DeviceSetupScreen}
      options={{ 
        title: 'Device Setup',
        headerBackTitleVisible: false,
      }}
    />
  </Stack.Navigator>
);

const MainNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconText;
          
          if (route.name === 'Dashboard') {
            iconText = focused ? '🏠' : '🏡';
          } else if (route.name === 'Invoices') {
            iconText = focused ? '📄' : '📃';
          } else if (route.name === 'Reports') {
            iconText = focused ? '📊' : '📈';
          } else if (route.name === 'SettingsTab') {
            iconText = focused ? '⚙️' : '🔧';
          }
          
          return <Text style={{ fontSize: size, color }}>{iconText}</Text>;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Invoices" component={InvoiceStack} />
      <Tab.Screen name="Reports" component={ReportsScreen} />
      <Tab.Screen name="SettingsTab" component={SettingsStack} options={{ title: 'Settings' }} />
    </Tab.Navigator>
  );
};

export default MainNavigator;

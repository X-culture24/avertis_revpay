import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

import DashboardScreen from '@/screens/main/DashboardScreen';
import InvoicesScreen from '@/screens/main/InvoicesScreen';
import CreateInvoiceScreen from '@/screens/main/CreateInvoiceScreen';
import InvoiceDetailsScreen from '@/screens/main/InvoiceDetailsScreen';
import ReportsScreen from '@/screens/main/ReportsScreen';
import SettingsScreen from '@/screens/main/SettingsScreen';
import ProfileScreen from '@/screens/main/ProfileScreen';
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
      name="Invoices" 
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
      name="Settings" 
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
  </Stack.Navigator>
);

const MainNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'Dashboard') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Invoices') {
            iconName = focused ? 'document-text' : 'document-text-outline';
          } else if (route.name === 'Reports') {
            iconName = focused ? 'bar-chart' : 'bar-chart-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          } else {
            iconName = 'help-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
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
      <Tab.Screen name="Settings" component={SettingsStack} />
    </Tab.Navigator>
  );
};

export default MainNavigator;

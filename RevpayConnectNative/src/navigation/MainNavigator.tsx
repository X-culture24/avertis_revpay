import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import DashboardScreen from '@/screens/main/DashboardScreen';
import InvoicesScreen from '@/screens/main/InvoicesScreen';
import CreateInvoiceScreen from '@/screens/main/CreateInvoiceScreen';
import InvoiceDetailsScreen from '@/screens/main/InvoiceDetailsScreen';
import ReceiptScreen from '@/screens/main/ReceiptScreen';
import ReportsScreen from '@/screens/main/ReportsScreen';
import SettingsScreen from '@/screens/main/SettingsScreen';
import ProfileScreen from '@/screens/main/ProfileScreen';
import NotificationsScreen from '@/screens/main/NotificationsScreen';
import SubscriptionScreen from '@/screens/main/SubscriptionScreen';
import HelpSupportScreen from '@/screens/main/HelpSupportScreen';
import DataStorageScreen from '@/screens/main/DataStorageScreen';
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
      name="Notifications" 
      component={NotificationsScreen}
      options={{ 
        title: 'Notifications',
        headerBackTitleVisible: false,
      }}
    />
    <Stack.Screen 
      name="Subscription" 
      component={SubscriptionScreen}
      options={{ 
        title: 'Subscription',
        headerBackTitleVisible: false,
      }}
    />
    <Stack.Screen 
      name="HelpSupport" 
      component={HelpSupportScreen}
      options={{ 
        title: 'Help & Support',
        headerBackTitleVisible: false,
      }}
    />
    <Stack.Screen 
      name="DataStorage" 
      component={DataStorageScreen}
      options={{ 
        title: 'Data & Storage',
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
          let iconName;
          
          if (route.name === 'Dashboard') {
            iconName = 'view-dashboard';
          } else if (route.name === 'Invoices') {
            iconName = 'file-document-multiple';
          } else if (route.name === 'Reports') {
            iconName = 'chart-bar';
          } else if (route.name === 'SettingsTab') {
            iconName = 'cog';
          }
          
          return <Icon name={iconName || 'circle'} size={size} color="#000000" />;
        },
        tabBarActiveTintColor: '#000000',
        tabBarInactiveTintColor: '#757575',
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen 
        name="Invoices" 
        component={InvoiceStack}
        options={{ title: 'Invoices' }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            // Navigate to InvoicesList when tab is pressed
            navigation.navigate('Invoices', { screen: 'InvoicesList' });
          },
        })}
      />
      <Tab.Screen name="Reports" component={ReportsScreen} />
      <Tab.Screen name="SettingsTab" component={SettingsStack} options={{ title: 'Settings' }} />
    </Tab.Navigator>
  );
};

export default MainNavigator;

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '@/types';

type BrandedSplashScreenNavigationProp = StackNavigationProp<RootStackParamList, 'BrandedSplash'>;

const BrandedSplashScreen: React.FC = () => {
  const navigation = useNavigation<BrandedSplashScreenNavigationProp>();

  useEffect(() => {
    // Show branded splash for 2 seconds, then move to regular splash
    const timer = setTimeout(() => {
      navigation.replace('Splash');
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <View style={styles.content}>
        <Text style={styles.brandName}>RevPay</Text>
        <View style={styles.poweredByContainer}>
          <Text style={styles.poweredByText}>powered by</Text>
          <Text style={styles.companyName}>Avertis Solutions</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  brandName: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 20,
    letterSpacing: 2,
  },
  poweredByContainer: {
    alignItems: 'center',
  },
  poweredByText: {
    fontSize: 14,
    color: '#CCCCCC',
    marginBottom: 8,
    letterSpacing: 1,
  },
  companyName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
});

export default BrandedSplashScreen;

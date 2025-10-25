import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRecoilValue } from 'recoil';

import { AuthStackParamList } from '@/types';
import { authState } from '@/store/atoms';

type OnboardingScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'Onboarding'>;

const { width, height } = Dimensions.get('window');

const OnboardingScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingScreenNavigationProp>();
  const auth = useRecoilValue(authState);
  const [currentPage, setCurrentPage] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Check if user is already authenticated
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (token && auth.isAuthenticated) {
        // User is logged in, navigate to main app
        // This will be handled by the AppNavigator
        return;
      }
    } catch (error) {
      console.log('Auth check error:', error);
    }
  };

  const handleScroll = (event: any) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const page = Math.round(scrollPosition / width);
    setCurrentPage(page);
  };

  const goToPage = (page: number) => {
    scrollViewRef.current?.scrollTo({ x: page * width, animated: true });
    setCurrentPage(page);
  };

  const handleGetStarted = () => {
    navigation.navigate('Welcome');
  };

  const onboardingData = [
    {
      id: 1,
      title: 'Revpay Connect',
      subtitle: '',
      description: 'Your comprehensive tax compliance platform',
      showLogo: true,
      showFooter: true,
    },
    {
      id: 2,
      title: 'Seamless Integration',
      subtitle: 'KRA eTIMS Compliance',
      description: 'Automatically sync your invoices with KRA eTIMS system. Real-time compliance monitoring and reporting.',
      showLogo: false,
      showFooter: false,
    },
    {
      id: 3,
      title: 'Smart Analytics',
      subtitle: 'Business Insights',
      description: 'Track your business performance with detailed analytics, compliance reports, and automated tax calculations.',
      showLogo: false,
      showFooter: false,
    },
  ];

  const renderPage = (item: any, index: number) => (
    <View key={item.id} style={styles.page}>
      <View style={styles.content}>
        {item.showLogo && (
          <View style={styles.logoContainer}>
            <View style={styles.logoPlaceholder}>
              <Text style={styles.logoText}>R</Text>
            </View>
          </View>
        )}
        
        <View style={styles.textContainer}>
          <Text style={styles.title}>{item.title}</Text>
          {item.subtitle && <Text style={styles.subtitle}>{item.subtitle}</Text>}
          <Text style={styles.description}>{item.description}</Text>
        </View>

        {item.showFooter && (
          <Text style={styles.footerText}>Powered by Avertis Solutions</Text>
        )}
      </View>

      {index === onboardingData.length - 1 && (
        <View style={styles.buttonContainer}>
          <TouchableOpacity onPress={handleGetStarted} style={styles.getStartedButton}>
            <Text style={styles.getStartedButtonText}>Get Started</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
      >
        {onboardingData.map((item, index) => renderPage(item, index))}
      </ScrollView>

      {/* Page Indicators */}
      <View style={styles.indicatorContainer}>
        {onboardingData.map((_, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => goToPage(index)}
            style={[
              styles.indicator,
              currentPage === index && styles.activeIndicator,
            ]}
          />
        ))}
      </View>

      {/* Skip Button */}
      {currentPage < onboardingData.length - 1 && (
        <TouchableOpacity onPress={handleGetStarted} style={styles.skipButton}>
          <Text style={styles.skipButtonText}>Skip</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  page: {
    width,
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 30,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 40,
  },
  logoPlaceholder: {
    width: 120,
    height: 120,
    backgroundColor: '#FFFFFF',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#000000',
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#CCCCCC',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#AAAAAA',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  footerText: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
    marginTop: 40,
  },
  buttonContainer: {
    width: '100%',
    paddingHorizontal: 20,
  },
  getStartedButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  getStartedButtonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: 'bold',
  },
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#444444',
    marginHorizontal: 4,
  },
  activeIndicator: {
    backgroundColor: '#FFFFFF',
    width: 24,
  },
  skipButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    padding: 10,
  },
  skipButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default OnboardingScreen;

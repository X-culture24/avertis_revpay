import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, typography } from '@/theme/theme';

const { width } = Dimensions.get('window');

interface OnboardingSlide {
  id: string;
  title: string;
  description: string;
  image: any; // Image source
}

const slides: OnboardingSlide[] = [
  {
    id: '1',
    title: 'Welcome to RevPay Connect',
    description: 'Your complete KRA eTIMS solution for seamless tax compliance in Kenya',
    image: require('@/assets/images/Revpay.jpeg'),
  },
  {
    id: '2',
    title: 'Seamless Integration',
    description: 'Connect with KRA eTIMS and manage your business compliance effortlessly',
    image: require('@/assets/images/Revpay2.jpeg'),
  },
  {
    id: '3',
    title: 'Get Started Today',
    description: 'Join thousands of businesses using RevPay for their tax compliance needs',
    image: require('@/assets/images/Revpay3.jpeg'),
  },
];

const WelcomeScreen: React.FC = () => {
  const navigation = useNavigation();
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    } else {
      handleGetStarted();
    }
  };

  const handleSkip = () => {
    handleGetStarted();
  };

  const handleGetStarted = async () => {
    // Navigate to Auth stack, which will show SubscriptionPlans
    (navigation as any).replace('Auth', { 
      screen: 'SubscriptionPlans' 
    });
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index || 0);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const renderSlide = ({ item }: { item: OnboardingSlide }) => (
    <View style={styles.slide}>
      <View style={styles.imageContainer}>
        <Image 
          source={item.image} 
          style={styles.image}
          resizeMode="contain"
        />
      </View>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.description}>{item.description}</Text>
    </View>
  );

  const renderDots = () => (
    <View style={styles.dotsContainer}>
      {slides.map((_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            index === currentIndex && styles.activeDot,
          ]}
        />
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        keyExtractor={(item) => item.id}
      />

      {renderDots()}

      <View style={styles.footer}>
        {currentIndex < slides.length - 1 ? (
          <>
            <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleNext} style={styles.nextButton}>
              <Text style={styles.nextText}>Next</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity onPress={handleGetStarted} style={styles.getStartedButton}>
            <Text style={styles.getStartedText}>Get Started</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  slide: {
    width,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  imageContainer: {
    width: width * 0.85,
    height: width * 0.85,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  title: {
    ...typography.h1,
    fontSize: 28,
    textAlign: 'center',
    marginBottom: spacing.md,
    color: colors.text,
  },
  description: {
    ...typography.body,
    fontSize: 16,
    textAlign: 'center',
    color: colors.textSecondary,
    lineHeight: 24,
    paddingHorizontal: spacing.lg,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    marginHorizontal: 4,
  },
  activeDot: {
    width: 24,
    backgroundColor: colors.primary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  skipButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  skipText: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  nextButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  nextText: {
    ...typography.body,
    color: colors.secondary,
    fontWeight: '600',
  },
  getStartedButton: {
    flex: 1,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: 8,
    alignItems: 'center',
  },
  getStartedText: {
    ...typography.body,
    color: colors.secondary,
    fontWeight: '600',
    fontSize: 16,
  },
});

export default WelcomeScreen;

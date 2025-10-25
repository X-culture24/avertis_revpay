import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { AuthStackParamList } from '@/types';

type WelcomeScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'Welcome'>;

const WelcomeScreen: React.FC = () => {
  const navigation = useNavigation<WelcomeScreenNavigationProp>();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Revpay Connect</Text>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          onPress={() => navigation.navigate('Login')}
          style={styles.loginButton}
        >
          <Text style={styles.loginButtonText}>Sign In</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={() => navigation.navigate('Register')}
          style={styles.registerButton}
        >
          <Text style={styles.registerButtonText}>Create Account</Text>
        </TouchableOpacity>
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
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 60,
  },
  buttonContainer: {
    width: '100%',
    gap: 16,
  },
  loginButton: {
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  registerButton: {
    paddingVertical: 16,
    borderColor: '#FFFFFF',
    borderWidth: 2,
    borderRadius: 12,
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 16,
  },
  registerButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default WelcomeScreen;

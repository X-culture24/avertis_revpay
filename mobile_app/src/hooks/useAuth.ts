import { useEffect } from 'react';
import { useRecoilState } from 'recoil';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authState } from '@/store/atoms';
import { apiService } from '@/services/api';
import { STORAGE_KEYS } from '@/utils/constants';

export const useAuth = () => {
  const [auth, setAuth] = useRecoilState(authState);

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    setAuth(prev => ({ ...prev, loading: true }));
    
    try {
      const [tokensData, userData] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKENS),
        AsyncStorage.getItem(STORAGE_KEYS.USER_DATA),
      ]);

      if (tokensData && userData) {
        const tokens = JSON.parse(tokensData);
        const user = JSON.parse(userData);
        
        setAuth({
          isAuthenticated: true,
          user,
          tokens,
          loading: false,
        });
      } else {
        setAuth({
          isAuthenticated: false,
          user: null,
          tokens: null,
          loading: false,
        });
      }
    } catch (error) {
      console.error('Error initializing auth:', error);
      setAuth({
        isAuthenticated: false,
        user: null,
        tokens: null,
        loading: false,
      });
    }
  };

  const login = async (email: string, password: string) => {
    setAuth(prev => ({ ...prev, loading: true }));
    
    try {
      const response = await apiService.login(email, password);
      
      if (response.success && response.data) {
        await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKENS, JSON.stringify(response.data.tokens));
        await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(response.data.user));
        
        setAuth({
          isAuthenticated: true,
          user: response.data.user,
          tokens: response.data.tokens,
          loading: false,
        });
        
        return { success: true };
      } else {
        setAuth(prev => ({ ...prev, loading: false }));
        return { success: false, message: response.message };
      }
    } catch (error) {
      setAuth(prev => ({ ...prev, loading: false }));
      return { success: false, message: 'Network error' };
    }
  };

  const logout = async () => {
    try {
      await apiService.logout();
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      await AsyncStorage.multiRemove([STORAGE_KEYS.AUTH_TOKENS, STORAGE_KEYS.USER_DATA]);
      setAuth({
        isAuthenticated: false,
        user: null,
        tokens: null,
        loading: false,
      });
    }
  };

  const updateUser = (userData: any) => {
    setAuth(prev => ({
      ...prev,
      user: { ...prev.user, ...userData },
    }));
  };

  return {
    ...auth,
    login,
    logout,
    updateUser,
    initializeAuth,
  };
};

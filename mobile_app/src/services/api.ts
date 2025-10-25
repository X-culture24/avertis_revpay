import axios, { AxiosInstance, AxiosResponse } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiResponse, AuthTokens } from '@/types';

const BASE_URL = __DEV__ 
  ? 'http://localhost:8000/api' 
  : 'https://your-production-api.com/api';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      async (config) => {
        const tokens = await this.getStoredTokens();
        if (tokens?.access) {
          config.headers.Authorization = `Bearer ${tokens.access}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to handle token refresh
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const tokens = await this.getStoredTokens();
            if (tokens?.refresh) {
              const newTokens = await this.refreshToken(tokens.refresh);
              await this.storeTokens(newTokens);
              originalRequest.headers.Authorization = `Bearer ${newTokens.access}`;
              return this.api(originalRequest);
            }
          } catch (refreshError) {
            await this.clearTokens();
            // Redirect to login screen
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  private async getStoredTokens(): Promise<AuthTokens | null> {
    try {
      const tokens = await AsyncStorage.getItem('auth_tokens');
      return tokens ? JSON.parse(tokens) : null;
    } catch {
      return null;
    }
  }

  private async storeTokens(tokens: AuthTokens): Promise<void> {
    await AsyncStorage.setItem('auth_tokens', JSON.stringify(tokens));
  }

  private async clearTokens(): Promise<void> {
    await AsyncStorage.removeItem('auth_tokens');
  }

  private async refreshToken(refreshToken: string): Promise<AuthTokens> {
    const response = await axios.post(`${BASE_URL}/auth/refresh/`, {
      refresh: refreshToken,
    });
    return response.data;
  }

  // Generic request method
  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    data?: any
  ): Promise<ApiResponse<T>> {
    try {
      const response: AxiosResponse<T> = await this.api.request({
        method,
        url,
        data,
      });

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'An error occurred',
        errors: error.response?.data?.errors,
      };
    }
  }

  // Auth methods
  async login(email: string, password: string) {
    return this.request<{ user: any; tokens: AuthTokens }>('POST', '/auth/login/', {
      email,
      password,
    });
  }

  async register(userData: {
    businessName: string;
    kraPin: string;
    email: string;
    phone: string;
    password: string;
    posDetails?: string;
  }) {
    return this.request<{ user: any; tokens: AuthTokens }>('POST', '/auth/register/', userData);
  }

  async logout() {
    const tokens = await this.getStoredTokens();
    if (tokens?.refresh) {
      await this.request('POST', '/auth/logout/', { refresh: tokens.refresh });
    }
    await this.clearTokens();
  }

  // Integration settings
  async getIntegrationSettings() {
    return this.request('GET', '/integration/settings/');
  }

  async updateIntegrationSettings(settings: any) {
    return this.request('PUT', '/integration/settings/', settings);
  }

  // Invoices
  async getInvoices(page = 1, limit = 20) {
    return this.request('GET', `/invoices/?page=${page}&limit=${limit}`);
  }

  async createInvoice(invoiceData: any) {
    return this.request('POST', '/invoices/', invoiceData);
  }

  async getInvoiceDetails(invoiceId: string) {
    return this.request('GET', `/invoices/${invoiceId}/`);
  }

  async resyncInvoice(invoiceId: string) {
    return this.request('POST', `/invoices/${invoiceId}/resync/`);
  }

  // Dashboard
  async getDashboardStats() {
    return this.request('GET', '/dashboard/stats/');
  }

  // Reports
  async getReports(month?: string, year?: number) {
    const params = new URLSearchParams();
    if (month) params.append('month', month);
    if (year) params.append('year', year.toString());
    
    return this.request('GET', `/reports/?${params.toString()}`);
  }

  // User profile
  async getUserProfile() {
    return this.request('GET', '/auth/profile/');
  }

  async updateUserProfile(profileData: any) {
    return this.request('PUT', '/auth/profile/', profileData);
  }
}

export const apiService = new ApiService();

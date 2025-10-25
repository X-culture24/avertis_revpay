import axios, { AxiosInstance, AxiosResponse } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiResponse, DashboardStats, Invoice, IntegrationSettings, ComplianceReport, User, AuthTokens } from '@/types';

// Network configuration - use ngrok tunnel for external access
const BASE_URL = __DEV__ ? 'https://056211fc8ef6.ngrok-free.app' : 'https://your-production-api.com';

// Single server configuration using ngrok tunnel
const POSSIBLE_URLS = [
  'https://056211fc8ef6.ngrok-free.app', // ngrok tunnel for external access
];

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: BASE_URL + '/api/mobile',
      timeout: 10000, // Reduced timeout for faster failure detection
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      withCredentials: false, // Important for mobile apps
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      async (config) => {
        const token = await AsyncStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to handle token refresh
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          await AsyncStorage.removeItem('auth_token');
          // Handle logout or redirect to login
        }
        return Promise.reject(error);
      }
    );
  }


  private async storeToken(token: string): Promise<void> {
    await AsyncStorage.setItem('auth_token', token);
  }

  private async clearToken(): Promise<void> {
    await AsyncStorage.removeItem('auth_token');
  }


  // Generic request method
  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    data?: any
  ): Promise<ApiResponse<T>> {
    try {
      console.log(`Making ${method} request to: ${this.api.defaults.baseURL}${url}`);
      console.log('Request data:', data);
      
      const response: AxiosResponse<T> = await this.api.request({
        method,
        url,
        data,
      });

      console.log('Response status:', response.status);
      console.log('Response data:', response.data);

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error('API Request Error:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      console.error('Error message:', error.message);
      
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'An error occurred',
        errors: error.response?.data?.errors,
      };
    }
  }

  // Auth methods
  async login(email: string, password: string) {
    console.log('Attempting login to:', `${this.api.defaults.baseURL}/auth/login/`);
    console.log('Login data:', { username: email, password: '***' });
    
    try {
      const response: AxiosResponse = await this.api.post('/auth/login/', {
        username: email,
        password,
      });

      console.log('Raw login response:', response.data);
      
      // Handle the Django JWT response format
      if (response.data.tokens && response.data.tokens.access) {
        await this.storeToken(response.data.tokens.access);
        
        return {
          success: true,
          data: {
            token: response.data.tokens.access,
            refresh: response.data.tokens.refresh,
            user: response.data.user
          }
        };
      } else {
        return {
          success: false,
          message: response.data.message || 'Login failed'
        };
      }
    } catch (error: any) {
      console.error('Login API Error:', error);
      console.error('Error response:', error.response?.data);
      
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Login failed'
      };
    }
  }

  async register(userData: any) {
    return this.request('POST', '/auth/register/', userData);
  }

  async logout() {
    await this.clearToken();
    return { success: true };
  }

  // Integration Settings
  async getIntegrationSettings() {
    return this.request<IntegrationSettings>('GET', '/api/devices/');
  }

  async updateIntegrationSettings(settings: Partial<IntegrationSettings>) {
    return this.request('PUT', '/api/devices/', settings);
  }

  async testConnection() {
    return this.request('GET', '/health/');
  }

  // Test connectivity with multiple URLs
  async findWorkingURL(): Promise<string | null> {
    console.log('=== DEBUGGING MOBILE CONNECTION ===');
    console.log('Testing URLs:', POSSIBLE_URLS);
    
    for (const url of POSSIBLE_URLS) {
      try {
        console.log(`\n🔍 Testing: ${url}`);
        
        // Test a simple endpoint that should exist
        const testUrl = url + '/admin/';
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // Reduced timeout
        
        console.log(`📡 Fetching: ${testUrl}`);
        const response = await fetch(testUrl, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            'Accept': 'text/html,application/json',
            'User-Agent': 'RevpayConnect-Mobile',
          }
        });
        
        clearTimeout(timeoutId);
        console.log(`✅ ${url} - Status: ${response.status}`);
        console.log(`✅ ${url} - Response OK: ${response.ok}`);
        
        // Accept any response that indicates server is reachable (including redirects)
        if (response.status >= 200 && response.status < 500) {
          console.log(`🎉 FOUND WORKING URL: ${url}`);
          this.api.defaults.baseURL = url + '/api/mobile';
          
          // Test the actual API endpoint
          try {
            const apiTestUrl = url + '/api/mobile/auth/login/';
            console.log(`🔍 Testing API endpoint: ${apiTestUrl}`);
            const apiResponse = await fetch(apiTestUrl, {
              method: 'OPTIONS',
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
              }
            });
            console.log(`✅ API endpoint status: ${apiResponse.status}`);
          } catch (apiError) {
            console.log(`⚠️ API endpoint test failed, but server is reachable`);
          }
          
          return url;
        }
      } catch (error: any) {
        console.log(`❌ ${url} - FAILED:`, {
          message: error?.message,
          name: error?.name,
          code: error?.code,
          errno: error?.errno,
          syscall: error?.syscall,
          address: error?.address,
          port: error?.port
        });
      }
    }
    console.log('💥 NO WORKING URL FOUND');
    return null;
  }

  // Test connectivity
  async ping() {
    try {
      console.log('Testing connection to:', this.api.defaults.baseURL);
      const baseUrl = this.api.defaults.baseURL?.replace('/api/mobile', '') || BASE_URL;
      const response = await fetch(`${baseUrl}/admin/`);
      console.log('Ping response status:', response.status);
      return response.ok || response.status === 302;
    } catch (error) {
      console.error('Ping failed:', error);
      return false;
    }
  }

  // Invoices
  async getInvoices(page = 1, limit = 20) {
    return this.request<Invoice[]>('GET', `/invoices/?page=${page}&limit=${limit}`);
  }

  async createInvoice(invoiceData: any) {
    return this.request('POST', '/invoices/create/', invoiceData);
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
    
    return this.request('GET', `/api/compliance/reports/?${params.toString()}`);
  }

  // User profile
  async getUserProfile() {
    return this.request('GET', '/profile/');
  }

  async updateUserProfile(profileData: any) {
    return this.request('PUT', '/profile/', profileData);
  }

  // Receipt
  async getReceiptData(invoiceId: string) {
    return this.request('GET', `/receipts/${invoiceId}/`);
  }

  // Notifications
  async getNotifications() {
    return this.request('GET', '/notifications/');
  }

  // Device Management
  async registerDevice(deviceData: any) {
    return this.request('POST', '/api/devices/', deviceData);
  }

  async getDevices() {
    return this.request('GET', '/devices/');
  }

  // VSCU Integration
  async registerVSCUDevice(deviceData: any) {
    return this.request('POST', '/api/vscu/devices/', deviceData);
  }

  async processVSCUTransaction(transactionData: any) {
    return this.request('POST', '/api/vscu/transactions/', transactionData);
  }

  // System Management
  async getSystemLogs(companyId?: string, limit = 10) {
    const params = new URLSearchParams();
    if (companyId) params.append('company_id', companyId);
    params.append('limit', limit.toString());
    
    return this.request('GET', `/api/logs/?${params.toString()}`);
  }

  async getEnvironmentStatus() {
    return this.request('GET', '/api/environment/status/');
  }

  async switchEnvironment(environment: 'sandbox' | 'production', companyId: string) {
    return this.request('POST', '/api/environment/switch/', {
      environment,
      company_id: companyId
    });
  }
}

export const apiService = new ApiService();

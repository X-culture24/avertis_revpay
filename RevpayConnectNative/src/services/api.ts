import axios, { AxiosInstance, AxiosResponse } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiResponse, DashboardStats, Invoice, IntegrationSettings, ComplianceReport, User, AuthTokens } from '@/types';

// Network configuration - use ngrok tunnel for external access
const BASE_URL = __DEV__ ? 'https://2ec64400f7cf.ngrok-free.app' : 'https://your-production-api.com';

// Single server configuration using ngrok tunnel
const POSSIBLE_URLS = [
  'https://2ec64400f7cf.ngrok-free.app', // ngrok tunnel for external access
];

class ApiService {
  private api: AxiosInstance;
  private token: string | null = null;
  private refreshToken: string | null = null;

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
        // Try instance token first, then AsyncStorage
        const instanceToken = this.token;
        const storageToken = await AsyncStorage.getItem('auth_token');
        const token = instanceToken || storageToken;
        
        console.log('🔍 Token check - Instance:', instanceToken ? 'YES' : 'NO', 'Storage:', storageToken ? 'YES' : 'NO');
        
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
          console.log('🔑 Adding auth token to request:', token.substring(0, 20) + '...');
        } else {
          console.log('⚠️ No auth token found in instance or storage');
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

  // Authentication
  async login(credentials: { email: string; password: string }) {
    // Backend expects 'username' field, not 'email'
    const loginData = {
      username: credentials.email,
      password: credentials.password
    };
    const response = await this.request<any>('POST', '/auth/login/', loginData);
    
    if (response.success && response.data) {
      // Handle Django JWT response format: {tokens: {access, refresh}, user}
      const { tokens, user } = response.data;
      
      if (tokens && tokens.access && tokens.refresh) {
        this.token = tokens.access;
        this.refreshToken = tokens.refresh;
        // Store token in AsyncStorage for request interceptor
        await AsyncStorage.setItem('auth_token', tokens.access);
        await AsyncStorage.setItem('refresh_token', tokens.refresh);
        console.log('💾 Tokens stored in AsyncStorage successfully');
        
        return {
          success: true,
          data: {
            token: tokens.access,
            refresh: tokens.refresh,
            user: user
          }
        };
      }
    }
    
    return response;
  }

  // Admin Authentication
  async adminLogin(credentials: { email: string; password: string; admin_code?: string }) {
    const response = await this.request<any>('POST', '/auth/admin-login/', credentials);
    
    if (response.success && response.data) {
      const { tokens, user } = response.data;
      
      if (tokens && tokens.access && tokens.refresh && user.is_staff) {
        this.token = tokens.access;
        this.refreshToken = tokens.refresh;
        return {
          success: true,
          data: {
            token: tokens.access,
            refresh: tokens.refresh,
            user: user
          }
        };
      }
    }
    
    return response;
  }

  // Check admin permissions
  async checkAdminPermissions() {
    return this.request<any>('GET', '/auth/admin-check/');
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
    return this.request<IntegrationSettings>('GET', '/devices/');
  }

  async updateIntegrationSettings(settings: Partial<IntegrationSettings>) {
    return this.request('PUT', '/devices/', settings);
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
    return this.request('POST', '/invoices/', invoiceData);
  }

  async getInvoiceDetails(invoiceId: string) {
    return this.request('GET', `/invoices/${invoiceId}/`);
  }

  async resyncInvoice(invoiceId: string) {
    return this.request('POST', `/invoices/${invoiceId}/resync/`);
  }

  async retryAllFailed() {
    // Note: Backend endpoint exists at /invoices/retry-all/ but not in mobile API
    // This will need to be added to mobile API endpoints
    return this.request('POST', '/invoices/retry-all/');
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
  async getCompanyProfile(): Promise<ApiResponse<any>> {
    return this.request('GET', '/company/profile/');
  }

  async getDevices(): Promise<ApiResponse<any>> {
    return this.request('GET', '/devices/');
  }

  async syncDevice(deviceId: string): Promise<ApiResponse<any>> {
    return this.request('POST', `/devices/${deviceId}/sync/`);
  }

  async getVSCUStatus(): Promise<ApiResponse<any>> {
    return this.request('GET', '/vscu/status/');
  }

  async triggerVSCUSync(): Promise<ApiResponse<any>> {
    return this.request('POST', '/vscu/sync/');
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
    return this.request('POST', '/devices/', deviceData);
  }

  // VSCU Integration
  async registerVSCUDevice(deviceData: any) {
    return this.request('POST', '/vscu/devices/', deviceData);
  }

  async processVSCUTransaction(transactionData: any) {
    return this.request('POST', '/vscu/transactions/', transactionData);
  }

  // System Management
  async getSystemLogs(companyId?: string, limit = 10) {
    const params = new URLSearchParams();
    if (companyId) params.append('company_id', companyId);
    params.append('limit', limit.toString());
    
    return this.request('GET', `/logs/?${params.toString()}`);
  }

  async getEnvironmentStatus() {
    return this.request('GET', '/environment/status/');
  }

  async switchEnvironment(environment: 'sandbox' | 'production') {
    return this.request('POST', '/environment/switch/', { environment });
  }

  // Company Registration & Device Setup (using existing endpoints)
  async registerCompany(companyData: any) {
    // Use existing register endpoint for company registration
    return this.request('POST', '/auth/register/', companyData);
  }

  async setupDevice(deviceData: any) {
    // Use existing devices endpoint for device setup
    return this.request('POST', '/devices/', deviceData);
  }

  async getCompanies() {
    return this.request('GET', '/companies/');
  }

  async getCompanyDetails(companyId: string) {
    return this.request('GET', `/companies/${companyId}/`);
  }

  async updateCompanyStatus(companyId: string, status: string) {
    return this.request('PUT', `/companies/${companyId}/status/`, { status });
  }

  async registerAdditionalDevice(companyId: string, deviceData: any) {
    return this.request('POST', `/companies/${companyId}/devices/`, deviceData);
  }

  // Device Initialization & Certification
  async initializeDevice(deviceData: any) {
    return this.request('POST', '/devices/initialize/', deviceData);
  }

  async certifyDevice(deviceId: string) {
    return this.request('POST', `/devices/${deviceId}/certify/`);
  }

  async getDeviceCertificationStatus(deviceId: string) {
    return this.request('GET', `/devices/${deviceId}/certification/`);
  }

  async regenerateDeviceKeys(deviceId: string) {
    return this.request('POST', `/devices/${deviceId}/regenerate-keys/`);
  }

  // System Administration
  async getSystemAnalytics(companyId?: string) {
    const endpoint = companyId ? `/analytics/${companyId}/` : '/analytics/';
    return this.request('GET', endpoint);
  }

  async getSystemCodes() {
    // Use existing items endpoint for system codes
    return this.request('GET', '/items/');
  }

  async syncSystemCodes() {
    // Use existing VSCU sync for system codes sync
    return this.request('POST', '/vscu/sync/');
  }

  async syncItems() {
    // Use existing VSCU sync for items sync
    return this.request('POST', '/vscu/sync/');
  }

  async getSyncHistory() {
    // Use existing reports endpoint for sync history
    return this.request('GET', '/reports/');
  }

  async getSystemHealth() {
    return this.request('GET', '/health/');
  }

  async getApiLogs(filters?: any) {
    return this.request('GET', '/logs/', filters);
  }

  async processRetryQueue() {
    return this.request('POST', '/retry-queue/process/');
  }

  async getRetryQueue() {
    return this.request('GET', '/system/retry-queue/');
  }
}

export const apiService = new ApiService();

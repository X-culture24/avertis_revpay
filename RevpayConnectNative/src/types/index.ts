export interface User {
  id: string;
  businessName: string;
  kraPin: string;
  email: string;
  phone: string;
  posDetails?: string;
  subscriptionType: 'Free' | 'SME' | 'Corporate';
  subscriptionExpiry: string;
  totalInvoices?: number;
  monthlyInvoices?: number;
  successRate?: number;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface IntegrationSettings {
  id: string;
  mode: 'OSCU' | 'VSCU';
  kraApiCredentials: string;
  kraApiToken?: string;
  lastSyncTimestamp?: string;
  isActive: boolean;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  customerName: string;
  customerPin?: string;
  items: InvoiceItem[];
  status: 'PENDING' | 'SUBMITTED' | 'FAILED' | 'SYNCED';
  integrationMode: 'OSCU' | 'VSCU';
  jsonPayload?: string;
  submissionResponse?: string;
  createdAt: string;
  updatedAt: string;
  retryCount?: number;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  totalAmount: number;
}

export interface ComplianceReport {
  id: string;
  month: string;
  year: number;
  totalInvoices: number;
  syncedInvoices: number;
  failedInvoices: number;
  successRate: number;
  totalRevenue: number;
  generatedAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Record<string, string[]>;
}

export interface DashboardStats {
  totalInvoices: number;
  total_invoices: number;
  syncedCount: number;
  successful_invoices: number;
  failedCount: number;
  failed_invoices: number;
  pendingCount: number;
  pending_invoices: number;
  currentMode: 'OSCU' | 'VSCU';
  lastSyncTime?: string;
  monthlyRevenue: number;
  total_revenue: string;
  total_tax: string;
  successRate: number;
  success_rate: number;
  active_devices: number;
  integration_mode: string;
  last_sync?: string;
}

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  Dashboard: undefined;
  Invoices: undefined;
  InvoicesList: undefined;
  CreateInvoice: undefined;
  InvoiceDetails: { invoiceId: string };
  Receipt: { invoiceId: string };
  Settings: undefined;
  SettingsMain: undefined;
  Reports: undefined;
  Profile: undefined;
  CompanyRegistration: undefined;
  DeviceSetup: undefined;
  Notifications: undefined;
  Subscription: undefined;
  HelpSupport: undefined;
  DataStorage: undefined;
};

export type MainStackParamList = {
  Dashboard: undefined;
  Invoices: undefined;
  InvoicesList: undefined;
  CreateInvoice: undefined;
  InvoiceDetails: { invoiceId: string };
  Receipt: { invoiceId: string };
  Settings: undefined;
  SettingsMain: undefined;
  Reports: undefined;
  Profile: undefined;
};

export type AuthStackParamList = {
  Onboarding: undefined;
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  OTP: { email: string; phone: string };
};

export type MainTabParamList = {
  Dashboard: undefined;
  Invoices: undefined;
  Reports: undefined;
  SettingsTab: undefined;
};

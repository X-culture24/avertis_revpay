export interface User {
  id: string;
  businessName: string;
  kraPin: string;
  email: string;
  phone: string;
  posDetails?: string;
  subscriptionType: 'Free' | 'SME' | 'Corporate';
  subscriptionExpiry: string;
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
  syncedCount: number;
  failedCount: number;
  pendingCount: number;
  currentMode: 'OSCU' | 'VSCU';
  lastSyncTime?: string;
  monthlyRevenue: number;
  successRate: number;
}

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Login: undefined;
  Register: undefined;
  Dashboard: undefined;
  Invoices: undefined;
  CreateInvoice: undefined;
  InvoiceDetails: { invoiceId: string };
  Settings: undefined;
  Reports: undefined;
  Profile: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Invoices: undefined;
  Reports: undefined;
  Settings: undefined;
};

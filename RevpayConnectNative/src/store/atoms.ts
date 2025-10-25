import { atom } from 'recoil';
import { User, AuthTokens, IntegrationSettings, Invoice, DashboardStats } from '@/types';

export const authState = atom({
  key: 'authState',
  default: {
    isAuthenticated: false,
    user: null as User | null,
    tokens: null as AuthTokens | null,
    loading: false,
  },
});

export const integrationSettingsState = atom({
  key: 'integrationSettingsState',
  default: null as IntegrationSettings | null,
});

export const invoicesState = atom({
  key: 'invoicesState',
  default: {
    invoices: [] as Invoice[],
    loading: false,
    error: null as string | null,
  },
});

export const dashboardStatsState = atom({
  key: 'dashboardStatsState',
  default: null as DashboardStats | null,
});

export const offlineInvoicesState = atom({
  key: 'offlineInvoicesState',
  default: [] as Invoice[],
});

export const networkState = atom({
  key: 'networkState',
  default: {
    isConnected: true,
    isInternetReachable: true,
  },
});

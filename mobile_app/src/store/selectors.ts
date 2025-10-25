import { selector } from 'recoil';
import { authState, invoicesState, dashboardStatsState, offlineInvoicesState } from './atoms';

export const userSelector = selector({
  key: 'userSelector',
  get: ({ get }) => {
    const auth = get(authState);
    return auth.user;
  },
});

export const isAuthenticatedSelector = selector({
  key: 'isAuthenticatedSelector',
  get: ({ get }) => {
    const auth = get(authState);
    return auth.isAuthenticated;
  },
});

export const pendingInvoicesSelector = selector({
  key: 'pendingInvoicesSelector',
  get: ({ get }) => {
    const invoices = get(invoicesState);
    return invoices.invoices.filter(invoice => invoice.status === 'PENDING');
  },
});

export const failedInvoicesSelector = selector({
  key: 'failedInvoicesSelector',
  get: ({ get }) => {
    const invoices = get(invoicesState);
    return invoices.invoices.filter(invoice => invoice.status === 'FAILED');
  },
});

export const syncedInvoicesSelector = selector({
  key: 'syncedInvoicesSelector',
  get: ({ get }) => {
    const invoices = get(invoicesState);
    return invoices.invoices.filter(invoice => invoice.status === 'SYNCED');
  },
});

export const totalOfflineInvoicesSelector = selector({
  key: 'totalOfflineInvoicesSelector',
  get: ({ get }) => {
    const offlineInvoices = get(offlineInvoicesState);
    return offlineInvoices.length;
  },
});

export const dashboardDataSelector = selector({
  key: 'dashboardDataSelector',
  get: ({ get }) => {
    const stats = get(dashboardStatsState);
    const invoices = get(invoicesState);
    const offlineCount = get(totalOfflineInvoicesSelector);
    
    return {
      stats,
      recentInvoices: invoices.invoices.slice(0, 5),
      offlineCount,
      loading: invoices.loading,
    };
  },
});

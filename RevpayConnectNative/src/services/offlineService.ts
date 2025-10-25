import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Invoice } from '@/types';

const OFFLINE_INVOICES_KEY = 'offline_invoices';
const SYNC_QUEUE_KEY = 'sync_queue';

export class OfflineService {
  private static instance: OfflineService;
  private isOnline: boolean = true;
  private syncInProgress: boolean = false;

  private constructor() {
    this.initializeNetworkListener();
  }

  static getInstance(): OfflineService {
    if (!OfflineService.instance) {
      OfflineService.instance = new OfflineService();
    }
    return OfflineService.instance;
  }

  private initializeNetworkListener() {
    NetInfo.addEventListener(state => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected && state.isInternetReachable;
      
      // If we just came back online, trigger sync
      if (wasOffline && this.isOnline) {
        this.syncOfflineInvoices();
      }
    });
  }

  async saveOfflineInvoice(invoice: Partial<Invoice>): Promise<void> {
    try {
      const offlineInvoices = await this.getOfflineInvoices();
      const newInvoice: Invoice = {
        ...invoice,
        id: `offline_${Date.now()}`,
        status: 'PENDING',
        integrationMode: 'VSCU',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Invoice;

      offlineInvoices.push(newInvoice);
      await AsyncStorage.setItem(OFFLINE_INVOICES_KEY, JSON.stringify(offlineInvoices));
    } catch (error) {
      console.error('Error saving offline invoice:', error);
      throw error;
    }
  }

  async getOfflineInvoices(): Promise<Invoice[]> {
    try {
      const stored = await AsyncStorage.getItem(OFFLINE_INVOICES_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error getting offline invoices:', error);
      return [];
    }
  }

  async removeOfflineInvoice(invoiceId: string): Promise<void> {
    try {
      const offlineInvoices = await this.getOfflineInvoices();
      const filtered = offlineInvoices.filter(invoice => invoice.id !== invoiceId);
      await AsyncStorage.setItem(OFFLINE_INVOICES_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error removing offline invoice:', error);
    }
  }

  async addToSyncQueue(invoiceId: string): Promise<void> {
    try {
      const queue = await this.getSyncQueue();
      if (!queue.includes(invoiceId)) {
        queue.push(invoiceId);
        await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
      }
    } catch (error) {
      console.error('Error adding to sync queue:', error);
    }
  }

  async getSyncQueue(): Promise<string[]> {
    try {
      const stored = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error getting sync queue:', error);
      return [];
    }
  }

  async removeFromSyncQueue(invoiceId: string): Promise<void> {
    try {
      const queue = await this.getSyncQueue();
      const filtered = queue.filter(id => id !== invoiceId);
      await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error removing from sync queue:', error);
    }
  }

  async syncOfflineInvoices(): Promise<void> {
    if (this.syncInProgress || !this.isOnline) {
      return;
    }

    this.syncInProgress = true;
    try {
      const offlineInvoices = await this.getOfflineInvoices();
      const syncQueue = await this.getSyncQueue();
      
      // Combine offline invoices and sync queue
      const invoicesToSync = [
        ...offlineInvoices.filter(invoice => invoice.status === 'PENDING'),
        ...syncQueue
      ];

      for (const item of invoicesToSync) {
        try {
          if (typeof item === 'string') {
            // It's an invoice ID from sync queue
            await this.syncInvoiceById(item);
            await this.removeFromSyncQueue(item);
          } else {
            // It's a full invoice object from offline storage
            await this.syncOfflineInvoiceObject(item);
            await this.removeOfflineInvoice(item.id);
          }
        } catch (error) {
          console.error(`Error syncing invoice:`, error);
          // Continue with next invoice even if one fails
        }
      }
    } catch (error) {
      console.error('Error during sync process:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  private async syncInvoiceById(invoiceId: string): Promise<void> {
    // This would call the API service to resync an existing invoice
    const { apiService } = await import('./api');
    await apiService.resyncInvoice(invoiceId);
  }

  private async syncOfflineInvoiceObject(invoice: Invoice): Promise<void> {
    // This would call the API service to create a new invoice
    const { apiService } = await import('./api');
    
    const payload = {
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customerName,
      customerPin: invoice.customerPin,
      amount: invoice.amount,
      taxAmount: invoice.taxAmount,
      totalAmount: invoice.totalAmount,
      items: invoice.items,
      integrationMode: 'VSCU',
    };

    await apiService.createInvoice(payload);
  }

  async clearOfflineData(): Promise<void> {
    try {
      await AsyncStorage.removeItem(OFFLINE_INVOICES_KEY);
      await AsyncStorage.removeItem(SYNC_QUEUE_KEY);
    } catch (error) {
      console.error('Error clearing offline data:', error);
    }
  }

  isNetworkAvailable(): boolean {
    return this.isOnline;
  }

  isSyncInProgress(): boolean {
    return this.syncInProgress;
  }

  async getOfflineInvoiceCount(): Promise<number> {
    const offlineInvoices = await this.getOfflineInvoices();
    const syncQueue = await this.getSyncQueue();
    return offlineInvoices.length + syncQueue.length;
  }
}

export const offlineService = OfflineService.getInstance();

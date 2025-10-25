import { useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { networkState } from '@/store/atoms';
import { offlineService } from '@/services/offlineService';

export const useOfflineSync = () => {
  const { isConnected, isInternetReachable } = useRecoilValue(networkState);
  const [syncInProgress, setSyncInProgress] = useState(false);
  const [offlineCount, setOfflineCount] = useState(0);

  const isOnline = isConnected && isInternetReachable;

  useEffect(() => {
    updateOfflineCount();
  }, []);

  useEffect(() => {
    if (isOnline && !syncInProgress) {
      handleAutoSync();
    }
  }, [isOnline]);

  const updateOfflineCount = async () => {
    try {
      const count = await offlineService.getOfflineInvoiceCount();
      setOfflineCount(count);
    } catch (error) {
      console.error('Error updating offline count:', error);
    }
  };

  const handleAutoSync = async () => {
    if (syncInProgress) return;

    setSyncInProgress(true);
    try {
      await offlineService.syncOfflineInvoices();
      await updateOfflineCount();
    } catch (error) {
      console.error('Error during auto sync:', error);
    } finally {
      setSyncInProgress(false);
    }
  };

  const manualSync = async () => {
    if (!isOnline) {
      throw new Error('No internet connection');
    }

    setSyncInProgress(true);
    try {
      await offlineService.syncOfflineInvoices();
      await updateOfflineCount();
      return { success: true };
    } catch (error) {
      console.error('Error during manual sync:', error);
      return { success: false, error: error.message };
    } finally {
      setSyncInProgress(false);
    }
  };

  const saveOfflineInvoice = async (invoiceData: any) => {
    try {
      await offlineService.saveOfflineInvoice(invoiceData);
      await updateOfflineCount();
      return { success: true };
    } catch (error) {
      console.error('Error saving offline invoice:', error);
      return { success: false, error: error.message };
    }
  };

  return {
    isOnline,
    syncInProgress,
    offlineCount,
    manualSync,
    saveOfflineInvoice,
    updateOfflineCount,
  };
};

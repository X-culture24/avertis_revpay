import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useSetRecoilState } from 'recoil';
import { networkState } from '@/store/atoms';

export const useNetworkStatus = () => {
  const [isConnected, setIsConnected] = useState(true);
  const [isInternetReachable, setIsInternetReachable] = useState(true);
  const setNetworkState = useSetRecoilState(networkState);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const connected = state.isConnected ?? false;
      const reachable = state.isInternetReachable ?? false;
      
      setIsConnected(connected);
      setIsInternetReachable(reachable);
      
      setNetworkState({
        isConnected: connected,
        isInternetReachable: reachable,
      });
    });

    return () => unsubscribe();
  }, [setNetworkState]);

  return {
    isConnected,
    isInternetReachable,
    isOnline: isConnected && isInternetReachable,
  };
};

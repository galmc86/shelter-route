import { useEffect, useRef } from 'react';
import { useFamilyGroupState } from './useFamilyGroupState';
import {
  isFamilyPushSupported,
  refreshFamilyPushStatus,
  syncFamilyPushSubscription,
  unregisterFamilyPushSubscription,
} from '../services/familyPushNotificationService';

export function useFamilyPushSubscription(): void {
  const { group } = useFamilyGroupState();
  const previousGroupCodeRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isFamilyPushSupported()) {
      return;
    }

    const previousGroupCode = previousGroupCodeRef.current;
    const nextGroupCode = group?.groupCode ?? null;
    previousGroupCodeRef.current = nextGroupCode;

    if (previousGroupCode && nextGroupCode && previousGroupCode !== nextGroupCode) {
      void unregisterFamilyPushSubscription(previousGroupCode);
    }

    const syncCurrentGroup = () => {
      void refreshFamilyPushStatus(nextGroupCode);

      if (!nextGroupCode || typeof document === 'undefined') {
        return;
      }

      if (document.hidden) {
        return;
      }

      if (Notification.permission !== 'granted') {
        return;
      }

      void syncFamilyPushSubscription(nextGroupCode);
    };

    syncCurrentGroup();

    const handleFocus = () => {
      syncCurrentGroup();
    };
    const handleOnline = () => {
      syncCurrentGroup();
    };
    const handleVisibility = () => {
      syncCurrentGroup();
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [group?.groupCode]);
}

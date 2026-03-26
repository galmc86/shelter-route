import { useEffect, useRef } from 'react';
import { useFamilyGroupState } from './useFamilyGroupState';
import {
  isFamilyPushSupported,
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

    if (previousGroupCode && previousGroupCode !== nextGroupCode) {
      void unregisterFamilyPushSubscription(previousGroupCode);
    }

    if (!nextGroupCode || Notification.permission !== 'granted') {
      return;
    }

    void syncFamilyPushSubscription(nextGroupCode);
  }, [group?.groupCode]);
}

import { useEffect } from 'react';
import { useFamilyGroupState } from './useFamilyGroupState';

interface FamilySyncPushMessage {
  type: 'FAMILY_SYNC_PUSH';
  groupCode?: string;
}

export function useFamilyPushRefresh(): void {
  const { group, retryFamilySync } = useFamilyGroupState();

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const handleMessage = (event: MessageEvent<FamilySyncPushMessage>) => {
      if (!event.data || event.data.type !== 'FAMILY_SYNC_PUSH') {
        return;
      }

      const targetGroupCode = event.data.groupCode?.toUpperCase();
      const currentGroupCode = group?.groupCode?.toUpperCase();
      if (targetGroupCode && currentGroupCode && targetGroupCode !== currentGroupCode) {
        return;
      }

      retryFamilySync();
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, [group?.groupCode, retryFamilySync]);
}

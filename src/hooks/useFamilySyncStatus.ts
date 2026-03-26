import { useEffect, useState } from 'react';
import {
  getFamilySyncStatus,
  subscribeToFamilySyncStatusChanges,
  type FamilySyncStatus,
} from '../services/familySyncStatusService';
import {
  FAMILY_SYNC_MODE_STORAGE_KEY,
  getFamilySyncMode,
  type FamilySyncMode,
} from '../services/familySyncModeService';

export interface UseFamilySyncStatusResult {
  mode: FamilySyncMode;
  status: FamilySyncStatus;
}

export function useFamilySyncStatus(): UseFamilySyncStatusResult {
  const [status, setStatus] = useState<FamilySyncStatus>(() => getFamilySyncStatus());
  const [mode, setMode] = useState<FamilySyncMode>(() => getFamilySyncMode());

  useEffect(() => {
    const handleStatusChange = () => {
      setStatus(getFamilySyncStatus());
      setMode(getFamilySyncMode());
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === FAMILY_SYNC_MODE_STORAGE_KEY || event.key === null) {
        setMode(getFamilySyncMode());
      }
    };

    handleStatusChange();
    const unsubscribe = subscribeToFamilySyncStatusChanges(handleStatusChange);
    window.addEventListener('storage', handleStorage);

    return () => {
      unsubscribe();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  return {
    mode,
    status,
  };
}

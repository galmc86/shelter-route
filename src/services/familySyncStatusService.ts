const STORAGE_KEY = 'shelter-route:family-sync-status';
const FAMILY_SYNC_STATUS_UPDATED_EVENT = 'family-sync-status-updated';

export interface FamilySyncStatus {
  pendingCount: number;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
}

const DEFAULT_STATUS: FamilySyncStatus = {
  pendingCount: 0,
  lastAttemptAt: null,
  lastSuccessAt: null,
  lastFailureAt: null,
  lastError: null,
};

export function getFamilySyncStatus(): FamilySyncStatus {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_STATUS;
    }

    const parsed = JSON.parse(raw) as Partial<FamilySyncStatus>;
    return {
      pendingCount: typeof parsed.pendingCount === 'number' ? parsed.pendingCount : 0,
      lastAttemptAt: typeof parsed.lastAttemptAt === 'string' ? parsed.lastAttemptAt : null,
      lastSuccessAt: typeof parsed.lastSuccessAt === 'string' ? parsed.lastSuccessAt : null,
      lastFailureAt: typeof parsed.lastFailureAt === 'string' ? parsed.lastFailureAt : null,
      lastError: typeof parsed.lastError === 'string' ? parsed.lastError : null,
    };
  } catch {
    return DEFAULT_STATUS;
  }
}

export function setFamilySyncPendingCount(pendingCount: number): void {
  saveFamilySyncStatus({
    ...getFamilySyncStatus(),
    pendingCount,
  });
}

export function recordFamilySyncSuccess(attemptedAt: string): void {
  saveFamilySyncStatus({
    ...getFamilySyncStatus(),
    lastAttemptAt: attemptedAt,
    lastSuccessAt: attemptedAt,
    lastError: null,
  });
}

export function recordFamilySyncFailure(attemptedAt: string, error: string): void {
  saveFamilySyncStatus({
    ...getFamilySyncStatus(),
    lastAttemptAt: attemptedAt,
    lastFailureAt: attemptedAt,
    lastError: error,
  });
}

export function resetFamilySyncStatus(): void {
  saveFamilySyncStatus(DEFAULT_STATUS);
}

export function subscribeToFamilySyncStatusChanges(listener: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleCustomUpdate = () => listener();
  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) {
      listener();
    }
  };

  window.addEventListener(FAMILY_SYNC_STATUS_UPDATED_EVENT, handleCustomUpdate);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(FAMILY_SYNC_STATUS_UPDATED_EVENT, handleCustomUpdate);
    window.removeEventListener('storage', handleStorage);
  };
}

function saveFamilySyncStatus(status: FamilySyncStatus): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(status));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(FAMILY_SYNC_STATUS_UPDATED_EVENT));
    }
  } catch {
    // ignore storage failures
  }
}

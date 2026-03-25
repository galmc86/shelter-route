const STORAGE_KEY = 'shelter-route:family-sync-status';

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

function saveFamilySyncStatus(status: FamilySyncStatus): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(status));
  } catch {
    // ignore storage failures
  }
}


const STORAGE_KEY = 'shelter-route:family-push-status';
const FAMILY_PUSH_STATUS_UPDATED_EVENT = 'family-push-status-updated';

export type FamilyPushPermissionState = 'unsupported' | 'default' | 'granted' | 'denied';
export type FamilyPushRegistrationState =
  | 'idle'
  | 'active'
  | 'needs_user_action'
  | 'unsupported'
  | 'error';
export type FamilyPushEnvironmentHint = 'none' | 'ios_home_screen_required';

export interface FamilyPushStatus {
  permission: FamilyPushPermissionState;
  state: FamilyPushRegistrationState;
  environmentHint: FamilyPushEnvironmentHint;
  registeredGroupCode: string | null;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
}

const DEFAULT_STATUS: FamilyPushStatus = {
  permission: 'default',
  state: 'idle',
  environmentHint: 'none',
  registeredGroupCode: null,
  lastAttemptAt: null,
  lastSuccessAt: null,
  lastFailureAt: null,
  lastError: null,
};

export function getFamilyPushStatus(): FamilyPushStatus {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_STATUS;
    }

    const parsed = JSON.parse(raw) as Partial<FamilyPushStatus>;
    return {
      permission: normalizePermission(parsed.permission),
      state: normalizeState(parsed.state),
      environmentHint: parsed.environmentHint === 'ios_home_screen_required' ? 'ios_home_screen_required' : 'none',
      registeredGroupCode: typeof parsed.registeredGroupCode === 'string'
        ? parsed.registeredGroupCode.toUpperCase()
        : null,
      lastAttemptAt: typeof parsed.lastAttemptAt === 'string' ? parsed.lastAttemptAt : null,
      lastSuccessAt: typeof parsed.lastSuccessAt === 'string' ? parsed.lastSuccessAt : null,
      lastFailureAt: typeof parsed.lastFailureAt === 'string' ? parsed.lastFailureAt : null,
      lastError: typeof parsed.lastError === 'string' ? parsed.lastError : null,
    };
  } catch {
    return DEFAULT_STATUS;
  }
}

export function patchFamilyPushStatus(patch: Partial<FamilyPushStatus>): void {
  saveFamilyPushStatus({
    ...getFamilyPushStatus(),
    ...patch,
    registeredGroupCode: typeof patch.registeredGroupCode === 'string'
      ? patch.registeredGroupCode.toUpperCase()
      : patch.registeredGroupCode === null
        ? null
        : getFamilyPushStatus().registeredGroupCode,
  });
}

export function resetFamilyPushStatus(): void {
  saveFamilyPushStatus(DEFAULT_STATUS);
}

export function subscribeToFamilyPushStatusChanges(listener: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleCustomUpdate = () => listener();
  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) {
      listener();
    }
  };

  window.addEventListener(FAMILY_PUSH_STATUS_UPDATED_EVENT, handleCustomUpdate);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(FAMILY_PUSH_STATUS_UPDATED_EVENT, handleCustomUpdate);
    window.removeEventListener('storage', handleStorage);
  };
}

function saveFamilyPushStatus(status: FamilyPushStatus): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(status));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(FAMILY_PUSH_STATUS_UPDATED_EVENT));
    }
  } catch {
    // ignore storage failures
  }
}

function normalizePermission(value: unknown): FamilyPushPermissionState {
  if (value === 'granted' || value === 'denied' || value === 'unsupported') {
    return value;
  }

  return 'default';
}

function normalizeState(value: unknown): FamilyPushRegistrationState {
  if (
    value === 'active'
    || value === 'needs_user_action'
    || value === 'unsupported'
    || value === 'error'
  ) {
    return value;
  }

  return 'idle';
}

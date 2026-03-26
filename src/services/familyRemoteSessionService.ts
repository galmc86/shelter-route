import { getDeviceId } from './deviceIdentityService';

export interface FamilyRemoteSession {
  deviceId: string;
  userId: string | null;
  authState: 'anonymous' | 'authenticated';
}

export type FamilyRemoteSessionConfig = Pick<FamilyRemoteSession, 'authState' | 'userId'>;

export interface FamilyRemoteAuthProvider {
  getSessionConfig(): FamilyRemoteSessionConfig | null;
  subscribe?(listener: () => void): () => void;
}

export const FAMILY_REMOTE_AUTH_STATE_STORAGE_KEY = 'shelter-route:family-remote-auth-state';
export const FAMILY_REMOTE_USER_ID_STORAGE_KEY = 'shelter-route:family-remote-user-id';
export const FAMILY_REMOTE_AUTH_STATE_QUERY_PARAM = 'familyRemoteAuthState';
export const FAMILY_REMOTE_USER_ID_QUERY_PARAM = 'familyRemoteUserId';

let familyRemoteAuthProvider: FamilyRemoteAuthProvider | null = null;
let familyRemoteAuthProviderUnsubscribe: (() => void) | null = null;
let familyRemoteAuthStorageUnsubscribe: (() => void) | null = null;
let builtInFamilyRemoteSessionConfig: FamilyRemoteSessionConfig | null = null;
const familyRemoteAuthListeners = new Set<() => void>();

export function setFamilyRemoteAuthSessionConfig(config: FamilyRemoteSessionConfig | null): FamilyRemoteSession {
  if (config === null) {
    builtInFamilyRemoteSessionConfig = null;

    if (typeof window !== 'undefined') {
      clearPersistedFamilyRemoteSessionConfig();
    }

    notifyFamilyRemoteAuthListeners();
    return getFamilyRemoteSession();
  }

  const normalizedConfig = normalizeFamilyRemoteSessionConfig(config);
  builtInFamilyRemoteSessionConfig = normalizedConfig;

  if (typeof window !== 'undefined') {
    persistFamilyRemoteSessionConfig(normalizedConfig);
  }

  notifyFamilyRemoteAuthListeners();
  return getFamilyRemoteSession();
}

export function clearFamilyRemoteAuthSessionConfig(): FamilyRemoteSession {
  return setFamilyRemoteAuthSessionConfig({
    authState: 'anonymous',
    userId: null,
  });
}

export function registerFamilyRemoteAuthProvider(provider: FamilyRemoteAuthProvider | null): void {
  familyRemoteAuthProvider = provider;
  syncFamilyRemoteAuthProviderSubscription();
  notifyFamilyRemoteAuthListeners();
}

export function subscribeToFamilyRemoteAuthChanges(listener: () => void): () => void {
  familyRemoteAuthListeners.add(listener);
  syncFamilyRemoteAuthProviderSubscription();
  syncFamilyRemoteAuthStorageSubscription();

  return () => {
    familyRemoteAuthListeners.delete(listener);
    syncFamilyRemoteAuthProviderSubscription();
    syncFamilyRemoteAuthStorageSubscription();
  };
}

export function getFamilyRemoteSession(search: string | null = null): FamilyRemoteSession {
  const providerConfig = getFamilyRemoteSessionConfigFromProvider();
  const builtInConfig = getFamilyRemoteSessionConfigFromBuiltInBridge();
  const queryConfig = getFamilyRemoteSessionConfigFromSearch(search);
  const storageConfig = getFamilyRemoteSessionConfigFromStorage();
  const envConfig = getFamilyRemoteSessionConfigFromEnv();
  const configuredSession = providerConfig ?? builtInConfig ?? queryConfig ?? storageConfig ?? envConfig ?? {
    authState: 'anonymous',
    userId: null,
  };

  return {
    deviceId: getDeviceId(),
    ...configuredSession,
  };
}

export function initializeFamilyRemoteSessionFromUrl(search: string | null = null): FamilyRemoteSession {
  const queryConfig = getFamilyRemoteSessionConfigFromSearch(search);

  if (queryConfig && typeof window !== 'undefined') {
    persistFamilyRemoteSessionConfig(queryConfig);
    builtInFamilyRemoteSessionConfig = queryConfig;
    notifyFamilyRemoteAuthListeners();
  }

  return getFamilyRemoteSession(search);
}

function getFamilyRemoteSessionConfigFromProvider(): FamilyRemoteSessionConfig | null {
  const config = familyRemoteAuthProvider?.getSessionConfig();
  if (!config) {
    return null;
  }

  return normalizeFamilyRemoteSessionConfig(config);
}

function getFamilyRemoteSessionConfigFromBuiltInBridge(): FamilyRemoteSessionConfig | null {
  if (!builtInFamilyRemoteSessionConfig) {
    return null;
  }

  return normalizeFamilyRemoteSessionConfig(builtInFamilyRemoteSessionConfig);
}

function getFamilyRemoteSessionConfigFromSearch(search: string | null): FamilyRemoteSessionConfig | null {
  const nextSearch = search ?? (typeof window !== 'undefined' ? window.location.search : '');
  if (!nextSearch) {
    return null;
  }

  const params = new URLSearchParams(nextSearch);
  const authState = params.get(FAMILY_REMOTE_AUTH_STATE_QUERY_PARAM);
  const userId = params.get(FAMILY_REMOTE_USER_ID_QUERY_PARAM);

  if (authState === null && userId === null) {
    return null;
  }

  return normalizeFamilyRemoteSessionConfig({
    authState,
    userId,
  });
}

function getFamilyRemoteSessionConfigFromStorage(): FamilyRemoteSessionConfig | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const authState = window.localStorage.getItem(FAMILY_REMOTE_AUTH_STATE_STORAGE_KEY);
  const userId = window.localStorage.getItem(FAMILY_REMOTE_USER_ID_STORAGE_KEY);

  if (authState === null && userId === null) {
    return null;
  }

  return normalizeFamilyRemoteSessionConfig({
    authState,
    userId,
  });
}

function getFamilyRemoteSessionConfigFromEnv(): FamilyRemoteSessionConfig | null {
  const authState = import.meta.env.VITE_FAMILY_REMOTE_AUTH_STATE as string | undefined;
  const userId = import.meta.env.VITE_FAMILY_REMOTE_USER_ID as string | undefined;

  if (!authState && !userId) {
    return null;
  }

  return normalizeFamilyRemoteSessionConfig({
    authState,
    userId,
  });
}

function normalizeFamilyRemoteSessionConfig(config: {
  authState?: string | null;
  userId?: string | null;
}): FamilyRemoteSessionConfig {
  const normalizedUserId = config.userId?.trim() || null;
  const normalizedAuthState =
    config.authState === 'authenticated'
      ? 'authenticated'
      : config.authState === 'anonymous'
        ? 'anonymous'
        : null;

  if (normalizedAuthState === 'anonymous') {
    return {
      authState: 'anonymous',
      userId: null,
    };
  }

  if (normalizedUserId) {
    return {
      authState: 'authenticated',
      userId: normalizedUserId,
    };
  }

  return {
    authState: 'anonymous',
    userId: null,
  };
}

function persistFamilyRemoteSessionConfig(config: FamilyRemoteSessionConfig): void {
  window.localStorage.setItem(FAMILY_REMOTE_AUTH_STATE_STORAGE_KEY, config.authState);
  if (config.userId) {
    window.localStorage.setItem(FAMILY_REMOTE_USER_ID_STORAGE_KEY, config.userId);
    return;
  }

  window.localStorage.removeItem(FAMILY_REMOTE_USER_ID_STORAGE_KEY);
}

function clearPersistedFamilyRemoteSessionConfig(): void {
  window.localStorage.removeItem(FAMILY_REMOTE_AUTH_STATE_STORAGE_KEY);
  window.localStorage.removeItem(FAMILY_REMOTE_USER_ID_STORAGE_KEY);
}

function notifyFamilyRemoteAuthListeners(): void {
  for (const listener of familyRemoteAuthListeners) {
    listener();
  }
}

function syncFamilyRemoteAuthProviderSubscription(): void {
  familyRemoteAuthProviderUnsubscribe?.();
  familyRemoteAuthProviderUnsubscribe = null;

  if (!familyRemoteAuthProvider?.subscribe || familyRemoteAuthListeners.size === 0) {
    return;
  }

  familyRemoteAuthProviderUnsubscribe = familyRemoteAuthProvider.subscribe(() => {
    notifyFamilyRemoteAuthListeners();
  });
}

function syncFamilyRemoteAuthStorageSubscription(): void {
  familyRemoteAuthStorageUnsubscribe?.();
  familyRemoteAuthStorageUnsubscribe = null;

  if (familyRemoteAuthListeners.size === 0 || typeof window === 'undefined') {
    return;
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.storageArea && event.storageArea !== window.localStorage) {
      return;
    }

    if (
      event.key !== null
      && event.key !== FAMILY_REMOTE_AUTH_STATE_STORAGE_KEY
      && event.key !== FAMILY_REMOTE_USER_ID_STORAGE_KEY
    ) {
      return;
    }

    builtInFamilyRemoteSessionConfig = getFamilyRemoteSessionConfigFromStorage();
    notifyFamilyRemoteAuthListeners();
  };

  window.addEventListener('storage', handleStorage);
  familyRemoteAuthStorageUnsubscribe = () => {
    window.removeEventListener('storage', handleStorage);
  };
}

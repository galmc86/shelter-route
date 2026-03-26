import { getDeviceId } from './deviceIdentityService';

export interface FamilyRemoteSession {
  deviceId: string;
  userId: string | null;
  authState: 'anonymous' | 'authenticated';
}

export const FAMILY_REMOTE_AUTH_STATE_STORAGE_KEY = 'shelter-route:family-remote-auth-state';
export const FAMILY_REMOTE_USER_ID_STORAGE_KEY = 'shelter-route:family-remote-user-id';
export const FAMILY_REMOTE_AUTH_STATE_QUERY_PARAM = 'familyRemoteAuthState';
export const FAMILY_REMOTE_USER_ID_QUERY_PARAM = 'familyRemoteUserId';

type FamilyRemoteSessionConfig = Pick<FamilyRemoteSession, 'authState' | 'userId'>;

export function getFamilyRemoteSession(search: string | null = null): FamilyRemoteSession {
  const queryConfig = getFamilyRemoteSessionConfigFromSearch(search);
  const storageConfig = getFamilyRemoteSessionConfigFromStorage();
  const envConfig = getFamilyRemoteSessionConfigFromEnv();
  const configuredSession = queryConfig ?? storageConfig ?? envConfig ?? {
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
  }

  return getFamilyRemoteSession(search);
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

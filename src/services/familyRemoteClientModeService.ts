export type FamilyRemoteClientMode = 'stub' | 'http';

export const FAMILY_REMOTE_CLIENT_STORAGE_KEY = 'shelter-route:family-remote-client';
export const FAMILY_REMOTE_CLIENT_QUERY_PARAM = 'familyRemoteClient';

export function getFamilyRemoteClientMode(search: string | null = null): FamilyRemoteClientMode {
  const queryMode = getFamilyRemoteClientModeFromSearch(search);
  const storageMode = typeof window !== 'undefined'
    ? window.localStorage.getItem(FAMILY_REMOTE_CLIENT_STORAGE_KEY)
    : null;
  const envMode = import.meta.env.VITE_FAMILY_REMOTE_CLIENT;
  const implicitMode = getImplicitFamilyRemoteClientMode();
  const mode = queryMode ?? storageMode ?? envMode ?? implicitMode;

  return mode === 'http' ? 'http' : 'stub';
}

function getImplicitFamilyRemoteClientMode(): FamilyRemoteClientMode | null {
  const remoteUrl = (import.meta.env.VITE_FAMILY_REMOTE_URL as string | undefined)?.trim();
  return remoteUrl ? 'http' : null;
}

export function initializeFamilyRemoteClientModeFromUrl(search: string | null = null): FamilyRemoteClientMode {
  const mode = getFamilyRemoteClientModeFromSearch(search);

  if (mode && typeof window !== 'undefined') {
    window.localStorage.setItem(FAMILY_REMOTE_CLIENT_STORAGE_KEY, mode);
  }

  return getFamilyRemoteClientMode(search);
}

function getFamilyRemoteClientModeFromSearch(search: string | null): FamilyRemoteClientMode | null {
  const nextSearch = search ?? (typeof window !== 'undefined' ? window.location.search : '');

  if (!nextSearch) {
    return null;
  }

  const params = new URLSearchParams(nextSearch);
  const value = params.get(FAMILY_REMOTE_CLIENT_QUERY_PARAM);

  return value === 'http' ? 'http' : value === 'stub' ? 'stub' : null;
}

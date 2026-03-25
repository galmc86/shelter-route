export type FamilySyncMode = 'local' | 'hybrid';

export const FAMILY_SYNC_MODE_STORAGE_KEY = 'shelter-route:family-sync-mode';
export const FAMILY_SYNC_MODE_QUERY_PARAM = 'familySyncMode';

export function getFamilySyncMode(search: string | null = null): FamilySyncMode {
  const queryMode = getFamilySyncModeFromSearch(search);
  const storageMode = typeof window !== 'undefined'
    ? window.localStorage.getItem(FAMILY_SYNC_MODE_STORAGE_KEY)
    : null;
  const envMode = import.meta.env.VITE_FAMILY_SYNC_MODE;
  const mode = queryMode ?? storageMode ?? envMode;

  return mode === 'hybrid' ? 'hybrid' : 'local';
}

export function initializeFamilySyncModeFromUrl(search: string | null = null): FamilySyncMode {
  const mode = getFamilySyncModeFromSearch(search);

  if (mode && typeof window !== 'undefined') {
    window.localStorage.setItem(FAMILY_SYNC_MODE_STORAGE_KEY, mode);
  }

  return getFamilySyncMode(search);
}

function getFamilySyncModeFromSearch(search: string | null): FamilySyncMode | null {
  const nextSearch = search ?? (typeof window !== 'undefined' ? window.location.search : '');

  if (!nextSearch) {
    return null;
  }

  const params = new URLSearchParams(nextSearch);
  const value = params.get(FAMILY_SYNC_MODE_QUERY_PARAM);

  return value === 'hybrid' ? 'hybrid' : value === 'local' ? 'local' : null;
}


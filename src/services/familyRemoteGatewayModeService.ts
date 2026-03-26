export type FamilyRemoteGatewayMode = 'mock' | 'backend';

export const FAMILY_REMOTE_GATEWAY_STORAGE_KEY = 'shelter-route:family-remote-gateway';
export const FAMILY_REMOTE_GATEWAY_QUERY_PARAM = 'familyRemoteGateway';

export function getFamilyRemoteGatewayMode(search: string | null = null): FamilyRemoteGatewayMode {
  const queryMode = getFamilyRemoteGatewayModeFromSearch(search);
  const storageMode = typeof window !== 'undefined'
    ? window.localStorage.getItem(FAMILY_REMOTE_GATEWAY_STORAGE_KEY)
    : null;
  const envMode = import.meta.env.VITE_FAMILY_REMOTE_GATEWAY;
  const implicitMode = getImplicitFamilyRemoteGatewayMode();
  const mode = queryMode ?? storageMode ?? envMode ?? implicitMode;

  return mode === 'backend' ? 'backend' : 'mock';
}

function getImplicitFamilyRemoteGatewayMode(): FamilyRemoteGatewayMode | null {
  const remoteUrl = (import.meta.env.VITE_FAMILY_REMOTE_URL as string | undefined)?.trim();
  return remoteUrl ? 'backend' : null;
}

export function initializeFamilyRemoteGatewayModeFromUrl(search: string | null = null): FamilyRemoteGatewayMode {
  const mode = getFamilyRemoteGatewayModeFromSearch(search);

  if (mode && typeof window !== 'undefined') {
    window.localStorage.setItem(FAMILY_REMOTE_GATEWAY_STORAGE_KEY, mode);
  }

  return getFamilyRemoteGatewayMode(search);
}

function getFamilyRemoteGatewayModeFromSearch(search: string | null): FamilyRemoteGatewayMode | null {
  const nextSearch = search ?? (typeof window !== 'undefined' ? window.location.search : '');

  if (!nextSearch) {
    return null;
  }

  const params = new URLSearchParams(nextSearch);
  const value = params.get(FAMILY_REMOTE_GATEWAY_QUERY_PARAM);

  return value === 'backend' ? 'backend' : value === 'mock' ? 'mock' : null;
}

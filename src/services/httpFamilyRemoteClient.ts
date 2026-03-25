import { resilientFetch } from './fetchClient';
import type { FamilyRemoteClient } from './familyRemoteClient';
import type { FamilyRemoteGroupRecord } from './familyRemoteModel';
import type { FamilyRemoteSession } from './familyRemoteSessionService';

const STORAGE_KEY_PREFIX = 'shelter-route:family-remote-http-cache:';
const REMOTE_CACHE_UPDATED_EVENT = 'family-remote-http-cache-updated';
const HTTP_ENDPOINT = (import.meta.env.VITE_FAMILY_REMOTE_URL as string | undefined)?.trim();

function getStorageKey(groupCode: string): string {
  return `${STORAGE_KEY_PREFIX}${groupCode.toUpperCase()}`;
}

function getHeaders(session: FamilyRemoteSession): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'X-Family-Device-Id': session.deviceId,
    ...(session.userId ? { 'X-Family-User-Id': session.userId } : {}),
    'X-Family-Auth-State': session.authState,
  };
}

function getEndpoint(groupCode: string): string | null {
  if (!HTTP_ENDPOINT) {
    return null;
  }

  return `${HTTP_ENDPOINT.replace(/\/+$/, '')}/${encodeURIComponent(groupCode.toUpperCase())}`;
}

function readCachedGroup(groupCode: string): FamilyRemoteGroupRecord | null {
  try {
    const raw = localStorage.getItem(getStorageKey(groupCode));
    return raw ? JSON.parse(raw) as FamilyRemoteGroupRecord : null;
  } catch {
    return null;
  }
}

function writeCachedGroup(record: FamilyRemoteGroupRecord): void {
  try {
    localStorage.setItem(getStorageKey(record.inviteCode), JSON.stringify(record));
    notifyCacheChanged(record.inviteCode);
  } catch {
    // ignore cache failures
  }
}

function clearCachedGroup(groupCode: string): void {
  try {
    localStorage.removeItem(getStorageKey(groupCode));
    notifyCacheChanged(groupCode);
  } catch {
    // ignore cache failures
  }
}

function notifyCacheChanged(groupCode: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(REMOTE_CACHE_UPDATED_EVENT, {
    detail: { groupCode: groupCode.toUpperCase() },
  }));
}

async function refreshGroup(groupCode: string, session: FamilyRemoteSession): Promise<void> {
  const endpoint = getEndpoint(groupCode);
  if (!endpoint) {
    return;
  }

  const result = await resilientFetch<FamilyRemoteGroupRecord>(endpoint, {
    method: 'GET',
    headers: getHeaders(session),
  }, {
    retries: 1,
    retryDelay: 500,
  });

  if (result.ok) {
    writeCachedGroup(result.data);
  }
}

async function pushGroup(record: FamilyRemoteGroupRecord, session: FamilyRemoteSession): Promise<void> {
  const endpoint = getEndpoint(record.inviteCode);
  if (!endpoint) {
    return;
  }

  const result = await resilientFetch<FamilyRemoteGroupRecord>(endpoint, {
    method: 'PUT',
    headers: getHeaders(session),
    body: JSON.stringify(record),
  }, {
    retries: 1,
    retryDelay: 500,
  });

  if (result.ok) {
    writeCachedGroup(result.data);
  }
}

async function deleteGroup(groupCode: string, session: FamilyRemoteSession): Promise<void> {
  const endpoint = getEndpoint(groupCode);
  if (!endpoint) {
    return;
  }

  await resilientFetch<{ deleted?: boolean }>(endpoint, {
    method: 'DELETE',
    headers: getHeaders(session),
  }, {
    retries: 1,
    retryDelay: 500,
  });
}

class HttpFamilyRemoteClient implements FamilyRemoteClient {
  fetchGroup(groupCode: string, session: FamilyRemoteSession): FamilyRemoteGroupRecord | null {
    void refreshGroup(groupCode, session);
    return readCachedGroup(groupCode);
  }

  upsertGroup(group: FamilyRemoteGroupRecord, session: FamilyRemoteSession): FamilyRemoteGroupRecord {
    writeCachedGroup(group);
    void pushGroup(group, session);
    return group;
  }

  clearGroup(groupCode: string, session: FamilyRemoteSession): void {
    clearCachedGroup(groupCode);
    void deleteGroup(groupCode, session);
  }

  subscribe(groupCode: string, _session: FamilyRemoteSession, listener: () => void): () => void {
    if (typeof window === 'undefined') {
      return () => {};
    }

    const normalizedCode = groupCode.toUpperCase();
    const key = getStorageKey(normalizedCode);

    const handleCustomUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ groupCode?: string }>;
      if (customEvent.detail?.groupCode?.toUpperCase() === normalizedCode) {
        listener();
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === key) {
        listener();
      }
    };

    window.addEventListener(REMOTE_CACHE_UPDATED_EVENT, handleCustomUpdate as EventListener);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(REMOTE_CACHE_UPDATED_EVENT, handleCustomUpdate as EventListener);
      window.removeEventListener('storage', handleStorage);
    };
  }
}

const httpFamilyRemoteClient = new HttpFamilyRemoteClient();

export function getHttpFamilyRemoteClient(): FamilyRemoteClient {
  return httpFamilyRemoteClient;
}


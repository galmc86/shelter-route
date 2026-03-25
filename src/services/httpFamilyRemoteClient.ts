import { resilientFetch } from './fetchClient';
import type { FamilyRemoteChangeEvent } from './familyRemoteChangeEvent';
import type { FamilyRemoteClient } from './familyRemoteClient';
import type { FamilyRemoteGroupRecord } from './familyRemoteModel';
import {
  decodeFamilyRemoteGroupResponse,
  encodeFamilyRemoteGroupRequest,
  getFamilyRemoteGroupEndpoint,
} from './familyRemoteHttpContract';
import type { FamilyRemoteSession } from './familyRemoteSessionService';

const STORAGE_KEY_PREFIX = 'shelter-route:family-remote-http-cache:';
const REMOTE_CACHE_UPDATED_EVENT = 'family-remote-http-cache-updated';
export const FAMILY_REMOTE_HTTP_POLL_INTERVAL_MS = 15000;

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
    notifyCacheChanged(record.inviteCode, 'updated');
  } catch {
    // ignore cache failures
  }
}

function clearCachedGroup(groupCode: string): void {
  try {
    localStorage.removeItem(getStorageKey(groupCode));
    notifyCacheChanged(groupCode, 'cleared');
  } catch {
    // ignore cache failures
  }
}

function notifyCacheChanged(groupCode: string, kind: FamilyRemoteChangeEvent['kind']): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(REMOTE_CACHE_UPDATED_EVENT, {
    detail: { groupCode: groupCode.toUpperCase(), kind },
  }));
}

function areRemoteGroupsEqual(
  left: FamilyRemoteGroupRecord | null,
  right: FamilyRemoteGroupRecord | null
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function refreshGroup(groupCode: string, session: FamilyRemoteSession): Promise<void> {
  const resolvedEndpoint = getFamilyRemoteGroupEndpoint(groupCode);
  if (!resolvedEndpoint) {
    return;
  }

  const result = await resilientFetch<unknown>(resolvedEndpoint, {
    method: 'GET',
    headers: getHeaders(session),
  }, {
    retries: 1,
    retryDelay: 500,
  });

  if (!result.ok) {
    if (result.error.code === 'HTTP' && result.error.statusCode === 404 && readCachedGroup(groupCode)) {
      clearCachedGroup(groupCode);
    }
    return;
  }

  const decodedRecord = decodeFamilyRemoteGroupResponse(result.data);
  if (!areRemoteGroupsEqual(readCachedGroup(groupCode), decodedRecord)) {
    writeCachedGroup(decodedRecord);
  }
}

async function pushGroup(record: FamilyRemoteGroupRecord, session: FamilyRemoteSession): Promise<void> {
  const endpoint = getFamilyRemoteGroupEndpoint(record.inviteCode);
  if (!endpoint) {
    return;
  }

  const result = await resilientFetch<unknown>(endpoint, {
    method: 'PUT',
    headers: getHeaders(session),
    body: JSON.stringify(encodeFamilyRemoteGroupRequest(record)),
  }, {
    retries: 1,
    retryDelay: 500,
  });

  if (result.ok) {
    writeCachedGroup(decodeFamilyRemoteGroupResponse(result.data));
  }
}

async function deleteGroup(groupCode: string, session: FamilyRemoteSession): Promise<void> {
  const endpoint = getFamilyRemoteGroupEndpoint(groupCode);
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

  subscribe(
    groupCode: string,
    _session: FamilyRemoteSession,
    listener: (event: FamilyRemoteChangeEvent) => void
  ): () => void {
    if (typeof window === 'undefined') {
      return () => {};
    }

    const normalizedCode = groupCode.toUpperCase();
    const key = getStorageKey(normalizedCode);
    const intervalId = window.setInterval(() => {
      void refreshGroup(normalizedCode, _session);
    }, FAMILY_REMOTE_HTTP_POLL_INTERVAL_MS);

    const handleCustomUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<Partial<FamilyRemoteChangeEvent>>;
      if (customEvent.detail?.groupCode?.toUpperCase() === normalizedCode) {
        listener({
          kind: customEvent.detail.kind === 'cleared' ? 'cleared' : 'updated',
          groupCode: normalizedCode,
        });
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === key) {
        listener({
          kind: event.newValue === null ? 'cleared' : 'updated',
          groupCode: normalizedCode,
        });
      }
    };

    window.addEventListener(REMOTE_CACHE_UPDATED_EVENT, handleCustomUpdate as EventListener);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener(REMOTE_CACHE_UPDATED_EVENT, handleCustomUpdate as EventListener);
      window.removeEventListener('storage', handleStorage);
    };
  }
}

const httpFamilyRemoteClient = new HttpFamilyRemoteClient();

export function getHttpFamilyRemoteClient(): FamilyRemoteClient {
  return httpFamilyRemoteClient;
}

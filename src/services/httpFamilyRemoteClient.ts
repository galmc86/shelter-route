import { resilientFetch } from './fetchClient';
import type { FamilyRemoteChangeEvent } from './familyRemoteChangeEvent';
import type { FamilyRemoteClient } from './familyRemoteClient';
import type { FamilyRemoteGroupRecord } from './familyRemoteModel';
import { queueFamilySyncMutation } from './familySyncQueueService';
import { recordFamilySyncFailure } from './familySyncStatusService';
import {
  decodeFamilyRemoteGroupResponse,
  encodeFamilyRemoteGroupRequest,
  getFamilyRemoteGroupEndpoint,
} from './familyRemoteHttpContract';
import type { FamilyRemoteSession } from './familyRemoteSessionService';

const STORAGE_KEY_PREFIX = 'shelter-route:family-remote-http-cache:';
const REMOTE_CACHE_UPDATED_EVENT = 'family-remote-http-cache-updated';
export const FAMILY_REMOTE_HTTP_POLL_INTERVAL_MS = 15000;
export const FAMILY_REMOTE_HTTP_MAX_POLL_INTERVAL_MS = 120000;
const activePollingSubscriptions = new Map<string, {
  refCount: number;
  timeoutId: number | null;
  refreshIfInteractive: () => void;
  consecutiveFailures: number;
  isRefreshing: boolean;
}>();

type FamilyRemotePollOutcome = 'success' | 'failure' | 'skipped';

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

function shouldPollRemoteGroup(): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }

  if (typeof document !== 'undefined' && document.hidden) {
    return false;
  }

  return true;
}

function getPollingSubscriptionKey(groupCode: string, session: FamilyRemoteSession): string {
  return [
    groupCode.toUpperCase(),
    session.deviceId,
    session.userId ?? '',
    session.authState,
  ].join('::');
}

function getNextPollingDelayMs(consecutiveFailures: number): number {
  if (consecutiveFailures <= 0) {
    return FAMILY_REMOTE_HTTP_POLL_INTERVAL_MS;
  }

  const backoffDelay = Math.min(
    FAMILY_REMOTE_HTTP_MAX_POLL_INTERVAL_MS,
    FAMILY_REMOTE_HTTP_POLL_INTERVAL_MS * Math.pow(2, consecutiveFailures)
  );
  const jitterFactor = 1 + ((Math.random() - 0.5) * 0.2);
  return Math.round(backoffDelay * jitterFactor);
}

async function refreshGroup(groupCode: string, session: FamilyRemoteSession): Promise<FamilyRemotePollOutcome> {
  const resolvedEndpoint = getFamilyRemoteGroupEndpoint(groupCode);
  if (!resolvedEndpoint) {
    return 'skipped';
  }

  const result = await resilientFetch<unknown>(resolvedEndpoint, {
    method: 'GET',
    headers: getHeaders(session),
  }, {
    retries: 1,
    retryDelay: 500,
  });

  if (!result.ok) {
    if (result.error.code === 'HTTP' && result.error.statusCode === 404) {
      if (readCachedGroup(groupCode)) {
        clearCachedGroup(groupCode);
      }
      return 'success';
    }
    return 'failure';
  }

  try {
    const decodedRecord = decodeFamilyRemoteGroupResponse(result.data);
    if (!areRemoteGroupsEqual(readCachedGroup(groupCode), decodedRecord)) {
      writeCachedGroup(decodedRecord);
    }
    return 'success';
  } catch {
    return 'failure';
  }
}

async function pushGroup(
  record: FamilyRemoteGroupRecord,
  session: FamilyRemoteSession,
  previousCachedRecord: FamilyRemoteGroupRecord | null
): Promise<void> {
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
    return;
  }

  const attemptedAt = new Date().toISOString();
  const queuedMutation = {
    kind: 'upsert' as const,
    groupCode: record.inviteCode,
    queuedAt: attemptedAt,
    record,
    removedMemberIds: previousCachedRecord
      ? previousCachedRecord.members
        .filter((member) => !record.members.some((candidate) => isSameRemoteIdentity(candidate, member)))
        .map((member) => member.id)
      : undefined,
    removedDeviceIds: previousCachedRecord
      ? previousCachedRecord.members
        .filter((member) => !record.members.some((candidate) => isSameRemoteIdentity(candidate, member)))
        .flatMap((member) => member.deviceId ? [member.deviceId] : [])
      : undefined,
  };

  if (result.error.code === 'HTTP' && result.error.statusCode === 409) {
    queueFamilySyncMutation(queuedMutation);
    await refreshGroup(record.inviteCode, session);
    return;
  }

  queueFamilySyncMutation(queuedMutation);
  recordFamilySyncFailure(attemptedAt, result.error.message);
}

async function deleteGroup(groupCode: string, session: FamilyRemoteSession): Promise<void> {
  const endpoint = getFamilyRemoteGroupEndpoint(groupCode);
  if (!endpoint) {
    return;
  }

  const result = await resilientFetch<{ deleted?: boolean }>(endpoint, {
    method: 'DELETE',
    headers: getHeaders(session),
  }, {
    retries: 1,
    retryDelay: 500,
  });

  if (result.ok) {
    return;
  }

  const attemptedAt = new Date().toISOString();
  queueFamilySyncMutation({
    kind: 'clear',
    groupCode,
    queuedAt: attemptedAt,
  });
  recordFamilySyncFailure(attemptedAt, result.error.message);
}

function acquirePollingSubscription(groupCode: string, session: FamilyRemoteSession): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  const normalizedCode = groupCode.toUpperCase();
  const subscriptionKey = getPollingSubscriptionKey(normalizedCode, session);
  const existingSubscription = activePollingSubscriptions.get(subscriptionKey);
  if (existingSubscription) {
    existingSubscription.refCount += 1;
    return () => releasePollingSubscription(subscriptionKey);
  }

  const refreshIfInteractive = () => {
    if (shouldPollRemoteGroup()) {
      const activeSubscription = activePollingSubscriptions.get(subscriptionKey);
      if (activeSubscription && activeSubscription.timeoutId !== null) {
        window.clearTimeout(activeSubscription.timeoutId);
        activeSubscription.timeoutId = null;
      }
      void runPollingRefreshCycle(subscriptionKey, normalizedCode, session);
    }
  };

  activePollingSubscriptions.set(subscriptionKey, {
    refCount: 1,
    timeoutId: null,
    refreshIfInteractive,
    consecutiveFailures: 0,
    isRefreshing: false,
  });
  scheduleNextPollingRefresh(subscriptionKey, normalizedCode, session);
  window.addEventListener('online', refreshIfInteractive);
  document.addEventListener('visibilitychange', refreshIfInteractive);

  return () => releasePollingSubscription(subscriptionKey);
}

function scheduleNextPollingRefresh(
  subscriptionKey: string,
  groupCode: string,
  session: FamilyRemoteSession
): void {
  const activeSubscription = activePollingSubscriptions.get(subscriptionKey);
  if (!activeSubscription || typeof window === 'undefined') {
    return;
  }

  if (activeSubscription.timeoutId !== null) {
    window.clearTimeout(activeSubscription.timeoutId);
  }

  activeSubscription.timeoutId = window.setTimeout(() => {
    void runPollingRefreshCycle(subscriptionKey, groupCode, session);
  }, getNextPollingDelayMs(activeSubscription.consecutiveFailures));
}

async function runPollingRefreshCycle(
  subscriptionKey: string,
  groupCode: string,
  session: FamilyRemoteSession
): Promise<void> {
  const activeSubscription = activePollingSubscriptions.get(subscriptionKey);
  if (!activeSubscription || activeSubscription.isRefreshing) {
    return;
  }

  activeSubscription.timeoutId = null;

  if (!shouldPollRemoteGroup()) {
    scheduleNextPollingRefresh(subscriptionKey, groupCode, session);
    return;
  }

  activeSubscription.isRefreshing = true;
  try {
    const outcome = await refreshGroup(groupCode, session);
    const currentSubscription = activePollingSubscriptions.get(subscriptionKey);
    if (!currentSubscription) {
      return;
    }

    currentSubscription.consecutiveFailures = outcome === 'failure'
      ? currentSubscription.consecutiveFailures + 1
      : 0;
  } finally {
    const currentSubscription = activePollingSubscriptions.get(subscriptionKey);
    if (!currentSubscription) {
      return;
    }

    currentSubscription.isRefreshing = false;
    scheduleNextPollingRefresh(subscriptionKey, groupCode, session);
  }
}

function releasePollingSubscription(subscriptionKey: string): void {
  const activeSubscription = activePollingSubscriptions.get(subscriptionKey);
  if (!activeSubscription) {
    return;
  }

  activeSubscription.refCount -= 1;
  if (activeSubscription.refCount > 0) {
    return;
  }

  if (activeSubscription.timeoutId !== null) {
    window.clearTimeout(activeSubscription.timeoutId);
  }
  window.removeEventListener('online', activeSubscription.refreshIfInteractive);
  document.removeEventListener('visibilitychange', activeSubscription.refreshIfInteractive);
  activePollingSubscriptions.delete(subscriptionKey);
}

class HttpFamilyRemoteClient implements FamilyRemoteClient {
  fetchGroup(groupCode: string, session: FamilyRemoteSession): FamilyRemoteGroupRecord | null {
    void refreshGroup(groupCode, session);
    return readCachedGroup(groupCode);
  }

  upsertGroup(group: FamilyRemoteGroupRecord, session: FamilyRemoteSession): FamilyRemoteGroupRecord {
    const previousCachedRecord = readCachedGroup(group.inviteCode);
    writeCachedGroup(group);
    void pushGroup(group, session, previousCachedRecord);
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
    const releasePollingSubscriptionForListener = acquirePollingSubscription(normalizedCode, _session);

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
      releasePollingSubscriptionForListener();
      window.removeEventListener(REMOTE_CACHE_UPDATED_EVENT, handleCustomUpdate as EventListener);
      window.removeEventListener('storage', handleStorage);
    };
  }
}

const httpFamilyRemoteClient = new HttpFamilyRemoteClient();

export function getHttpFamilyRemoteClient(): FamilyRemoteClient {
  return httpFamilyRemoteClient;
}

function isSameRemoteIdentity(
  left: Pick<FamilyRemoteGroupRecord['members'][number], 'id' | 'deviceId'>,
  right: Pick<FamilyRemoteGroupRecord['members'][number], 'id' | 'deviceId'>
): boolean {
  return left.id === right.id || (
    Boolean(left.deviceId)
    && Boolean(right.deviceId)
    && left.deviceId === right.deviceId
  );
}

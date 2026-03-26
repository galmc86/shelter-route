import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FAMILY_REMOTE_HTTP_POLL_INTERVAL_MS,
  getHttpFamilyRemoteClient,
} from '../httpFamilyRemoteClient';
import { getFamilyRemoteSession } from '../familyRemoteSessionService';
import type { FamilyRemoteGroupRecord } from '../familyRemoteModel';
import {
  clearPendingFamilySyncMutations,
  getPendingFamilySyncMutation,
} from '../familySyncQueueService';
import { getFamilySyncStatus } from '../familySyncStatusService';

const groupFixture: FamilyRemoteGroupRecord = {
  id: 'family:ABC123',
  inviteCode: 'ABC123',
  version: 1,
  createdAt: '2026-03-26T00:00:00.000Z',
  updatedAt: '2026-03-26T00:00:00.000Z',
  createdByMemberId: 'member-1',
  members: [],
};
const CACHE_KEY = 'shelter-route:family-remote-http-cache:ABC123';

describe('httpFamilyRemoteClient', () => {
  beforeEach(() => {
    localStorage.clear();
    clearPendingFamilySyncMutations();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => false,
    });
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => true,
    });
  });

  it('returns cached groups immediately after optimistic upsert', () => {
    const client = getHttpFamilyRemoteClient();
    const session = getFamilyRemoteSession();
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    client.upsertGroup(groupFixture, session);

    expect(client.fetchGroup('ABC123', session)).toEqual(groupFixture);
  });

  it('clears cached groups immediately on delete', () => {
    const client = getHttpFamilyRemoteClient();
    const session = getFamilyRemoteSession();
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    client.upsertGroup(groupFixture, session);
    client.clearGroup('ABC123', session);

    expect(client.fetchGroup('ABC123', session)).toBeNull();
  });

  it('normalizes fetched payloads through the HTTP contract decoder', async () => {
    vi.stubEnv('VITE_FAMILY_REMOTE_URL', 'https://family.example.com/api');
    const { getHttpFamilyRemoteClient: getClient } = await import('../httpFamilyRemoteClient');
    const client = getClient();
    const session = getFamilyRemoteSession();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      id: 'family:ABC123',
      inviteCode: 'abc123',
      version: 1,
      createdAt: '2026-03-26T00:00:00.000Z',
      updatedAt: '2026-03-26T00:00:00.000Z',
      createdByMemberId: 'member-1',
      members: [],
    }), { status: 200 }));

    expect(client.fetchGroup('ABC123', session)).toBeNull();

    await waitFor(() => {
      expect(client.fetchGroup('ABC123', session)?.inviteCode).toBe('ABC123');
    });
  });

  it('refreshes cached groups after a version conflict response', async () => {
    vi.stubEnv('VITE_FAMILY_REMOTE_URL', 'https://family.example.com/api');
    const { getHttpFamilyRemoteClient: getClient } = await import('../httpFamilyRemoteClient');
    const client = getClient();
    const session = getFamilyRemoteSession();
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: 'Family record version conflict',
      }), {
        status: 409,
        statusText: 'Conflict',
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ...groupFixture,
        version: 2,
        updatedAt: '2026-03-26T00:10:00.000Z',
      }), { status: 200 }));

    client.upsertGroup(groupFixture, session);

    await waitFor(() => {
      const cached = localStorage.getItem(CACHE_KEY);
      expect(cached).not.toBeNull();
      expect(JSON.parse(cached as string).version).toBe(2);
    });

    expect(getPendingFamilySyncMutation('ABC123')).toEqual({
      kind: 'upsert',
      groupCode: 'ABC123',
      queuedAt: expect.any(String),
      record: groupFixture,
      removedMemberIds: undefined,
      removedDeviceIds: undefined,
    });
  });

  it('queues failed upserts and records sync failure when the backend rejects the write', async () => {
    vi.stubEnv('VITE_FAMILY_REMOTE_URL', 'https://family.example.com/api');
    const { getHttpFamilyRemoteClient: getClient } = await import('../httpFamilyRemoteClient');
    const client = getClient();
    const session = getFamilyRemoteSession();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      error: 'Family sync write is not authorized for this session',
    }), {
      status: 403,
      statusText: 'Forbidden',
      headers: { 'Content-Type': 'application/json' },
    }));

    client.upsertGroup(groupFixture, session);

    await waitFor(() => {
      expect(getPendingFamilySyncMutation('ABC123')).toEqual({
        kind: 'upsert',
        groupCode: 'ABC123',
        queuedAt: expect.any(String),
        record: groupFixture,
        removedMemberIds: undefined,
        removedDeviceIds: undefined,
      });
      expect(getFamilySyncStatus().lastError)
        .toBe('Family sync write is not authorized for this session');
    });
  });

  it('queues failed clears and records sync failure when the backend rejects deletion', async () => {
    vi.stubEnv('VITE_FAMILY_REMOTE_URL', 'https://family.example.com/api');
    const { getHttpFamilyRemoteClient: getClient } = await import('../httpFamilyRemoteClient');
    const client = getClient();
    const session = getFamilyRemoteSession();
    localStorage.setItem(CACHE_KEY, JSON.stringify(groupFixture));
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      error: 'Family sync delete is not authorized for this session',
    }), {
      status: 403,
      statusText: 'Forbidden',
      headers: { 'Content-Type': 'application/json' },
    }));

    client.clearGroup('ABC123', session);

    await waitFor(() => {
      expect(getPendingFamilySyncMutation('ABC123')).toEqual({
        kind: 'clear',
        groupCode: 'ABC123',
        queuedAt: expect.any(String),
      });
      expect(getFamilySyncStatus().lastError)
        .toBe('Family sync delete is not authorized for this session');
    });
  });

  it('polls subscribed groups and emits updated change events', async () => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_FAMILY_REMOTE_URL', 'https://family.example.com/api');
    const { getHttpFamilyRemoteClient: getClient } = await import('../httpFamilyRemoteClient');
    const client = getClient();
    const session = getFamilyRemoteSession();
    const listener = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      ...groupFixture,
      inviteCode: 'abc123',
    }), { status: 200 }));

    const unsubscribe = client.subscribe('ABC123', session, listener);
    await vi.advanceTimersByTimeAsync(FAMILY_REMOTE_HTTP_POLL_INTERVAL_MS);

    expect(fetchSpy).toHaveBeenCalled();
    expect(listener).toHaveBeenCalledWith({
      kind: 'updated',
      groupCode: 'ABC123',
    });

    unsubscribe();
  });

  it('clears the cached group when polling receives a 404 response', async () => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_FAMILY_REMOTE_URL', 'https://family.example.com/api');
    const { getHttpFamilyRemoteClient: getClient } = await import('../httpFamilyRemoteClient');
    const client = getClient();
    const session = getFamilyRemoteSession();
    const listener = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      message: 'not found',
    }), {
      status: 404,
      statusText: 'Not Found',
      headers: { 'Content-Type': 'application/json' },
    }));

    client.upsertGroup(groupFixture, session);

    const unsubscribe = client.subscribe('ABC123', session, listener);
    await vi.advanceTimersByTimeAsync(FAMILY_REMOTE_HTTP_POLL_INTERVAL_MS);

    expect(fetchSpy).toHaveBeenCalled();
    expect(client.fetchGroup('ABC123', session)).toBeNull();
    expect(listener).toHaveBeenCalledWith({
      kind: 'cleared',
      groupCode: 'ABC123',
    });

    unsubscribe();
  });

  it('waits for visibility before polling and refreshes when the tab becomes visible again', async () => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_FAMILY_REMOTE_URL', 'https://family.example.com/api');
    const { getHttpFamilyRemoteClient: getClient } = await import('../httpFamilyRemoteClient');
    const client = getClient();
    const session = getFamilyRemoteSession();
    const listener = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      ...groupFixture,
      updatedAt: '2026-03-26T00:30:00.000Z',
    }), { status: 200 }));
    let hidden = true;
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => hidden,
    });

    const unsubscribe = client.subscribe('ABC123', session, listener);
    await vi.advanceTimersByTimeAsync(FAMILY_REMOTE_HTTP_POLL_INTERVAL_MS);

    expect(fetchSpy).not.toHaveBeenCalled();

    vi.useRealTimers();
    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem(CACHE_KEY)).not.toBeNull();
    });

    unsubscribe();
  });

  it('waits for connectivity before polling and refreshes when the browser comes back online', async () => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_FAMILY_REMOTE_URL', 'https://family.example.com/api');
    const { getHttpFamilyRemoteClient: getClient } = await import('../httpFamilyRemoteClient');
    const client = getClient();
    const session = getFamilyRemoteSession();
    const listener = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      ...groupFixture,
      updatedAt: '2026-03-26T00:45:00.000Z',
    }), { status: 200 }));
    let online = false;
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => online,
    });

    const unsubscribe = client.subscribe('ABC123', session, listener);
    await vi.advanceTimersByTimeAsync(FAMILY_REMOTE_HTTP_POLL_INTERVAL_MS);

    expect(fetchSpy).not.toHaveBeenCalled();

    vi.useRealTimers();
    online = true;
    window.dispatchEvent(new Event('online'));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem(CACHE_KEY)).not.toBeNull();
    });

    unsubscribe();
  });

  it('shares a single poller across duplicate subscriptions for the same group and session', async () => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_FAMILY_REMOTE_URL', 'https://family.example.com/api');
    const { getHttpFamilyRemoteClient: getClient } = await import('../httpFamilyRemoteClient');
    const client = getClient();
    const session = getFamilyRemoteSession();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      ...groupFixture,
      updatedAt: '2026-03-26T01:00:00.000Z',
    }), { status: 200 }));

    const unsubscribeFirst = client.subscribe('ABC123', session, vi.fn());
    const unsubscribeSecond = client.subscribe('ABC123', session, vi.fn());

    await vi.advanceTimersByTimeAsync(FAMILY_REMOTE_HTTP_POLL_INTERVAL_MS);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    unsubscribeFirst();

    await vi.advanceTimersByTimeAsync(FAMILY_REMOTE_HTTP_POLL_INTERVAL_MS);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    unsubscribeSecond();

    await vi.advanceTimersByTimeAsync(FAMILY_REMOTE_HTTP_POLL_INTERVAL_MS);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('backs off after polling failures and returns to the base cadence after recovery', async () => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_FAMILY_REMOTE_URL', 'https://family.example.com/api');
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const { getHttpFamilyRemoteClient: getClient } = await import('../httpFamilyRemoteClient');
    const client = getClient();
    const session = getFamilyRemoteSession();
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ...groupFixture,
        updatedAt: '2026-03-26T01:30:00.000Z',
      }), { status: 200 }))
      .mockResolvedValue(new Response(JSON.stringify({
        ...groupFixture,
        updatedAt: '2026-03-26T01:45:00.000Z',
      }), { status: 200 }));

    const unsubscribe = client.subscribe('ABC123', session, vi.fn());

    await vi.advanceTimersByTimeAsync(FAMILY_REMOTE_HTTP_POLL_INTERVAL_MS);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(500);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync((FAMILY_REMOTE_HTTP_POLL_INTERVAL_MS * 2) - 1);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1);
    expect(fetchSpy).toHaveBeenCalledTimes(3);

    await vi.advanceTimersByTimeAsync(FAMILY_REMOTE_HTTP_POLL_INTERVAL_MS - 1);
    expect(fetchSpy).toHaveBeenCalledTimes(3);

    await vi.advanceTimersByTimeAsync(1);
    expect(fetchSpy).toHaveBeenCalledTimes(4);

    unsubscribe();
  });
});

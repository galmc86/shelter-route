import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FAMILY_REMOTE_HTTP_POLL_INTERVAL_MS,
  getHttpFamilyRemoteClient,
} from '../httpFamilyRemoteClient';
import { getFamilyRemoteSession } from '../familyRemoteSessionService';
import type { FamilyRemoteGroupRecord } from '../familyRemoteModel';

const groupFixture: FamilyRemoteGroupRecord = {
  id: 'family:ABC123',
  inviteCode: 'ABC123',
  createdAt: '2026-03-26T00:00:00.000Z',
  updatedAt: '2026-03-26T00:00:00.000Z',
  createdByMemberId: 'member-1',
  members: [],
};

describe('httpFamilyRemoteClient', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
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
});

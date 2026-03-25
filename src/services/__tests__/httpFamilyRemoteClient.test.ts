import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getHttpFamilyRemoteClient } from '../httpFamilyRemoteClient';
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
});

import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FamilyRemoteGroupRecord } from '../familyRemoteModel';
import type { FamilyRemoteSession } from '../familyRemoteSessionService';
import {
  clearPendingFamilySyncMutations,
  getPendingFamilySyncMutation,
} from '../familySyncQueueService';
import worker, {
  type Env,
  type KeyValueStore,
} from '../../../workers/family-sync/src/index';

class MemoryStore implements KeyValueStore {
  private readonly store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

function createEnv(): Env {
  return {
    FAMILY_GROUPS: new MemoryStore(),
  };
}

function installWorkerFetch(env: Env) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const request = input instanceof Request
      ? new Request(input, init)
      : new Request(typeof input === 'string' ? input : input.toString(), init);

    return worker.fetch(request, env);
  });
}

async function readRemoteGroup(env: Env, groupCode: string): Promise<FamilyRemoteGroupRecord | null> {
  const response = await worker.fetch(new Request(`https://family-sync.example/${groupCode}`), env);
  if (response.status === 404) {
    return null;
  }

  return await response.json() as FamilyRemoteGroupRecord;
}

const ownerRecordFixture: FamilyRemoteGroupRecord = {
  id: 'family:ABC123',
  inviteCode: 'ABC123',
  version: 0,
  createdAt: '2026-03-26T00:00:00.000Z',
  updatedAt: '2026-03-26T00:00:00.000Z',
  createdByMemberId: 'member-1',
  members: [
    {
      id: 'member-1',
      name: 'Dana',
      deviceId: 'device-1',
      role: 'owner',
      status: 'unknown',
      joinedAt: '2026-03-26T00:00:00.000Z',
      lastSeenAt: '2026-03-26T00:00:00.000Z',
    },
  ],
};

describe('httpFamilyRemoteClient worker integration', () => {
  beforeEach(() => {
    localStorage.clear();
    clearPendingFamilySyncMutations();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('supports create, join, leave, and final delete across simulated device sessions', async () => {
    vi.stubEnv('VITE_FAMILY_REMOTE_URL', 'https://family-sync.example');
    const { getHttpFamilyRemoteClient } = await import('../httpFamilyRemoteClient');
    const client = getHttpFamilyRemoteClient();
    const env = createEnv();
    installWorkerFetch(env);

    const ownerSession: FamilyRemoteSession = {
      deviceId: 'device-1',
      userId: null,
      authState: 'anonymous',
    };
    const joinerSession: FamilyRemoteSession = {
      deviceId: 'device-2',
      userId: null,
      authState: 'anonymous',
    };

    client.upsertGroup(ownerRecordFixture, ownerSession);

    await waitFor(async () => {
      const remote = await readRemoteGroup(env, 'ABC123');
      expect(remote?.version).toBe(1);
      expect(remote?.members.map((member) => member.deviceId)).toEqual(['device-1']);
    });

    localStorage.clear();
    expect(client.fetchGroup('ABC123', joinerSession)).toBeNull();

    await waitFor(() => {
      expect(client.fetchGroup('ABC123', joinerSession)?.members).toHaveLength(1);
    });

    const joinerView = client.fetchGroup('ABC123', joinerSession) as FamilyRemoteGroupRecord;
    client.upsertGroup({
      ...joinerView,
      members: [
        {
          id: 'member-2',
          name: 'Noam',
          deviceId: 'device-2',
          role: 'member',
          status: 'unknown',
          joinedAt: '2026-03-26T00:05:00.000Z',
          lastSeenAt: '2026-03-26T00:05:00.000Z',
        },
        ...joinerView.members,
      ],
    }, joinerSession);

    await waitFor(async () => {
      const remote = await readRemoteGroup(env, 'ABC123');
      expect(remote?.version).toBe(2);
      expect(remote?.members.map((member) => member.deviceId)).toEqual(['device-2', 'device-1']);
    });

    localStorage.clear();
    expect(client.fetchGroup('ABC123', ownerSession)).toBeNull();

    await waitFor(() => {
      expect(client.fetchGroup('ABC123', ownerSession)?.members).toHaveLength(2);
    });

    localStorage.clear();
    expect(client.fetchGroup('ABC123', joinerSession)).toBeNull();

    await waitFor(() => {
      expect(client.fetchGroup('ABC123', joinerSession)?.members).toHaveLength(2);
    });

    const joinedGroup = client.fetchGroup('ABC123', joinerSession) as FamilyRemoteGroupRecord;
    client.upsertGroup({
      ...joinedGroup,
      members: joinedGroup.members.filter((member) => member.deviceId !== 'device-2'),
    }, joinerSession);

    await waitFor(async () => {
      const remote = await readRemoteGroup(env, 'ABC123');
      expect(remote?.version).toBe(3);
      expect(remote?.members.map((member) => member.deviceId)).toEqual(['device-1']);
    });

    localStorage.clear();
    expect(client.fetchGroup('ABC123', ownerSession)).toBeNull();

    await waitFor(() => {
      expect(client.fetchGroup('ABC123', ownerSession)?.members).toHaveLength(1);
    });

    client.clearGroup('ABC123', ownerSession);

    await waitFor(async () => {
      expect(await readRemoteGroup(env, 'ABC123')).toBeNull();
    });

    expect(getPendingFamilySyncMutation('ABC123')).toBeNull();
  });
});

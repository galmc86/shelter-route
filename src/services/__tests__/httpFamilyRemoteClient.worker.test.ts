import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FamilyRemoteGroupRecord } from '../familyRemoteModel';
import type { FamilyRemoteSession } from '../familyRemoteSessionService';
import {
  clearPendingFamilySyncMutations,
  getPendingFamilySyncMutation,
} from '../familySyncQueueService';
import worker, {
  FamilyGroupDurableObject,
  type DurableObjectNamespaceLike,
  type DurableObjectStateLike,
  type DurableObjectStorageLike,
  type Env,
} from '../../../workers/family-sync/src/index';

class MemoryDurableObjectStorage implements DurableObjectStorageLike {
  private readonly store = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    return this.store.get(key) as T | undefined;
  }

  async put<T>(key: string, value: T): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }
}

class MemoryDurableObjectState implements DurableObjectStateLike {
  storage = new MemoryDurableObjectStorage();
}

class MemoryDurableObjectNamespace implements DurableObjectNamespaceLike {
  private readonly states = new Map<string, MemoryDurableObjectState>();
  private env: Env | null = null;

  attachEnv(env: Env): void {
    this.env = env;
  }

  idFromName(name: string): string {
    return name.toUpperCase();
  }

  get(id: unknown) {
    const key = String(id);
    let state = this.states.get(key);
    if (!state) {
      state = new MemoryDurableObjectState();
      this.states.set(key, state);
    }

    return {
      fetch: (input: Request | string, init?: RequestInit) => {
        if (!this.env) {
          throw new Error('Memory durable object namespace is not attached to an env');
        }

        const request = input instanceof Request
          ? new Request(input, init)
          : new Request(input, init);
        const object = new FamilyGroupDurableObject(state, this.env);
        return object.fetch(request);
      },
    };
  }
}

function createEnv(): Env {
  const namespace = new MemoryDurableObjectNamespace();
  const env: Env = {
    FAMILY_GROUPS_DO: namespace,
  };
  namespace.attachEnv(env);
  return env;
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

  it('propagates needs-check-in and safe status changes across simulated device sessions', async () => {
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
      expect((await readRemoteGroup(env, 'ABC123'))?.members).toHaveLength(1);
    });

    localStorage.clear();
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
      expect((await readRemoteGroup(env, 'ABC123'))?.members).toHaveLength(2);
    });

    localStorage.clear();
    await waitFor(() => {
      expect(client.fetchGroup('ABC123', ownerSession)?.members).toHaveLength(2);
    });

    localStorage.clear();
    await waitFor(() => {
      expect(client.fetchGroup('ABC123', joinerSession)?.members).toHaveLength(2);
    });

    const initialJoinedGroup = client.fetchGroup('ABC123', joinerSession) as FamilyRemoteGroupRecord;
    client.upsertGroup({
      ...initialJoinedGroup,
      members: initialJoinedGroup.members.map((member) => (
        member.deviceId === 'device-2'
          ? {
              ...member,
              status: 'needs_check_in',
              lastStatusAt: '2026-03-26T00:06:00.000Z',
            }
          : member
      )),
    }, joinerSession);

    await waitFor(async () => {
      const remote = await readRemoteGroup(env, 'ABC123');
      expect(remote?.members.find((member) => member.deviceId === 'device-2')?.status).toBe('needs_check_in');
    });

    localStorage.clear();
    await waitFor(() => {
      const ownerView = client.fetchGroup('ABC123', ownerSession);
      expect(ownerView?.members.find((member) => member.deviceId === 'device-2')?.status).toBe('needs_check_in');
    });

    localStorage.clear();
    await waitFor(() => {
      expect(client.fetchGroup('ABC123', joinerSession)?.members).toHaveLength(2);
    });

    const alertGroup = client.fetchGroup('ABC123', joinerSession) as FamilyRemoteGroupRecord;
    client.upsertGroup({
      ...alertGroup,
      members: alertGroup.members.map((member) => (
        member.deviceId === 'device-2'
          ? {
              ...member,
              status: 'safe',
              lastStatusAt: '2026-03-26T00:07:00.000Z',
              lastSeenAt: '2026-03-26T00:07:00.000Z',
            }
          : member
      )),
    }, joinerSession);

    await waitFor(async () => {
      const remote = await readRemoteGroup(env, 'ABC123');
      expect(remote?.members.find((member) => member.deviceId === 'device-2')?.status).toBe('safe');
    });

    localStorage.clear();
    await waitFor(() => {
      const ownerView = client.fetchGroup('ABC123', ownerSession);
      expect(ownerView?.members.find((member) => member.deviceId === 'device-2')?.status).toBe('safe');
    });
  });
});

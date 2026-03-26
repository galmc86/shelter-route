import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBackendFamilyRemoteGateway } from '../backendFamilyRemoteGateway';
import { createFamilyRepository } from '../familyRepository';
import type { FamilyRemoteGroupRecord } from '../familyRemoteModel';
import {
  clearPendingFamilySyncMutations,
} from '../familySyncQueueService';
import type { FamilyRemoteSession } from '../familyRemoteSessionService';
import {
  registerFamilyRemoteAuthProvider,
  setFamilyRemoteAuthSessionConfig,
} from '../familyRemoteSessionService';
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

describe('familyRepository worker integration', () => {
  beforeEach(() => {
    localStorage.clear();
    clearPendingFamilySyncMutations();
    registerFamilyRemoteAuthProvider(null);
    setFamilyRemoteAuthSessionConfig(null);
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('joins an existing backend-backed family group even when the invitee has no preloaded remote cache', async () => {
    vi.stubEnv('VITE_FAMILY_REMOTE_URL', 'https://family-sync.example');
    const env = createEnv();
    installWorkerFetch(env);

    const remoteGateway = createBackendFamilyRemoteGateway();
    const ownerSession: FamilyRemoteSession = {
      deviceId: 'device-owner',
      userId: null,
      authState: 'anonymous',
    };
    const joinerSession: FamilyRemoteSession = {
      deviceId: 'device-joiner',
      userId: null,
      authState: 'anonymous',
    };

    const ownerRepository = createFamilyRepository({
      mode: 'hybrid',
      remoteGateway,
      remoteSession: ownerSession,
    });

    const ownerGroup = ownerRepository.createGroup('Dana');

    await waitFor(async () => {
      expect((await readRemoteGroup(env, ownerGroup.groupCode))?.members).toHaveLength(1);
    });

    localStorage.clear();
    clearPendingFamilySyncMutations();

    const joinerRepository = createFamilyRepository({
      mode: 'hybrid',
      remoteGateway,
      remoteSession: joinerSession,
    });
    const unsubscribe = joinerRepository.subscribe(() => {});

    try {
      joinerRepository.joinGroup(ownerGroup.groupCode, 'Noam');

      await waitFor(async () => {
        expect((await readRemoteGroup(env, ownerGroup.groupCode))?.members).toHaveLength(2);
      });

      await waitFor(() => {
        expect(joinerRepository.getSnapshot()?.members).toHaveLength(2);
      });

      const joinedGroup = joinerRepository.getSnapshot();
      expect(joinedGroup?.members.map((member) => member.name)).toEqual(
        expect.arrayContaining(['Dana', 'Noam'])
      );
      expect(joinedGroup?.currentMemberId).toBe(
        joinedGroup?.members.find((member) => member.deviceId === 'device-joiner')?.id
      );
    } finally {
      unsubscribe();
    }
  });

  it('reuses the same authenticated remote member identity when rejoining from a new device without cached remote state', async () => {
    vi.stubEnv('VITE_FAMILY_REMOTE_URL', 'https://family-sync.example');
    const env = createEnv();
    installWorkerFetch(env);

    const remoteGateway = createBackendFamilyRemoteGateway();
    const ownerSession: FamilyRemoteSession = {
      deviceId: 'device-old',
      userId: 'user-123',
      authState: 'authenticated',
    };
    const rejoinSession: FamilyRemoteSession = {
      deviceId: 'device-new',
      userId: 'user-123',
      authState: 'authenticated',
    };

    const ownerRepository = createFamilyRepository({
      mode: 'hybrid',
      remoteGateway,
      remoteSession: ownerSession,
    });

    const ownerGroup = ownerRepository.createGroup('Dana Auth');

    await waitFor(async () => {
      expect((await readRemoteGroup(env, ownerGroup.groupCode))?.members).toHaveLength(1);
    });

    const ownerMember = (await readRemoteGroup(env, ownerGroup.groupCode))?.members[0];
    expect(ownerMember?.userId).toBe('user-123');
    expect(ownerMember?.deviceId).toBe('device-old');

    localStorage.clear();
    clearPendingFamilySyncMutations();

    const rejoinRepository = createFamilyRepository({
      mode: 'hybrid',
      remoteGateway,
      remoteSession: rejoinSession,
    });
    const unsubscribe = rejoinRepository.subscribe(() => {});

    try {
      rejoinRepository.joinGroup(ownerGroup.groupCode, 'Dana Auth');

      await waitFor(async () => {
        const remoteGroup = await readRemoteGroup(env, ownerGroup.groupCode);
        expect(remoteGroup?.members).toHaveLength(1);
        expect(remoteGroup?.members[0].id).toBe(ownerMember?.id);
        expect(remoteGroup?.members[0].deviceId).toBe('device-new');
      });

      await waitFor(() => {
        expect(rejoinRepository.getSnapshot()?.currentMemberId).toBe(ownerMember?.id);
      });
    } finally {
      unsubscribe();
    }
  });
});

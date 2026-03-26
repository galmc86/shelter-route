import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FamilyRemoteChangeEvent } from '../familyRemoteChangeEvent';
import { createFamilyRepository, getFamilyRepository } from '../familyRepository';
import { getFamilyRemoteGateway } from '../familyRemoteGateway';
import type { FamilyRemoteGroupRecord } from '../familyRemoteModel';
import { mapFamilyGroupToRemoteRecord } from '../familyRemoteModel';
import type { FamilyRemoteGateway } from '../familyRemoteGateway';
import {
  setFamilyRemoteAuthSessionConfig,
  registerFamilyRemoteAuthProvider,
  type FamilyRemoteSession,
} from '../familyRemoteSessionService';
import { replaceStoredGroup } from '../familySafetyService';
import { getFamilySyncStatus } from '../familySyncStatusService';
import {
  clearPendingFamilySyncMutations,
  getPendingFamilySyncMutations,
  queueFamilySyncMutation,
} from '../familySyncQueueService';
import { FAMILY_SYNC_MODE_STORAGE_KEY } from '../familySyncModeService';

describe('familyRepository', () => {
  beforeEach(() => {
    localStorage.clear();
    clearPendingFamilySyncMutations();
    registerFamilyRemoteAuthProvider(null);
    setFamilyRemoteAuthSessionConfig(null);
  });

  it('wraps the current local family state and derives a share link only when a group exists', () => {
    const repository = getFamilyRepository();

    expect(repository.getSnapshot()).toBeNull();
    expect(repository.getShareLink()).toBeNull();

    const group = repository.createGroup('Dana');

    expect(group.groupCode).toHaveLength(6);
    expect(repository.getSnapshot()?.memberName).toBe('Dana');
    expect(repository.getShareLink()).toContain(group.groupCode);
  });

  it('notifies repository subscribers when local family state changes', () => {
    const repository = getFamilyRepository();
    const listener = vi.fn();
    const unsubscribe = repository.subscribe(listener);

    repository.createGroup('Dana');

    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    repository.markCurrentMemberSafe();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('can hydrate additional members from the mock remote adapter in hybrid mode', () => {
    localStorage.setItem(FAMILY_SYNC_MODE_STORAGE_KEY, 'hybrid');
    const repository = getFamilyRepository();
    const group = repository.createGroup('Dana');
    const remoteGateway = getFamilyRemoteGateway();
    const session: FamilyRemoteSession = { deviceId: 'device-test', userId: null, authState: 'anonymous' };

    remoteGateway.upsertGroup({
      ...mapFamilyGroupToRemoteRecord(group),
      members: [
        ...mapFamilyGroupToRemoteRecord(group).members,
        {
          id: 'member-2',
          name: 'Noam',
          role: 'member',
          status: 'safe',
          joinedAt: '2026-03-25T21:00:00.000Z',
          lastStatusAt: '2026-03-25T21:00:00.000Z',
          lastSeenAt: '2026-03-25T21:00:00.000Z',
        },
      ],
    }, session);

    const hydrated = repository.getSnapshot();

    expect(hydrated?.members).toHaveLength(2);
    expect(hydrated?.members.find((member) => member.id === 'member-2')?.name).toBe('Noam');
  });

  it('preserves existing remote members when joining a hybrid family group from another device', () => {
    let storedRecord: FamilyRemoteGroupRecord | null = {
      id: 'family:ABC123',
      inviteCode: 'ABC123',
      version: 1,
      createdAt: '2026-03-25T20:00:00.000Z',
      updatedAt: '2026-03-25T20:00:00.000Z',
      createdByMemberId: 'member-1',
      members: [
        {
          id: 'member-1',
          name: 'Dana',
          deviceId: 'device-owner',
          role: 'owner',
          status: 'safe',
          joinedAt: '2026-03-25T20:00:00.000Z',
          lastStatusAt: '2026-03-25T20:00:00.000Z',
          lastSeenAt: '2026-03-25T20:00:00.000Z',
        },
      ],
    };
    const session: FamilyRemoteSession = { deviceId: 'device-joiner', userId: null, authState: 'anonymous' };

    const remoteGateway: FamilyRemoteGateway = {
      getGroup: vi.fn((groupCode: string, _session: FamilyRemoteSession) => (
        storedRecord?.inviteCode === groupCode.toUpperCase() ? storedRecord : null
      )),
      upsertGroup: vi.fn((record, _session: FamilyRemoteSession) => {
        storedRecord = record;
        return record;
      }),
      clearGroup: vi.fn(),
      subscribe: vi.fn((_groupCode: string, _session: FamilyRemoteSession) => () => {}),
    };

    const repository = createFamilyRepository({ mode: 'hybrid', remoteGateway, remoteSession: session });
    const joined = repository.joinGroup('ABC123', 'Noam');

    expect(joined.members).toHaveLength(2);
    expect(joined.members.find((member) => member.name === 'Dana')).toBeTruthy();
    expect(storedRecord?.members).toHaveLength(2);
    expect(storedRecord?.members.find((member) => member.id === 'member-1')?.role).toBe('owner');
    expect(storedRecord?.members.find((member) => member.name === 'Noam')?.role).toBe('member');
  });

  it('reuses the remote member identity when the same device rejoins in hybrid mode', () => {
    localStorage.setItem('shelter-route:device-id', 'device-joiner');

    let storedRecord: FamilyRemoteGroupRecord | null = {
      id: 'family:ABC123',
      inviteCode: 'ABC123',
      version: 2,
      createdAt: '2026-03-25T20:00:00.000Z',
      updatedAt: '2026-03-25T20:00:00.000Z',
      createdByMemberId: 'member-1',
      members: [
        {
          id: 'member-1',
          name: 'Dana',
          deviceId: 'device-owner',
          role: 'owner',
          status: 'safe',
          joinedAt: '2026-03-25T20:00:00.000Z',
          lastStatusAt: '2026-03-25T20:00:00.000Z',
          lastSeenAt: '2026-03-25T20:00:00.000Z',
        },
        {
          id: 'member-2',
          name: 'Noam',
          deviceId: 'device-joiner',
          role: 'member',
          status: 'needs_check_in',
          joinedAt: '2026-03-25T21:00:00.000Z',
          lastStatusAt: '2026-03-25T21:00:00.000Z',
          lastSeenAt: '2026-03-25T21:00:00.000Z',
        },
      ],
    };
    const session: FamilyRemoteSession = { deviceId: 'device-joiner', userId: null, authState: 'anonymous' };

    const remoteGateway: FamilyRemoteGateway = {
      getGroup: vi.fn((groupCode: string, _session: FamilyRemoteSession) => (
        storedRecord?.inviteCode === groupCode.toUpperCase() ? storedRecord : null
      )),
      upsertGroup: vi.fn((record, _session: FamilyRemoteSession) => {
        storedRecord = record;
        return record;
      }),
      clearGroup: vi.fn(),
      subscribe: vi.fn((_groupCode: string, _session: FamilyRemoteSession) => () => {}),
    };

    const repository = createFamilyRepository({ mode: 'hybrid', remoteGateway, remoteSession: session });
    const joined = repository.joinGroup('ABC123', 'Noam');

    expect(joined.members).toHaveLength(2);
    expect(joined.currentMemberId).toBe('member-2');
    expect(storedRecord?.members).toHaveLength(2);
    expect(storedRecord?.members.find((member) => member.deviceId === 'device-joiner')?.id).toBe('member-2');
  });

  it('reuses the remote member identity when the same authenticated user rejoins from a different device', () => {
    localStorage.setItem('shelter-route:device-id', 'device-new');

    let storedRecord: FamilyRemoteGroupRecord | null = {
      id: 'family:ABC123',
      inviteCode: 'ABC123',
      version: 2,
      createdAt: '2026-03-25T20:00:00.000Z',
      updatedAt: '2026-03-25T20:00:00.000Z',
      createdByMemberId: 'member-2',
      members: [
        {
          id: 'member-1',
          name: 'Dana',
          userId: 'owner-user',
          deviceId: 'device-owner',
          role: 'member',
          status: 'safe',
          joinedAt: '2026-03-25T20:00:00.000Z',
          lastStatusAt: '2026-03-25T20:00:00.000Z',
          lastSeenAt: '2026-03-25T20:00:00.000Z',
        },
        {
          id: 'member-2',
          name: 'Noam',
          userId: 'user-123',
          deviceId: 'device-old',
          role: 'owner',
          status: 'needs_check_in',
          joinedAt: '2026-03-25T21:00:00.000Z',
          lastStatusAt: '2026-03-25T21:00:00.000Z',
          lastSeenAt: '2026-03-25T21:00:00.000Z',
        },
      ],
    };
    const session: FamilyRemoteSession = {
      deviceId: 'device-new',
      userId: 'user-123',
      authState: 'authenticated',
    };

    const remoteGateway: FamilyRemoteGateway = {
      getGroup: vi.fn((groupCode: string, _session: FamilyRemoteSession) => (
        storedRecord?.inviteCode === groupCode.toUpperCase() ? storedRecord : null
      )),
      upsertGroup: vi.fn((record, _session: FamilyRemoteSession) => {
        storedRecord = record;
        return record;
      }),
      clearGroup: vi.fn(),
      subscribe: vi.fn((_groupCode: string, _session: FamilyRemoteSession) => () => {}),
    };

    const repository = createFamilyRepository({ mode: 'hybrid', remoteGateway, remoteSession: session });
    const joined = repository.joinGroup('ABC123', 'Noam');

    expect(joined.members).toHaveLength(2);
    expect(joined.currentMemberId).toBe('member-2');
    expect(storedRecord?.members).toHaveLength(2);
    expect(storedRecord?.members.find((member) => member.userId === 'user-123')?.id).toBe('member-2');
    expect(storedRecord?.members.find((member) => member.id === 'member-2')?.deviceId).toBe('device-new');
  });

  it('drops stale non-current local members when the remote group no longer contains them', () => {
    replaceStoredGroup({
      groupCode: 'ABC123',
      memberName: 'Dana',
      currentMemberId: 'member-1',
      members: [
        {
          id: 'member-1',
          name: 'Dana',
          deviceId: 'device-owner',
          isSafe: false,
          lastSeen: '2026-03-25T20:00:00.000Z',
        },
        {
          id: 'member-2',
          name: 'Noam',
          deviceId: 'device-joiner',
          isSafe: false,
          lastSeen: '2026-03-25T21:00:00.000Z',
        },
      ],
    });

    const remoteRecord: FamilyRemoteGroupRecord = {
      id: 'family:ABC123',
      inviteCode: 'ABC123',
      version: 3,
      createdAt: '2026-03-25T20:00:00.000Z',
      updatedAt: '2026-03-25T22:00:00.000Z',
      createdByMemberId: 'member-1',
      members: [
        {
          id: 'member-1',
          name: 'Dana',
          deviceId: 'device-owner',
          role: 'owner',
          status: 'needs_check_in',
          joinedAt: '2026-03-25T20:00:00.000Z',
          lastStatusAt: '2026-03-25T22:00:00.000Z',
          lastSeenAt: '2026-03-25T22:00:00.000Z',
        },
      ],
    };

    const remoteGateway: FamilyRemoteGateway = {
      getGroup: vi.fn(() => remoteRecord),
      upsertGroup: vi.fn((record) => record),
      clearGroup: vi.fn(),
      subscribe: vi.fn(() => () => {}),
    };

    const repository = createFamilyRepository({
      mode: 'hybrid',
      remoteGateway,
      remoteSession: { deviceId: 'device-owner', userId: null, authState: 'anonymous' },
    });

    const hydrated = repository.getSnapshot();

    expect(hydrated?.members).toHaveLength(1);
    expect(hydrated?.members[0].id).toBe('member-1');
    expect(hydrated?.currentMemberId).toBe('member-1');
  });

  it('uses the latest remote session from the session source for subscriptions and writes', () => {
    let currentSession: FamilyRemoteSession = {
      deviceId: 'device-1',
      userId: null,
      authState: 'anonymous',
    };
    const subscribeSessions: FamilyRemoteSession[] = [];
    const upsertSessions: FamilyRemoteSession[] = [];
    let storedRecord: FamilyRemoteGroupRecord | null = null;

    const remoteGateway: FamilyRemoteGateway = {
      getGroup: vi.fn((groupCode: string, _session: FamilyRemoteSession) => (
        storedRecord?.inviteCode === groupCode.toUpperCase() ? storedRecord : null
      )),
      upsertGroup: vi.fn((record, session: FamilyRemoteSession) => {
        upsertSessions.push(session);
        storedRecord = record;
        return record;
      }),
      clearGroup: vi.fn(),
      subscribe: vi.fn((_groupCode: string, session: FamilyRemoteSession) => {
        subscribeSessions.push(session);
        return () => {};
      }),
    };

    const repository = createFamilyRepository({
      mode: 'hybrid',
      remoteGateway,
      remoteSessionSource: () => currentSession,
    });

    repository.createGroup('Dana');
    expect(subscribeSessions).toHaveLength(1);
    expect(subscribeSessions[0]).toEqual({
      deviceId: 'device-1',
      userId: null,
      authState: 'anonymous',
    });

    currentSession = {
      deviceId: 'device-2',
      userId: 'user-123',
      authState: 'authenticated',
    };

    repository.retrySync();
    repository.markCurrentMemberSafe();

    expect(subscribeSessions).toHaveLength(2);
    expect(subscribeSessions[1]).toEqual({
      deviceId: 'device-2',
      userId: 'user-123',
      authState: 'authenticated',
    });
    expect(upsertSessions[upsertSessions.length - 1]).toEqual({
      deviceId: 'device-2',
      userId: 'user-123',
      authState: 'authenticated',
    });
  });

  it('resubscribes when the registered auth provider changes remote identity', () => {
    localStorage.setItem('shelter-route:device-id', 'device-base');

    let currentConfig: Pick<FamilyRemoteSession, 'authState' | 'userId'> = {
      authState: 'anonymous',
      userId: null,
    };
    const authListeners = new Set<() => void>();
    const subscribeSessions: FamilyRemoteSession[] = [];
    const listener = vi.fn();

    registerFamilyRemoteAuthProvider({
      getSessionConfig: () => currentConfig,
      subscribe: (nextListener) => {
        authListeners.add(nextListener);
        return () => authListeners.delete(nextListener);
      },
    });

    const remoteGateway: FamilyRemoteGateway = {
      getGroup: vi.fn(() => null),
      upsertGroup: vi.fn((record) => record),
      clearGroup: vi.fn(),
      subscribe: vi.fn((_groupCode: string, session: FamilyRemoteSession) => {
        subscribeSessions.push(session);
        return () => {};
      }),
    };

    const repository = createFamilyRepository({ mode: 'hybrid', remoteGateway });
    const unsubscribe = repository.subscribe(listener);
    repository.createGroup('Dana');

    expect(subscribeSessions).toHaveLength(1);
    expect(subscribeSessions[0]).toEqual({
      deviceId: 'device-base',
      userId: null,
      authState: 'anonymous',
    });

    currentConfig = {
      authState: 'authenticated',
      userId: 'user-123',
    };
    authListeners.forEach((nextListener) => nextListener());

    expect(subscribeSessions).toHaveLength(2);
    expect(subscribeSessions[1]).toEqual({
      deviceId: 'device-base',
      userId: 'user-123',
      authState: 'authenticated',
    });
    expect(listener).toHaveBeenCalled();

    unsubscribe();
  });

  it('resubscribes when the built-in auth bridge changes remote identity', () => {
    localStorage.setItem('shelter-route:device-id', 'device-base');

    const subscribeSessions: FamilyRemoteSession[] = [];
    const remoteGateway: FamilyRemoteGateway = {
      getGroup: vi.fn(() => null),
      upsertGroup: vi.fn((record) => record),
      clearGroup: vi.fn(),
      subscribe: vi.fn((_groupCode: string, session: FamilyRemoteSession) => {
        subscribeSessions.push(session);
        return () => {};
      }),
    };

    const repository = createFamilyRepository({ mode: 'hybrid', remoteGateway });
    const listener = vi.fn();
    const unsubscribe = repository.subscribe(listener);
    repository.createGroup('Dana');

    expect(subscribeSessions).toHaveLength(1);
    expect(subscribeSessions[0]).toEqual({
      deviceId: 'device-base',
      userId: null,
      authState: 'anonymous',
    });

    setFamilyRemoteAuthSessionConfig({
      authState: 'authenticated',
      userId: 'bridge-user',
    });

    expect(subscribeSessions).toHaveLength(2);
    expect(subscribeSessions[1]).toEqual({
      deviceId: 'device-base',
      userId: 'bridge-user',
      authState: 'authenticated',
    });
    expect(listener).toHaveBeenCalled();

    unsubscribe();
  });

  it('can be created explicitly in hybrid mode without depending on storage flags', () => {
    const repository = createFamilyRepository({ mode: 'hybrid' });

    repository.createGroup('Dana');

    expect(repository.getSnapshot()?.groupCode).toHaveLength(6);
  });

  it('queues failed remote writes and retries them on the next snapshot read', () => {
    let shouldFail = true;
    let storedRecord: FamilyRemoteGroupRecord | null = null;
    const session: FamilyRemoteSession = { deviceId: 'device-test', userId: null, authState: 'anonymous' };

    const remoteGateway: FamilyRemoteGateway = {
      getGroup: vi.fn((groupCode: string, _session: FamilyRemoteSession) => (
        storedRecord?.inviteCode === groupCode.toUpperCase() ? storedRecord : null
      )),
      upsertGroup: vi.fn((record, _session: FamilyRemoteSession) => {
        if (shouldFail) {
          throw new Error('remote unavailable');
        }

        storedRecord = record;
        return record;
      }),
      clearGroup: vi.fn(),
      subscribe: vi.fn((_groupCode: string, _session: FamilyRemoteSession) => () => {}),
    };

    const repository = createFamilyRepository({ mode: 'hybrid', remoteGateway, remoteSession: session });
    const group = repository.createGroup('Dana');

    expect(group.groupCode).toHaveLength(6);
    expect(getPendingFamilySyncMutations()).toHaveLength(1);
    expect(storedRecord).toBeNull();
    expect(getFamilySyncStatus().lastError).toBe('remote unavailable');

    shouldFail = false;

    const hydrated = repository.getSnapshot();
    const syncedRecord = storedRecord as FamilyRemoteGroupRecord | null;

    expect(hydrated?.groupCode).toBe(group.groupCode);
    expect(syncedRecord?.inviteCode).toBe(group.groupCode);
    expect(getPendingFamilySyncMutations()).toEqual([]);
    expect(getFamilySyncStatus().lastError).toBeNull();
  });

  it('rebases a stale queued upsert mutation onto the latest remote record before retrying', () => {
    const localGroup = {
      groupCode: 'ABC123',
      memberName: 'Dana',
      currentMemberId: 'member-1',
      members: [
        {
          id: 'member-1',
          name: 'Dana',
          deviceId: 'device-1',
          isSafe: true,
          lastSeen: '2026-03-25T21:30:00.000Z',
        },
      ],
    };
    replaceStoredGroup(localGroup);

    let storedRecord: FamilyRemoteGroupRecord | null = {
      id: 'family:ABC123',
      inviteCode: 'ABC123',
      version: 2,
      createdAt: '2026-03-25T20:00:00.000Z',
      updatedAt: '2026-03-25T21:00:00.000Z',
      createdByMemberId: 'member-1',
      members: [
        {
          id: 'member-1',
          name: 'Dana',
          deviceId: 'device-1',
          role: 'owner',
          status: 'needs_check_in',
          joinedAt: '2026-03-25T20:00:00.000Z',
          lastStatusAt: '2026-03-25T20:00:00.000Z',
          lastSeenAt: '2026-03-25T20:00:00.000Z',
        },
        {
          id: 'member-2',
          name: 'Noam',
          deviceId: 'device-2',
          role: 'member',
          status: 'safe',
          joinedAt: '2026-03-25T21:00:00.000Z',
          lastStatusAt: '2026-03-25T21:00:00.000Z',
          lastSeenAt: '2026-03-25T21:00:00.000Z',
        },
      ],
    };
    const session: FamilyRemoteSession = { deviceId: 'device-1', userId: null, authState: 'anonymous' };
    const remoteGateway: FamilyRemoteGateway = {
      getGroup: vi.fn((groupCode: string, _session: FamilyRemoteSession) => (
        storedRecord?.inviteCode === groupCode.toUpperCase() ? storedRecord : null
      )),
      upsertGroup: vi.fn((record, _session: FamilyRemoteSession) => {
        const nextRecord: FamilyRemoteGroupRecord = {
          ...record,
          version: record.version + 1,
        };
        storedRecord = nextRecord;
        return nextRecord;
      }),
      clearGroup: vi.fn(),
      subscribe: vi.fn((_groupCode: string, _session: FamilyRemoteSession) => () => {}),
    };

    queueFamilySyncMutation({
      kind: 'upsert',
      groupCode: 'ABC123',
      queuedAt: '2026-03-25T21:31:00.000Z',
      record: {
        ...storedRecord,
        version: 1,
        members: [
          {
            ...storedRecord.members[0],
            status: 'safe',
            lastStatusAt: '2026-03-25T21:30:00.000Z',
            lastSeenAt: '2026-03-25T21:30:00.000Z',
          },
        ],
      },
    });

    const repository = createFamilyRepository({ mode: 'hybrid', remoteGateway, remoteSession: session });
    const hydrated = repository.getSnapshot();

    expect(hydrated?.members).toHaveLength(2);
    expect(storedRecord?.members).toHaveLength(2);
    expect(storedRecord?.version).toBe(3);
    expect(storedRecord?.members.find((member) => member.id === 'member-1')?.status).toBe('safe');
    expect(storedRecord?.members.find((member) => member.id === 'member-2')?.status).toBe('safe');
    expect(getPendingFamilySyncMutations()).toEqual([]);
  });

  it('retries queued remote writes when retrySync is requested explicitly', () => {
    let shouldFail = true;
    let storedRecord: FamilyRemoteGroupRecord | null = null;
    const session: FamilyRemoteSession = { deviceId: 'device-test', userId: null, authState: 'anonymous' };

    const remoteGateway: FamilyRemoteGateway = {
      getGroup: vi.fn((groupCode: string, _session: FamilyRemoteSession) => (
        storedRecord?.inviteCode === groupCode.toUpperCase() ? storedRecord : null
      )),
      upsertGroup: vi.fn((record, _session: FamilyRemoteSession) => {
        if (shouldFail) {
          throw new Error('remote unavailable');
        }

        storedRecord = record;
        return record;
      }),
      clearGroup: vi.fn(),
      subscribe: vi.fn((_groupCode: string, _session: FamilyRemoteSession) => () => {}),
    };

    const repository = createFamilyRepository({ mode: 'hybrid', remoteGateway, remoteSession: session });
    const group = repository.createGroup('Dana');

    expect(getPendingFamilySyncMutations()).toHaveLength(1);

    shouldFail = false;

    const retried = repository.retrySync();
    const syncedRecord = storedRecord as FamilyRemoteGroupRecord | null;

    expect(retried?.groupCode).toBe(group.groupCode);
    expect(syncedRecord?.inviteCode).toBe(group.groupCode);
    expect(getPendingFamilySyncMutations()).toEqual([]);
    expect(getFamilySyncStatus().lastError).toBeNull();
  });

  it('flushes queued remote mutations when the browser comes back online', () => {
    let shouldFail = true;
    let storedRecord: FamilyRemoteGroupRecord | null = null;
    const session: FamilyRemoteSession = { deviceId: 'device-test', userId: null, authState: 'anonymous' };

    const remoteGateway: FamilyRemoteGateway = {
      getGroup: vi.fn((groupCode: string, _session: FamilyRemoteSession) => (
        storedRecord?.inviteCode === groupCode.toUpperCase() ? storedRecord : null
      )),
      upsertGroup: vi.fn((record, _session: FamilyRemoteSession) => {
        if (shouldFail) {
          throw new Error('offline');
        }

        storedRecord = record;
        return record;
      }),
      clearGroup: vi.fn(),
      subscribe: vi.fn((_groupCode: string, _session: FamilyRemoteSession) => () => {}),
    };

    const repository = createFamilyRepository({ mode: 'hybrid', remoteGateway, remoteSession: session });
    const listener = vi.fn();
    const unsubscribe = repository.subscribe(listener);
    const group = repository.createGroup('Dana');

    expect(getPendingFamilySyncMutations()).toHaveLength(1);

    shouldFail = false;
    window.dispatchEvent(new Event('online'));
    const syncedRecord = storedRecord as FamilyRemoteGroupRecord | null;

    expect(syncedRecord?.inviteCode).toBe(group.groupCode);
    expect(getPendingFamilySyncMutations()).toEqual([]);
    expect(listener).toHaveBeenCalled();

    unsubscribe();
  });

  it('removes only the current member from the remote group when leaving a shared hybrid family', () => {
    localStorage.setItem('shelter-route:device-id', 'device-joiner');

    let storedRecord: FamilyRemoteGroupRecord | null = {
      id: 'family:ABC123',
      inviteCode: 'ABC123',
      version: 3,
      createdAt: '2026-03-25T20:00:00.000Z',
      updatedAt: '2026-03-25T20:00:00.000Z',
      createdByMemberId: 'member-1',
      members: [
        {
          id: 'member-1',
          name: 'Dana',
          deviceId: 'device-owner',
          role: 'owner',
          status: 'safe',
          joinedAt: '2026-03-25T20:00:00.000Z',
          lastStatusAt: '2026-03-25T20:00:00.000Z',
          lastSeenAt: '2026-03-25T20:00:00.000Z',
        },
        {
          id: 'member-2',
          name: 'Noam',
          deviceId: 'device-joiner',
          role: 'member',
          status: 'needs_check_in',
          joinedAt: '2026-03-25T21:00:00.000Z',
          lastStatusAt: '2026-03-25T21:00:00.000Z',
          lastSeenAt: '2026-03-25T21:00:00.000Z',
        },
      ],
    };
    const remoteGateway: FamilyRemoteGateway = {
      getGroup: vi.fn((groupCode: string) => (
        storedRecord?.inviteCode === groupCode.toUpperCase() ? storedRecord : null
      )),
      upsertGroup: vi.fn((record) => {
        storedRecord = record;
        return record;
      }),
      clearGroup: vi.fn(() => {
        storedRecord = null;
      }),
      subscribe: vi.fn(() => () => {}),
    };

    const repository = createFamilyRepository({
      mode: 'hybrid',
      remoteGateway,
      remoteSession: { deviceId: 'device-joiner', userId: null, authState: 'anonymous' },
    });

    repository.joinGroup('ABC123', 'Noam');
    repository.leaveGroup();

    expect(repository.getSnapshot()).toBeNull();
    expect(storedRecord?.members).toHaveLength(1);
    expect(storedRecord?.members[0].id).toBe('member-1');
    expect(remoteGateway.clearGroup).not.toHaveBeenCalled();
  });

  it('clears the remote group when the last member leaves a hybrid family', () => {
    let storedRecord: FamilyRemoteGroupRecord | null = null;
    const remoteGateway: FamilyRemoteGateway = {
      getGroup: vi.fn((groupCode: string) => (
        storedRecord?.inviteCode === groupCode.toUpperCase() ? storedRecord : null
      )),
      upsertGroup: vi.fn((record) => {
        storedRecord = record;
        return record;
      }),
      clearGroup: vi.fn(() => {
        storedRecord = null;
      }),
      subscribe: vi.fn(() => () => {}),
    };

    const repository = createFamilyRepository({
      mode: 'hybrid',
      remoteGateway,
      remoteSession: { deviceId: 'device-owner', userId: null, authState: 'anonymous' },
    });

    const group = repository.createGroup('Dana');
    storedRecord = mapFamilyGroupToRemoteRecord(group);

    repository.leaveGroup();

    expect(repository.getSnapshot()).toBeNull();
    expect(storedRecord).toBeNull();
    expect(remoteGateway.clearGroup).toHaveBeenCalledWith(group.groupCode, {
      deviceId: 'device-owner',
      userId: null,
      authState: 'anonymous',
    });
  });

  it('clears the local group when the subscribed remote group is cleared', () => {
    localStorage.setItem(FAMILY_SYNC_MODE_STORAGE_KEY, 'hybrid');
    const repository = getFamilyRepository();
    const group = repository.createGroup('Dana');
    const listener = vi.fn();
    const unsubscribe = repository.subscribe(listener);
    const remoteGateway = getFamilyRemoteGateway();
    const session: FamilyRemoteSession = { deviceId: 'device-test', userId: null, authState: 'anonymous' };

    listener.mockClear();
    remoteGateway.clearGroup(group.groupCode, session);

    expect(repository.getSnapshot()).toBeNull();
    expect(getPendingFamilySyncMutations()).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('drops queued mutations when a subscribed remote clear event arrives', () => {
    const remoteListeners: Array<(event: FamilyRemoteChangeEvent) => void> = [];
    const session: FamilyRemoteSession = { deviceId: 'device-test', userId: null, authState: 'anonymous' };

    const remoteGateway: FamilyRemoteGateway = {
      getGroup: vi.fn(() => null),
      upsertGroup: vi.fn(() => {
        throw new Error('offline');
      }),
      clearGroup: vi.fn(),
      subscribe: vi.fn((_groupCode: string, _session: FamilyRemoteSession, listener) => {
        remoteListeners[0] = listener;
        return () => {
          remoteListeners.length = 0;
        };
      }),
    };

    const repository = createFamilyRepository({ mode: 'hybrid', remoteGateway, remoteSession: session });
    const group = repository.createGroup('Dana');
    repository.subscribe(vi.fn());

    expect(getPendingFamilySyncMutations()).toHaveLength(1);

    const remoteListener = remoteListeners[0];
    if (!remoteListener) {
      throw new Error('expected remote listener to be registered');
    }

    remoteListener({ kind: 'cleared', groupCode: group.groupCode });

    expect(repository.getSnapshot()).toBeNull();
    expect(getPendingFamilySyncMutations()).toEqual([]);
  });
});

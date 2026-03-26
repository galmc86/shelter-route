import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FamilyRemoteChangeEvent } from '../familyRemoteChangeEvent';
import { createFamilyRepository, getFamilyRepository } from '../familyRepository';
import { getFamilyRemoteGateway } from '../familyRemoteGateway';
import type { FamilyRemoteGroupRecord } from '../familyRemoteModel';
import { mapFamilyGroupToRemoteRecord } from '../familyRemoteModel';
import type { FamilyRemoteGateway } from '../familyRemoteGateway';
import type { FamilyRemoteSession } from '../familyRemoteSessionService';
import { getFamilySyncStatus } from '../familySyncStatusService';
import {
  clearPendingFamilySyncMutations,
  getPendingFamilySyncMutations,
} from '../familySyncQueueService';
import { FAMILY_SYNC_MODE_STORAGE_KEY } from '../familySyncModeService';

describe('familyRepository', () => {
  beforeEach(() => {
    localStorage.clear();
    clearPendingFamilySyncMutations();
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

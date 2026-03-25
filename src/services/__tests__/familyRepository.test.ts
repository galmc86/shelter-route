import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFamilyRepository, getFamilyRepository } from '../familyRepository';
import { getFamilyRemoteGateway } from '../familyRemoteGateway';
import type { FamilyRemoteGroupRecord } from '../familyRemoteModel';
import { mapFamilyGroupToRemoteRecord } from '../familyRemoteModel';
import type { FamilyRemoteGateway } from '../familyRemoteGateway';
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
    });

    const hydrated = repository.getSnapshot();

    expect(hydrated?.members).toHaveLength(2);
    expect(hydrated?.members.find((member) => member.id === 'member-2')?.name).toBe('Noam');
  });

  it('can be created explicitly in hybrid mode without depending on storage flags', () => {
    const repository = createFamilyRepository({ mode: 'hybrid' });

    repository.createGroup('Dana');

    expect(repository.getSnapshot()?.groupCode).toHaveLength(6);
  });

  it('queues failed remote writes and retries them on the next snapshot read', () => {
    let shouldFail = true;
    let storedRecord: FamilyRemoteGroupRecord | null = null;

    const remoteGateway: FamilyRemoteGateway = {
      getGroup: vi.fn((groupCode: string) => (
        storedRecord?.inviteCode === groupCode.toUpperCase() ? storedRecord : null
      )),
      upsertGroup: vi.fn((record) => {
        if (shouldFail) {
          throw new Error('remote unavailable');
        }

        storedRecord = record;
        return record;
      }),
      clearGroup: vi.fn(),
      subscribe: vi.fn(() => () => {}),
    };

    const repository = createFamilyRepository({ mode: 'hybrid', remoteGateway });
    const group = repository.createGroup('Dana');

    expect(group.groupCode).toHaveLength(6);
    expect(getPendingFamilySyncMutations()).toHaveLength(1);
    expect(storedRecord).toBeNull();

    shouldFail = false;

    const hydrated = repository.getSnapshot();
    const syncedRecord = storedRecord as FamilyRemoteGroupRecord | null;

    expect(hydrated?.groupCode).toBe(group.groupCode);
    expect(syncedRecord?.inviteCode).toBe(group.groupCode);
    expect(getPendingFamilySyncMutations()).toEqual([]);
  });

  it('flushes queued remote mutations when the browser comes back online', () => {
    let shouldFail = true;
    let storedRecord: FamilyRemoteGroupRecord | null = null;

    const remoteGateway: FamilyRemoteGateway = {
      getGroup: vi.fn((groupCode: string) => (
        storedRecord?.inviteCode === groupCode.toUpperCase() ? storedRecord : null
      )),
      upsertGroup: vi.fn((record) => {
        if (shouldFail) {
          throw new Error('offline');
        }

        storedRecord = record;
        return record;
      }),
      clearGroup: vi.fn(),
      subscribe: vi.fn(() => () => {}),
    };

    const repository = createFamilyRepository({ mode: 'hybrid', remoteGateway });
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
});

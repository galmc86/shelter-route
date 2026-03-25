import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFamilyRepository, getFamilyRepository } from '../familyRepository';
import { getFamilyRemoteGateway } from '../familyRemoteGateway';
import { FAMILY_SYNC_MODE_STORAGE_KEY } from '../familySyncModeService';

describe('familyRepository', () => {
  beforeEach(() => {
    localStorage.clear();
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
      ...group,
      members: [
        ...group.members,
        {
          id: 'member-2',
          name: 'Noam',
          isSafe: true,
          lastSeen: '2026-03-25T21:00:00.000Z',
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
});

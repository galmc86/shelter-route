import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getFamilyRemoteAdapter } from '../familyRemoteAdapter';
import type { FamilyGroup } from '../familySafetyService';

const groupFixture: FamilyGroup = {
  groupCode: 'ABC123',
  memberName: 'Dana',
  currentMemberId: 'member-1',
  members: [
    {
      id: 'member-1',
      name: 'Dana',
      deviceId: 'device-1',
      isSafe: false,
      lastSeen: '2026-03-25T20:00:00.000Z',
    },
  ],
};

describe('familyRemoteAdapter', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists and reads a remote group snapshot by group code', () => {
    const adapter = getFamilyRemoteAdapter();

    adapter.upsertGroup(groupFixture);

    expect(adapter.getGroup('abc123')).toEqual(groupFixture);
  });

  it('notifies listeners when the matching remote group changes', () => {
    const adapter = getFamilyRemoteAdapter();
    const listener = vi.fn();
    const unsubscribe = adapter.subscribe('ABC123', listener);

    adapter.upsertGroup(groupFixture);

    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    adapter.clearGroup('ABC123');

    expect(listener).toHaveBeenCalledTimes(1);
  });
});

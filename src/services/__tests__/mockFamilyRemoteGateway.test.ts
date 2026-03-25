import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMockFamilyRemoteGateway } from '../mockFamilyRemoteGateway';
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

describe('mockFamilyRemoteGateway', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists and reads a remote group snapshot by group code', () => {
    const gateway = getMockFamilyRemoteGateway();

    gateway.upsertGroup(groupFixture);

    expect(gateway.getGroup('abc123')).toEqual(groupFixture);
  });

  it('notifies listeners when the matching remote group changes', () => {
    const gateway = getMockFamilyRemoteGateway();
    const listener = vi.fn();
    const unsubscribe = gateway.subscribe('ABC123', listener);

    gateway.upsertGroup(groupFixture);

    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    gateway.clearGroup('ABC123');

    expect(listener).toHaveBeenCalledTimes(1);
  });
});


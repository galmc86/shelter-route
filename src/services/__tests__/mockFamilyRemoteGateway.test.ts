import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMockFamilyRemoteGateway } from '../mockFamilyRemoteGateway';
import type { FamilyRemoteGroupRecord } from '../familyRemoteModel';
import { getFamilyRemoteSession } from '../familyRemoteSessionService';

const groupFixture: FamilyRemoteGroupRecord = {
  id: 'family:ABC123',
  inviteCode: 'ABC123',
  createdAt: '2026-03-25T20:00:00.000Z',
  updatedAt: '2026-03-25T20:00:00.000Z',
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
  ],
};

describe('mockFamilyRemoteGateway', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists and reads a remote group snapshot by group code', () => {
    const gateway = getMockFamilyRemoteGateway();
    const session = getFamilyRemoteSession();

    gateway.upsertGroup(groupFixture, session);

    expect(gateway.getGroup('abc123', session)).toEqual(groupFixture);
  });

  it('notifies listeners when the matching remote group changes', () => {
    const gateway = getMockFamilyRemoteGateway();
    const session = getFamilyRemoteSession();
    const listener = vi.fn();
    const unsubscribe = gateway.subscribe('ABC123', session, listener);

    gateway.upsertGroup(groupFixture, session);

    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    gateway.clearGroup('ABC123', session);

    expect(listener).toHaveBeenCalledTimes(1);
  });
});

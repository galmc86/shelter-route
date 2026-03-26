import { describe, expect, it } from 'vitest';
import type { FamilyGroup } from '../familySafetyService';
import {
  mapFamilyGroupToRemoteRecord,
  mapRemoteRecordToFamilyGroup,
  rebaseFamilyRemoteGroupRecord,
} from '../familyRemoteModel';

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

describe('familyRemoteModel', () => {
  it('maps a local family group into a typed remote record', () => {
    const record = mapFamilyGroupToRemoteRecord(groupFixture);

    expect(record.inviteCode).toBe('ABC123');
    expect(record.version).toBe(0);
    expect(record.createdByMemberId).toBe('member-1');
    expect(record.members[0].status).toBe('needs_check_in');
    expect(record.members[0].role).toBe('owner');
  });

  it('propagates the authenticated session user id onto the current remote member', () => {
    const record = mapFamilyGroupToRemoteRecord(groupFixture, null, {
      authState: 'authenticated',
      userId: 'user-123',
    });

    expect(record.members[0].userId).toBe('user-123');
  });

  it('maps a remote record back into the local family view', () => {
    const record = mapFamilyGroupToRemoteRecord(groupFixture);
    const mapped = mapRemoteRecordToFamilyGroup(record, groupFixture);

    expect(mapped).toEqual(groupFixture);
  });

  it('preserves remote-only members when mapping a joiner onto an existing remote record', () => {
    const previousRecord = {
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
          deviceId: 'device-1',
          role: 'owner' as const,
          status: 'safe' as const,
          joinedAt: '2026-03-25T20:00:00.000Z',
          lastStatusAt: '2026-03-25T20:00:00.000Z',
          lastSeenAt: '2026-03-25T20:00:00.000Z',
        },
      ],
    };
    const joiningGroup: FamilyGroup = {
      groupCode: 'ABC123',
      memberName: 'Noam',
      currentMemberId: 'member-2',
      members: [
        {
          id: 'member-2',
          name: 'Noam',
          deviceId: 'device-2',
          isSafe: false,
          lastSeen: '2026-03-25T21:00:00.000Z',
        },
      ],
    };

    const record = mapFamilyGroupToRemoteRecord(joiningGroup, previousRecord);

    expect(record.version).toBe(3);
    expect(record.createdByMemberId).toBe('member-1');
    expect(record.members).toHaveLength(2);
    expect(record.members.find((member) => member.id === 'member-1')?.role).toBe('owner');
    expect(record.members.find((member) => member.id === 'member-2')?.role).toBe('member');
  });

  it('reuses the existing remote member identity when the same device rejoins', () => {
    const previousRecord = {
      id: 'family:ABC123',
      inviteCode: 'ABC123',
      version: 2,
      createdAt: '2026-03-25T20:00:00.000Z',
      updatedAt: '2026-03-25T20:00:00.000Z',
      createdByMemberId: 'member-1',
      members: [
        {
          id: 'member-2',
          name: 'Noam',
          deviceId: 'device-2',
          role: 'member' as const,
          status: 'needs_check_in' as const,
          joinedAt: '2026-03-25T21:00:00.000Z',
          lastStatusAt: '2026-03-25T21:00:00.000Z',
          lastSeenAt: '2026-03-25T21:00:00.000Z',
        },
      ],
    };
    const rejoiningGroup: FamilyGroup = {
      groupCode: 'ABC123',
      memberName: 'Noam',
      currentMemberId: 'local-member-id',
      members: [
        {
          id: 'local-member-id',
          name: 'Noam',
          deviceId: 'device-2',
          isSafe: true,
          lastSeen: '2026-03-25T22:00:00.000Z',
        },
      ],
    };

    const record = mapFamilyGroupToRemoteRecord(rejoiningGroup, previousRecord);
    const mappedGroup = mapRemoteRecordToFamilyGroup(record, rejoiningGroup);

    expect(record.members).toHaveLength(1);
    expect(record.members[0].id).toBe('member-2');
    expect(record.members[0].status).toBe('safe');
    expect(mappedGroup?.currentMemberId).toBe('member-2');
  });

  it('reuses the existing remote member identity when the same authenticated user rejoins from another device', () => {
    const previousRecord = {
      id: 'family:ABC123',
      inviteCode: 'ABC123',
      version: 2,
      createdAt: '2026-03-25T20:00:00.000Z',
      updatedAt: '2026-03-25T20:00:00.000Z',
      createdByMemberId: 'member-2',
      members: [
        {
          id: 'member-2',
          name: 'Noam',
          userId: 'user-123',
          deviceId: 'device-old',
          role: 'owner' as const,
          status: 'needs_check_in' as const,
          joinedAt: '2026-03-25T21:00:00.000Z',
          lastStatusAt: '2026-03-25T21:00:00.000Z',
          lastSeenAt: '2026-03-25T21:00:00.000Z',
        },
      ],
    };
    const rejoiningGroup: FamilyGroup = {
      groupCode: 'ABC123',
      memberName: 'Noam',
      currentMemberId: 'local-member-id',
      members: [
        {
          id: 'local-member-id',
          name: 'Noam',
          deviceId: 'device-new',
          isSafe: true,
          lastSeen: '2026-03-25T22:00:00.000Z',
        },
      ],
    };

    const record = mapFamilyGroupToRemoteRecord(rejoiningGroup, previousRecord, {
      authState: 'authenticated',
      userId: 'user-123',
    });
    const mappedGroup = mapRemoteRecordToFamilyGroup(record, rejoiningGroup);

    expect(record.members).toHaveLength(1);
    expect(record.members[0].id).toBe('member-2');
    expect(record.members[0].deviceId).toBe('device-new');
    expect(record.members[0].userId).toBe('user-123');
    expect(mappedGroup?.currentMemberId).toBe('member-2');
  });

  it('rebases a pending record onto the latest remote state while preserving remote-only members', () => {
    const latestRecord = {
      id: 'family:ABC123',
      inviteCode: 'ABC123',
      version: 4,
      createdAt: '2026-03-25T20:00:00.000Z',
      updatedAt: '2026-03-25T22:00:00.000Z',
      createdByMemberId: 'member-1',
      members: [
        {
          id: 'member-1',
          name: 'Dana',
          deviceId: 'device-1',
          role: 'owner' as const,
          status: 'needs_check_in' as const,
          joinedAt: '2026-03-25T20:00:00.000Z',
          lastStatusAt: '2026-03-25T20:00:00.000Z',
          lastSeenAt: '2026-03-25T20:00:00.000Z',
        },
        {
          id: 'member-2',
          name: 'Noam',
          deviceId: 'device-2',
          role: 'member' as const,
          status: 'safe' as const,
          joinedAt: '2026-03-25T21:00:00.000Z',
          lastStatusAt: '2026-03-25T21:00:00.000Z',
          lastSeenAt: '2026-03-25T21:00:00.000Z',
        },
      ],
    };
    const pendingRecord = {
      ...latestRecord,
      version: 3,
      updatedAt: '2026-03-25T21:30:00.000Z',
      members: [
        {
          ...latestRecord.members[0],
          status: 'safe' as const,
          lastStatusAt: '2026-03-25T21:30:00.000Z',
          lastSeenAt: '2026-03-25T21:30:00.000Z',
        },
      ],
    };

    const rebased = rebaseFamilyRemoteGroupRecord(pendingRecord, latestRecord);

    expect(rebased.version).toBe(4);
    expect(rebased.members).toHaveLength(2);
    expect(rebased.members.find((member) => member.id === 'member-1')?.status).toBe('safe');
    expect(rebased.members.find((member) => member.id === 'member-2')?.status).toBe('safe');
  });
});

import { describe, expect, it } from 'vitest';
import type { FamilyGroup } from '../familySafetyService';
import {
  mapFamilyGroupToRemoteRecord,
  mapRemoteRecordToFamilyGroup,
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
    expect(record.createdByMemberId).toBe('member-1');
    expect(record.members[0].status).toBe('needs_check_in');
    expect(record.members[0].role).toBe('owner');
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

    expect(record.createdByMemberId).toBe('member-1');
    expect(record.members).toHaveLength(2);
    expect(record.members.find((member) => member.id === 'member-1')?.role).toBe('owner');
    expect(record.members.find((member) => member.id === 'member-2')?.role).toBe('member');
  });

  it('reuses the existing remote member identity when the same device rejoins', () => {
    const previousRecord = {
      id: 'family:ABC123',
      inviteCode: 'ABC123',
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
});

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
});


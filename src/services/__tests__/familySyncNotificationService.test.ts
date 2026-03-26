import { describe, expect, it } from 'vitest';
import { getFamilySyncNotificationEvents } from '../familySyncNotificationService';
import type { FamilyGroup } from '../familySafetyService';

const baseGroup: FamilyGroup = {
  groupCode: 'ABC123',
  memberName: 'Dana',
  currentMemberId: 'member-1',
  members: [
    { id: 'member-1', name: 'Dana', deviceId: 'device-1', isSafe: false },
  ],
};

describe('familySyncNotificationService', () => {
  it('ignores initial hydration and group switches', () => {
    expect(getFamilySyncNotificationEvents(null, baseGroup)).toEqual([]);
    expect(getFamilySyncNotificationEvents(baseGroup, { ...baseGroup, groupCode: 'ZZZ999' })).toEqual([]);
  });

  it('detects remote member joins', () => {
    const nextGroup: FamilyGroup = {
      ...baseGroup,
      members: [
        ...baseGroup.members,
        { id: 'member-2', name: 'Noam', deviceId: 'device-2', isSafe: false },
      ],
    };

    expect(getFamilySyncNotificationEvents(baseGroup, nextGroup)).toEqual([
      expect.objectContaining({
        type: 'member_joined',
        memberName: 'Noam',
        memberId: 'member-2',
        notificationKey: expect.stringContaining('family-member_joined-member-2'),
      }),
    ]);
  });

  it('detects remote member safe and needs-check-in transitions', () => {
    const previousGroup: FamilyGroup = {
      ...baseGroup,
      members: [
        ...baseGroup.members,
        { id: 'member-2', name: 'Noam', deviceId: 'device-2', isSafe: false },
        { id: 'member-3', name: 'Yael', deviceId: 'device-3', isSafe: true },
      ],
    };
    const nextGroup: FamilyGroup = {
      ...previousGroup,
      members: [
        ...baseGroup.members,
        { id: 'member-2', name: 'Noam', deviceId: 'device-2', isSafe: true },
        { id: 'member-3', name: 'Yael', deviceId: 'device-3', isSafe: false },
      ],
    };

    expect(getFamilySyncNotificationEvents(previousGroup, nextGroup)).toEqual([
      expect.objectContaining({
        type: 'member_safe',
        memberName: 'Noam',
        memberId: 'member-2',
        notificationKey: expect.stringContaining('family-member_safe-member-2'),
      }),
      expect.objectContaining({
        type: 'member_needs_check_in',
        memberName: 'Yael',
        memberId: 'member-3',
        notificationKey: expect.stringContaining('family-member_needs_check_in-member-3'),
      }),
    ]);
  });

  it('detects remote member departures and ignores local-member changes', () => {
    const previousGroup: FamilyGroup = {
      ...baseGroup,
      members: [
        { id: 'member-1', name: 'Dana', deviceId: 'device-1', isSafe: false },
        { id: 'member-2', name: 'Noam', deviceId: 'device-2', isSafe: false },
      ],
    };
    const nextGroup: FamilyGroup = {
      ...previousGroup,
      members: [
        { id: 'member-1', name: 'Dana', deviceId: 'device-1', isSafe: true },
      ],
    };

    expect(getFamilySyncNotificationEvents(previousGroup, nextGroup)).toEqual([
      expect.objectContaining({
        type: 'member_left',
        memberName: 'Noam',
        memberId: 'member-2',
        notificationKey: expect.stringContaining('family-member_left-member-2'),
      }),
    ]);
  });
});

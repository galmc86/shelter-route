import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createGroup,
  getGroup,
  markCurrentMemberNeedsCheckIn,
  setImSafe,
  subscribeToFamilyGroupChanges,
} from '../familySafetyService';

describe('familySafetyService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('resets the current member to needing check-in when a new alert starts', () => {
    createGroup('Dana');
    setImSafe();

    const resetGroup = markCurrentMemberNeedsCheckIn();

    expect(resetGroup).not.toBeNull();
    expect(resetGroup?.members.find((member) => member.name === 'Dana')?.isSafe).toBe(false);
    expect(resetGroup?.members.find((member) => member.name === 'Dana')?.deviceId).toBeTruthy();
    expect(getGroup()?.members.find((member) => member.name === 'Dana')?.isSafe).toBe(false);
  });

  it('notifies subscribers when the family group changes', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToFamilyGroupChanges(listener);

    createGroup('Dana');

    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    setImSafe();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('migrates legacy unversioned family-group storage', () => {
    localStorage.setItem('shelter-route:family-group', JSON.stringify({
      groupCode: 'abc123',
      memberName: 'Dana',
      members: [{ id: '1', name: 'Dana', isSafe: true }],
    }));

    const group = getGroup();
    const persisted = JSON.parse(localStorage.getItem('shelter-route:family-group') ?? 'null');

    expect(group?.groupCode).toBe('ABC123');
    expect(group?.currentMemberId).toBe('1');
    expect(group?.members[0].deviceId).toBeTruthy();
    expect(persisted.version).toBe(2);
    expect(persisted.group.groupCode).toBe('ABC123');
    expect(persisted.group.currentMemberId).toBe('1');
    expect(persisted.group.members[0].deviceId).toBeTruthy();
  });
});

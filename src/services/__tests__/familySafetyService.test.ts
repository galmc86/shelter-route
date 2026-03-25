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
});

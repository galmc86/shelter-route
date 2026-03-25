import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useFamilyGroupState } from '../useFamilyGroupState';

describe('useFamilyGroupState', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates a group and exposes derived member counts', () => {
    const { result } = renderHook(() => useFamilyGroupState());

    act(() => {
      result.current.createFamilyGroup('Dana');
    });

    expect(result.current.hasGroup).toBe(true);
    expect(result.current.group?.memberName).toBe('Dana');
    expect(result.current.safeMembersCount).toBe(0);
    expect(result.current.waitingMembersCount).toBe(1);
  });

  it('marks the current member safe and then resets them to needing check-in', () => {
    const { result } = renderHook(() => useFamilyGroupState());

    act(() => {
      result.current.createFamilyGroup('Dana');
      result.current.markFamilySafe();
    });

    expect(result.current.isCurrentMemberSafe).toBe(true);

    act(() => {
      result.current.markNeedsCheckIn();
    });

    expect(result.current.isCurrentMemberSafe).toBe(false);
  });
});

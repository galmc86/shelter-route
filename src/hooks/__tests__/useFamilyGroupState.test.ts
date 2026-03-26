import { act, renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FamilyRepositoryProvider } from '../../contexts/FamilyRepositoryContext';
import type { FamilyRepository } from '../../services/familyRepository';
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

  it('prefers a provided repository implementation when present', () => {
    const repository: FamilyRepository = {
      getSnapshot: () => ({
        groupCode: 'ABC123',
        memberName: 'Dana',
        currentMemberId: 'member-1',
        members: [
          { id: 'member-1', name: 'Dana', isSafe: true, lastSeen: '2026-03-25T19:00:00.000Z' },
        ],
      }),
      subscribe: vi.fn(() => () => {}),
      createGroup: vi.fn(),
      joinGroup: vi.fn(),
      markCurrentMemberSafe: vi.fn(),
      markCurrentMemberNeedsCheckIn: vi.fn(),
      retrySync: vi.fn(),
      leaveGroup: vi.fn(),
      getShareLink: vi.fn(() => 'https://example.com/family/ABC123'),
    };

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(FamilyRepositoryProvider, { value: repository, children });

    const { result } = renderHook(() => useFamilyGroupState(), { wrapper });

    expect(result.current.group?.groupCode).toBe('ABC123');
    expect(result.current.isCurrentMemberSafe).toBe(true);
    expect(result.current.shareLink).toBe('https://example.com/family/ABC123');
    expect(repository.subscribe).toHaveBeenCalledTimes(1);
  });

  it('retries family sync through the provided repository when requested', () => {
    const retrySync = vi.fn(() => ({
      groupCode: 'ABC123',
      memberName: 'Dana',
      currentMemberId: 'member-1',
      members: [
        { id: 'member-1', name: 'Dana', isSafe: true, lastSeen: '2026-03-25T19:00:00.000Z' },
      ],
    }));

    const repository: FamilyRepository = {
      getSnapshot: () => null,
      subscribe: vi.fn(() => () => {}),
      createGroup: vi.fn(),
      joinGroup: vi.fn(),
      markCurrentMemberSafe: vi.fn(),
      markCurrentMemberNeedsCheckIn: vi.fn(),
      retrySync,
      leaveGroup: vi.fn(),
      getShareLink: vi.fn(() => null),
    };

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(FamilyRepositoryProvider, { value: repository, children });

    const { result } = renderHook(() => useFamilyGroupState(), { wrapper });

    act(() => {
      result.current.retryFamilySync();
    });

    expect(retrySync).toHaveBeenCalledTimes(1);
    expect(result.current.group?.groupCode).toBe('ABC123');
  });

  it('subscribes before performing the effect-time snapshot refresh', () => {
    const callOrder: string[] = [];

    const repository: FamilyRepository = {
      getSnapshot: vi.fn(() => {
        callOrder.push('getSnapshot');
        return null;
      }),
      subscribe: vi.fn(() => {
        callOrder.push('subscribe');
        return () => {};
      }),
      createGroup: vi.fn(),
      joinGroup: vi.fn(),
      markCurrentMemberSafe: vi.fn(),
      markCurrentMemberNeedsCheckIn: vi.fn(),
      retrySync: vi.fn(),
      leaveGroup: vi.fn(),
      getShareLink: vi.fn(() => null),
    };

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(FamilyRepositoryProvider, { value: repository, children });

    renderHook(() => useFamilyGroupState(), { wrapper });

    expect(callOrder).toEqual(['getSnapshot', 'subscribe', 'getSnapshot']);
  });
});

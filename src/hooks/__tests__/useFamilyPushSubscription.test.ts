import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFamilyPushSubscription } from '../useFamilyPushSubscription';

const mockUseFamilyGroupState = vi.fn();
const mockIsFamilyPushSupported = vi.fn();
const mockRefreshFamilyPushStatus = vi.fn();
const mockSyncFamilyPushSubscription = vi.fn();
const mockUnregisterFamilyPushSubscription = vi.fn();

vi.mock('../useFamilyGroupState', () => ({
  useFamilyGroupState: () => mockUseFamilyGroupState(),
}));

vi.mock('../../services/familyPushNotificationService', () => ({
  isFamilyPushSupported: () => mockIsFamilyPushSupported(),
  refreshFamilyPushStatus: (...args: unknown[]) => mockRefreshFamilyPushStatus(...args),
  syncFamilyPushSubscription: (...args: unknown[]) => mockSyncFamilyPushSubscription(...args),
  unregisterFamilyPushSubscription: (...args: unknown[]) => mockUnregisterFamilyPushSubscription(...args),
}));

describe('useFamilyPushSubscription', () => {
  beforeEach(() => {
    mockUseFamilyGroupState.mockReset();
    mockIsFamilyPushSupported.mockReset();
    mockRefreshFamilyPushStatus.mockReset();
    mockSyncFamilyPushSubscription.mockReset();
    mockUnregisterFamilyPushSubscription.mockReset();
    mockIsFamilyPushSupported.mockReturnValue(true);

    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: { permission: 'granted' },
    });
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: false,
    });
  });

  it('does not unregister the previous subscription when the group disappears temporarily', () => {
    mockUseFamilyGroupState.mockReturnValue({
      group: { groupCode: 'ABC123' },
    });

    const { rerender } = renderHook(() => useFamilyPushSubscription());
    expect(mockSyncFamilyPushSubscription).toHaveBeenCalledWith('ABC123');

    mockUseFamilyGroupState.mockReturnValue({
      group: null,
    });
    rerender();

    expect(mockUnregisterFamilyPushSubscription).not.toHaveBeenCalled();
  });
});

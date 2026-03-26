import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFamilyPushRefresh } from '../useFamilyPushRefresh';

const mockUseFamilyGroupState = vi.fn();

vi.mock('../useFamilyGroupState', () => ({
  useFamilyGroupState: () => mockUseFamilyGroupState(),
}));

describe('useFamilyPushRefresh', () => {
  const listeners = new Map<string, EventListener>();

  beforeEach(() => {
    mockUseFamilyGroupState.mockReset();
    listeners.clear();

    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        addEventListener: vi.fn((type: string, listener: EventListener) => {
          listeners.set(type, listener);
        }),
        removeEventListener: vi.fn((type: string) => {
          listeners.delete(type);
        }),
      },
    });
  });

  it('triggers an immediate retry when a matching family push message arrives', () => {
    const retryFamilySync = vi.fn();
    mockUseFamilyGroupState.mockReturnValue({
      group: { groupCode: 'ABC123' },
      retryFamilySync,
    });

    renderHook(() => useFamilyPushRefresh());

    const listener = listeners.get('message');
    expect(listener).toBeTypeOf('function');

    listener?.({
      data: {
        type: 'FAMILY_SYNC_PUSH',
        groupCode: 'ABC123',
      },
    } as MessageEvent);

    expect(retryFamilySync).toHaveBeenCalledTimes(1);
  });

  it('ignores push messages for a different family group', () => {
    const retryFamilySync = vi.fn();
    mockUseFamilyGroupState.mockReturnValue({
      group: { groupCode: 'ABC123' },
      retryFamilySync,
    });

    renderHook(() => useFamilyPushRefresh());

    const listener = listeners.get('message');
    listener?.({
      data: {
        type: 'FAMILY_SYNC_PUSH',
        groupCode: 'ZZZ999',
      },
    } as MessageEvent);

    expect(retryFamilySync).not.toHaveBeenCalled();
  });
});

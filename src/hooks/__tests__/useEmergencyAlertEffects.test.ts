import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEmergencyAlertEffects } from '../useEmergencyAlertEffects';

const mockPlayAlertSound = vi.fn();
const mockStopAlertSound = vi.fn();

vi.mock('../../utils/alertSound', () => ({
  playAlertSound: () => mockPlayAlertSound(),
  stopAlertSound: () => mockStopAlertSound(),
}));

describe('useEmergencyAlertEffects', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: vi.fn(),
    });
  });

  it('does not activate emergency after a transient alert clears before the timeout fires', () => {
    const onDismissBase = vi.fn();
    const onActivateEmergency = vi.fn();

    const view = renderHook(
      ({ isAlertActive }) =>
        useEmergencyAlertEffects({
          isAlertActive,
          onDismissBase,
          onActivateEmergency,
        }),
      { initialProps: { isAlertActive: false } }
    );

    view.rerender({ isAlertActive: true });
    view.rerender({ isAlertActive: false });

    act(() => {
      vi.runAllTimers();
    });

    expect(onActivateEmergency).not.toHaveBeenCalled();
    expect(mockPlayAlertSound).not.toHaveBeenCalled();
  });

  it('clears pending activation when the alert is dismissed before the timeout fires', () => {
    const onDismissBase = vi.fn();
    const onActivateEmergency = vi.fn();

    const { result, rerender } = renderHook(
      ({ isAlertActive }) =>
        useEmergencyAlertEffects({
          isAlertActive,
          onDismissBase,
          onActivateEmergency,
        }),
      { initialProps: { isAlertActive: false } }
    );

    rerender({ isAlertActive: true });

    act(() => {
      result.current.dismissAlert();
      vi.runAllTimers();
    });

    expect(onDismissBase).toHaveBeenCalledTimes(1);
    expect(onActivateEmergency).not.toHaveBeenCalled();
    expect(mockPlayAlertSound).not.toHaveBeenCalled();
    expect(mockStopAlertSound).toHaveBeenCalled();
  });

  it('still activates emergency feedback when the alert remains active', () => {
    const onDismissBase = vi.fn();
    const onActivateEmergency = vi.fn();

    const { rerender } = renderHook(
      ({ isAlertActive }) =>
        useEmergencyAlertEffects({
          isAlertActive,
          onDismissBase,
          onActivateEmergency,
        }),
      { initialProps: { isAlertActive: false } }
    );

    rerender({ isAlertActive: true });

    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(onActivateEmergency).toHaveBeenCalledTimes(1);
    expect(mockPlayAlertSound).toHaveBeenCalledTimes(1);
  });
});

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useLookupModeState } from '../useLookupModeState';

describe('useLookupModeState', () => {
  it('manages emergency and nearby transitions from a dedicated lookup state seam', () => {
    const { result, rerender } = renderHook(
      () => useLookupModeState({
        initialPanelExpanded: false,
      }),
    );

    expect(result.current.panelExpanded).toBe(false);

    act(() => {
      result.current.enterNearMeMode();
    });

    expect(result.current.nearMeMode).toBe(true);
    expect(result.current.panelExpanded).toBe(true);

    act(() => {
      result.current.enterSavedLocationMode({ lat: 31.7, lng: 35.2, address: 'Saved' }, 'Home');
    });

    expect(result.current.savedLookupLocation).toEqual({
      location: { lat: 31.7, lng: 35.2, address: 'Saved' },
      label: 'Home',
    });

    act(() => {
      result.current.enterEmergencyMode();
    });

    expect(result.current.emergencyMode).toBe(true);
    expect(result.current.nearMeMode).toBe(false);
    expect(result.current.savedLookupLocation).toBe(null);

    act(() => {
      result.current.collapseForRouteSearch();
    });

    expect(result.current.emergencyMode).toBe(false);
    expect(result.current.nearMeMode).toBe(false);
    expect(result.current.panelExpanded).toBe(false);
    rerender();
  });
});

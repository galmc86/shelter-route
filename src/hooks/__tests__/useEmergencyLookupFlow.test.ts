import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEmergencyLookupFlow } from '../useEmergencyLookupFlow';
import type { LocationPoint, Shelter } from '../../types';
import type L from 'leaflet';

const mockPlayAlertSound = vi.fn();
const mockStopAlertSound = vi.fn();

vi.mock('../../utils/alertSound', () => ({
  playAlertSound: () => mockPlayAlertSound(),
  stopAlertSound: () => mockStopAlertSound(),
}));

const defaultLocation: LocationPoint = { lat: 32.0853, lng: 34.7818 };
const defaultShelters = [{ id: 'shelter-1' }, { id: 'shelter-2' }] as Shelter[];

function buildMapRef(lat = 31.9, lng = 34.8) {
  return {
    current: {
      getCenter: () => ({ lat, lng }),
    },
  } as { current: L.Map | null };
}

describe('useEmergencyLookupFlow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: vi.fn(),
    });
  });

  it('routes nearby, saved-location, and emergency entry actions through a dedicated lookup seam', () => {
    const enterNearMeMode = vi.fn();
    const enterSavedLocationMode = vi.fn();
    const enterEmergencyMode = vi.fn();
    const getLocation = vi.fn();
    const onResetSelection = vi.fn();
    const clearNearest = vi.fn();
    const onTrackEmergency = vi.fn();

    const { result } = renderHook(() =>
      useEmergencyLookupFlow({
        isAlertActive: false,
        emergencyMode: false,
        activeLookupLocation: null,
        currentLocation: defaultLocation,
        lastKnownLocation: defaultLocation,
        locationError: null,
        allShelters: defaultShelters,
        mapRef: buildMapRef(),
        getLocation,
        clearNearest,
        findNearest: vi.fn(),
        enterNearMeMode,
        enterSavedLocationMode,
        enterEmergencyMode,
        enterEmergencyLocationMode: vi.fn(),
        exitEmergencyMode: vi.fn(),
        exitNearMeMode: vi.fn(),
        onDismissBase: vi.fn(),
        onResetSelection,
        onTrackEmergency,
        t: (key) => key,
      })
    );

    act(() => {
      result.current.handleNearMeClick();
      result.current.handleSearchFromSavedLocation({ lat: 31.77, lng: 35.21 }, 'Home');
      result.current.handleEmergencyClick();
    });

    expect(enterNearMeMode).toHaveBeenCalledTimes(1);
    expect(enterSavedLocationMode).toHaveBeenCalledWith({ lat: 31.77, lng: 35.21 }, 'Home');
    expect(enterEmergencyMode).toHaveBeenCalledTimes(1);
    expect(getLocation).toHaveBeenCalledTimes(2);
    expect(onResetSelection).toHaveBeenCalledTimes(3);
    expect(clearNearest).toHaveBeenCalledTimes(1);
    expect(onTrackEmergency).toHaveBeenCalledTimes(1);
  });

  it('applies the last-known emergency fallback only once per active alert', () => {
    const enterEmergencyLocationMode = vi.fn();
    const onResetSelection = vi.fn();
    const clearNearest = vi.fn();

    const view = renderHook(
      ({ activeLookupLocation }: { activeLookupLocation: { lat: number; lng: number } | null }) =>
        useEmergencyLookupFlow({
          isAlertActive: true,
          emergencyMode: true,
          activeLookupLocation,
          currentLocation: null,
          lastKnownLocation: defaultLocation,
          locationError: 'error.locationUnavailable',
          allShelters: defaultShelters,
          mapRef: buildMapRef(),
          getLocation: vi.fn(),
          clearNearest,
          findNearest: vi.fn(),
          enterNearMeMode: vi.fn(),
          enterSavedLocationMode: vi.fn(),
          enterEmergencyMode: vi.fn(),
          enterEmergencyLocationMode,
          exitEmergencyMode: vi.fn(),
          exitNearMeMode: vi.fn(),
          onDismissBase: vi.fn(),
          onResetSelection,
          onTrackEmergency: vi.fn(),
          t: (key) => key === 'emergency.lastKnownLocationLabel' ? 'Last known location' : key,
        }),
      { initialProps: { activeLookupLocation: null } }
    );

    expect(enterEmergencyLocationMode).toHaveBeenCalledWith(defaultLocation, 'Last known location');
    expect(onResetSelection).toHaveBeenCalledTimes(1);
    expect(clearNearest).toHaveBeenCalledTimes(1);

    view.rerender({ activeLookupLocation: null });

    expect(enterEmergencyLocationMode).toHaveBeenCalledTimes(1);
  });

  it('uses the map center to find nearby shelters when emergency location fails', () => {
    const findNearest = vi.fn();

    const { result } = renderHook(() =>
      useEmergencyLookupFlow({
        isAlertActive: false,
        emergencyMode: true,
        activeLookupLocation: null,
        currentLocation: null,
        lastKnownLocation: null,
        locationError: 'error.locationUnavailable',
        allShelters: defaultShelters,
        mapRef: buildMapRef(32.11, 34.79),
        getLocation: vi.fn(),
        clearNearest: vi.fn(),
        findNearest,
        enterNearMeMode: vi.fn(),
        enterSavedLocationMode: vi.fn(),
        enterEmergencyMode: vi.fn(),
        enterEmergencyLocationMode: vi.fn(),
        exitEmergencyMode: vi.fn(),
        exitNearMeMode: vi.fn(),
        onDismissBase: vi.fn(),
        onResetSelection: vi.fn(),
        onTrackEmergency: vi.fn(),
        t: (key) => key,
      })
    );

    act(() => {
      result.current.handleUseMapCenter();
    });

    expect(findNearest).toHaveBeenCalledWith(defaultShelters, 32.11, 34.79);
  });
});

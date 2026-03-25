import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCurrentLocation } from '../useCurrentLocation';

const getCurrentPosition = vi.fn();
const watchPosition = vi.fn();
const clearWatch = vi.fn();

vi.mock('../../i18n', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../services/errorReportingService', () => ({
  reportError: vi.fn(),
}));

Object.defineProperty(globalThis.navigator, 'geolocation', {
  configurable: true,
  value: {
    getCurrentPosition,
    watchPosition,
    clearWatch,
  },
});

describe('useCurrentLocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('loads the last known location from localStorage', () => {
    localStorage.setItem('shelter-route:last-known-location', JSON.stringify({
      lat: 32.11,
      lng: 34.82,
      savedAt: Date.now(),
    }));

    const { result } = renderHook(() => useCurrentLocation());

    expect(result.current.lastKnownLocation).toEqual({ lat: 32.11, lng: 34.82 });
    expect(result.current.location).toBeNull();
  });

  it('persists a successful geolocation lookup as the last known location', async () => {
    getCurrentPosition.mockImplementation((success: PositionCallback) => {
      success({
        coords: {
          latitude: 32.12,
          longitude: 34.83,
        },
      } as GeolocationPosition);
    });

    const { result } = renderHook(() => useCurrentLocation());

    act(() => {
      result.current.getLocation();
    });

    await waitFor(() => {
      expect(result.current.location).toEqual({ lat: 32.12, lng: 34.83 });
    });

    expect(result.current.lastKnownLocation).toEqual({ lat: 32.12, lng: 34.83 });
    expect(JSON.parse(localStorage.getItem('shelter-route:last-known-location') ?? 'null')).toMatchObject({
      lat: 32.12,
      lng: 34.83,
    });
  });
});

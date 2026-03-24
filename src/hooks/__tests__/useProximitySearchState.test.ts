import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useProximitySearchState } from '../useProximitySearchState';
import type { ShelterWithDistance } from '../useShelters';

const nearestShelter: ShelterWithDistance = {
  id: 'shelter-1',
  name: 'Shelter 1',
  address: 'Test Address',
  lat: 32.11,
  lon: 34.81,
  city: 'Tel Aviv',
  distanceFromRoute: 120,
  walkingTimeMinutes: 2,
  isAccessible: true,
  capacity: 20,
  currentOccupancy: 3,
};

describe('useProximitySearchState', () => {
  it('derives saved-place lookup state and triggers nearest search in lookup modes', () => {
    const findNearest = vi.fn();

    const { result } = renderHook(() => useProximitySearchState({
      currentLocation: { lat: 32.12, lng: 34.82, address: 'Current' },
      savedLookupLocation: {
        location: { lat: 31.78, lng: 35.22, address: 'Saved' },
        label: 'Home',
      },
      emergencyMode: false,
      nearMeMode: true,
      allShelters: [{ id: 'shelter-1', name: 'Shelter 1', lat: 32.1, lon: 34.8, city: 'Tel Aviv' }],
      nearbyShelters: [],
      nearestShelters: [nearestShelter],
      isNavigating: false,
      myLocationLabel: 'My location',
      findNearest,
    }));

    expect(result.current.activeLookupLocation).toEqual({ lat: 31.78, lng: 35.22, address: 'Saved' });
    expect(result.current.activeLookupLabel).toBe('Home');
    expect(result.current.displayShelters).toEqual([nearestShelter]);
    expect(result.current.mapUserLocation).toEqual({ lat: 31.78, lng: 35.22, address: 'Saved' });
    expect(findNearest).toHaveBeenCalledWith(
      [{ id: 'shelter-1', name: 'Shelter 1', lat: 32.1, lon: 34.8, city: 'Tel Aviv' }],
      31.78,
      35.22
    );
  });

  it('falls back to route shelters when not in a lookup mode', () => {
    const findNearest = vi.fn();

    const routeShelter: ShelterWithDistance = {
      ...nearestShelter,
      id: 'route-shelter',
      name: 'Route Shelter',
    };

    const { result } = renderHook(() => useProximitySearchState({
      currentLocation: { lat: 32.12, lng: 34.82, address: 'Current' },
      savedLookupLocation: null,
      emergencyMode: false,
      nearMeMode: false,
      allShelters: [],
      nearbyShelters: [routeShelter],
      nearestShelters: [nearestShelter],
      isNavigating: false,
      myLocationLabel: 'My location',
      findNearest,
    }));

    expect(result.current.activeLookupLocation).toEqual({ lat: 32.12, lng: 34.82, address: 'Current' });
    expect(result.current.activeLookupLabel).toBeNull();
    expect(result.current.displayShelters).toEqual([routeShelter]);
    expect(result.current.mapUserLocation).toBeNull();
    expect(findNearest).not.toHaveBeenCalled();
  });
});

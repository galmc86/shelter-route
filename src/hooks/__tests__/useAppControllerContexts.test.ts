import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAppControllerContexts } from '../useAppControllerContexts';
import type { ShelterWithDistance } from '../useShelters';

const mockShelter: ShelterWithDistance = {
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

describe('useAppControllerContexts', () => {
  it('projects controller state into route, emergency, and shelter contexts', () => {
    const handleSearch = vi.fn();
    const handleRouteSelect = vi.fn();
    const handleEmergencyClick = vi.fn();
    const handleExitEmergency = vi.fn();
    const getLocation = vi.fn();
    const handleSearchFromSavedLocation = vi.fn();
    const handleNearMeClick = vi.fn();
    const handleExitNearMe = vi.fn();
    const handleUseMapCenter = vi.fn();
    const handleShelterClick = vi.fn();
    const handleNavigateToShelter = vi.fn(async () => undefined);

    const { result } = renderHook(() => useAppControllerContexts({
      emergencyMode: false,
      nearMeMode: true,
      selectedRoute: null,
      selectedRouteIndex: 0,
      routesWithShelters: [
        {
          route: {
            path: [],
            bounds: {
              southWest: { lat: 32.1, lng: 34.8 },
              northEast: { lat: 32.2, lng: 34.9 },
            },
            duration: '10 min',
            distance: '1 km',
            durationSeconds: 600,
            distanceMeters: 1000,
          },
          shelterCount: 2,
        },
      ],
      displayShelters: [mockShelter],
      sheltersLoading: false,
      isEmergencySearching: false,
      routeError: null,
      isRouteLoading: false,
      handleSearch,
      handleRouteSelect,
      shareOrigin: { lat: 32.1, lng: 34.8 },
      shareDestination: { lat: 32.2, lng: 34.9 },
      shareTravelMode: 'WALKING',
      routeRisk: null,
      timeFilter: 1,
      setTimeFilter: vi.fn(),
      handleEmergencyClick,
      handleExitEmergency,
      currentLocation: { lat: 32.12, lng: 34.82 },
      lastKnownLocation: { lat: 32.05, lng: 34.78 },
      activeLookupLocation: { lat: 31.78, lng: 35.22 },
      activeLookupLabel: 'Home',
      isLoadingLocation: false,
      locationError: null,
      getLocation,
      handleSearchFromSavedLocation,
      handleUseLastKnownLocation: vi.fn(),
      handleNearMeClick,
      handleExitNearMe,
      handleUseMapCenter,
      selectedShelterId: 'shelter-1',
      handleShelterClick,
      handleNavigateToShelter,
      capacityMap: new Map(),
      allShelters: [{ id: 'shelter-1', name: 'Shelter 1', lat: 32.11, lon: 34.81, city: 'Tel Aviv' }],
    }));

    expect(result.current.routeContextValue.routeInfo).toBeNull();
    expect(result.current.routeContextValue.routesWithShelters).toEqual([]);
    expect(result.current.routeContextValue.nearbyShelters).toEqual([mockShelter]);
    expect(result.current.emergencyContextValue.activeLookupLabel).toBe('Home');
    expect(result.current.emergencyContextValue.lastKnownLocation).toEqual({ lat: 32.05, lng: 34.78 });
    expect(result.current.emergencyContextValue.nearMeMode).toBe(true);
    expect(result.current.shelterContextValue.selectedShelterId).toBe('shelter-1');
    expect(result.current.shelterContextValue.onNavigateToShelter).toBe(handleNavigateToShelter);
  });
});

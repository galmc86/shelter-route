import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppController } from '../useAppController';
import type { LatLng } from '../../types';
import type { ShelterWithDistance } from '../useShelters';

const origin: LatLng = { lat: 32.1, lng: 34.8 };
const destination: LatLng = { lat: 32.2, lng: 34.9 };
const savedOrigin: LatLng = { lat: 31.78, lng: 35.22 };

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

const mockSearchRoute = vi.fn();
const mockSelectRoute = vi.fn();
const mockFilterByRoute = vi.fn();
const mockGetRoutesWithShelters = vi.fn(() => []);
const mockGetLocation = vi.fn();
const mockFindNearest = vi.fn();
const mockClearNearest = vi.fn();
const mockTrackEmergency = vi.fn();
const mockTrackRouteSearch = vi.fn();
const mockPlayAlertSound = vi.fn();
const mockStopAlertSound = vi.fn();
const mockDismissAlert = vi.fn();
const mockStartNavigation = vi.fn(() => Promise.resolve());
const mockStopNavigation = vi.fn();

let mockGoogleMapsState: { error: string | null };
let mockRouteState: {
  routes: Array<unknown>;
  selectedRouteIndex: number;
  selectedRoute: unknown;
  selectRoute: typeof mockSelectRoute;
  isLoading: boolean;
  error: string | null;
  searchRoute: typeof mockSearchRoute;
};
let mockShelterState: {
  allShelters: Array<{ id: string }>;
  nearbyShelters: ShelterWithDistance[];
  isLoading: boolean;
  filterByRoute: typeof mockFilterByRoute;
  getRoutesWithShelters: typeof mockGetRoutesWithShelters;
};
let mockLocationState: {
  location: { lat: number; lng: number } | null;
  lastKnownLocation: { lat: number; lng: number } | null;
  isLoading: boolean;
  error: string | null;
  getLocation: typeof mockGetLocation;
};
let mockNearestState: {
  nearestShelters: ShelterWithDistance[];
  isSearching: boolean;
  findNearest: typeof mockFindNearest;
  clear: typeof mockClearNearest;
};
let mockOrefState: {
  isAlertActive: boolean;
  matchedRegion: { name: string } | null;
  countdown: number | null;
  dismissAlert: typeof mockDismissAlert;
};
let mockAlertHistoryState: {
  routeRisk: null;
  timeFilter: 1;
  setTimeFilter: ReturnType<typeof vi.fn>;
};
let mockNavigationState: {
  navigationRoute: unknown;
  targetShelter: ShelterWithDistance | null;
  isNavigating: boolean;
  isLoadingNav: boolean;
  navError: string | null;
  startNavigation: typeof mockStartNavigation;
  stopNavigation: typeof mockStopNavigation;
};

vi.mock('../../i18n', () => ({
  useLanguage: () => ({
    language: 'en' as const,
    t: (key: string) => key,
  }),
}));

vi.mock('../../theme', () => ({
  useTheme: () => ({
    theme: 'light',
  }),
}));

vi.mock('../useGoogleMaps', () => ({
  useGoogleMaps: () => mockGoogleMapsState,
}));

vi.mock('../useRoute', () => ({
  useRoute: () => mockRouteState,
}));

vi.mock('../useShelters', () => ({
  useShelters: () => mockShelterState,
}));

vi.mock('../useCurrentLocation', () => ({
  useCurrentLocation: () => mockLocationState,
}));

vi.mock('../useNearestShelters', () => ({
  useNearestShelters: () => mockNearestState,
}));

vi.mock('../useCapacity', () => ({
  useCapacity: () => new Map(),
}));

vi.mock('../useOrefAlerts', () => ({
  useOrefAlerts: () => mockOrefState,
}));

vi.mock('../useAlertHistory', () => ({
  useAlertHistory: () => mockAlertHistoryState,
}));

vi.mock('../useNavigation', () => ({
  useNavigation: () => mockNavigationState,
}));

vi.mock('../../services/safetyAnalyticsService', () => ({
  trackRouteSearch: (...args: unknown[]) => mockTrackRouteSearch(...args),
  trackEmergency: () => mockTrackEmergency(),
}));

vi.mock('../../utils/alertSound', () => ({
  playAlertSound: () => mockPlayAlertSound(),
  stopAlertSound: () => mockStopAlertSound(),
}));

describe('useAppController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/');

    mockGoogleMapsState = {
      error: null,
    };

    mockRouteState = {
      routes: [],
      selectedRouteIndex: 0,
      selectedRoute: null,
      selectRoute: mockSelectRoute,
      isLoading: false,
      error: null,
      searchRoute: mockSearchRoute,
    };

    mockShelterState = {
      allShelters: [{ id: 'shelter-a' }, { id: 'shelter-b' }],
      nearbyShelters: [mockShelter],
      isLoading: false,
      filterByRoute: mockFilterByRoute,
      getRoutesWithShelters: mockGetRoutesWithShelters,
    };

    mockLocationState = {
      location: { lat: 32.12, lng: 34.82 },
      lastKnownLocation: { lat: 32.1, lng: 34.8 },
      isLoading: false,
      error: null,
      getLocation: mockGetLocation,
    };

    mockNearestState = {
      nearestShelters: [mockShelter],
      isSearching: false,
      findNearest: mockFindNearest,
      clear: mockClearNearest,
    };

    mockOrefState = {
      isAlertActive: false,
      matchedRegion: null,
      countdown: null,
      dismissAlert: mockDismissAlert,
    };

    mockAlertHistoryState = {
      routeRisk: null,
      timeFilter: 1,
      setTimeFilter: vi.fn(),
    };

    mockNavigationState = {
      navigationRoute: null,
      targetShelter: null,
      isNavigating: false,
      isLoadingNav: false,
      navError: null,
      startNavigation: mockStartNavigation,
      stopNavigation: mockStopNavigation,
    };
  });

  it('composes saved-place lookup into emergency and route context state', async () => {
    const { result } = renderHook(() => useAppController());

    act(() => {
      result.current.emergencyContextValue.onSearchFromSavedLocation(savedOrigin, 'Home');
    });

    await waitFor(() => {
      expect(mockFindNearest).toHaveBeenCalledWith(
        mockShelterState.allShelters,
        savedOrigin.lat,
        savedOrigin.lng
      );
    });

    expect(result.current.nearMeMode).toBe(true);
    expect(result.current.panelExpanded).toBe(true);
    expect(result.current.emergencyMode).toBe(false);
    expect(result.current.emergencyContextValue.activeLookupLocation).toEqual({
      lat: savedOrigin.lat,
      lng: savedOrigin.lng,
      address: undefined,
    });
    expect(result.current.emergencyContextValue.activeLookupLabel).toBe('Home');
    expect(result.current.routeContextValue.routeInfo).toBeNull();
    expect(result.current.routeContextValue.routesWithShelters).toEqual([]);
    expect(result.current.routeContextValue.nearbyShelters).toEqual(mockNearestState.nearestShelters);
  });

  it('resets lookup modes and stores share metadata when running a route search', () => {
    const { result } = renderHook(() => useAppController());

    act(() => {
      result.current.emergencyContextValue.onNearMeClick();
    });

    expect(result.current.nearMeMode).toBe(true);

    act(() => {
      result.current.routeContextValue.onSearch(origin, destination, 'WALKING');
    });

    expect(result.current.nearMeMode).toBe(false);
    expect(result.current.emergencyMode).toBe(false);
    expect(result.current.panelExpanded).toBe(false);
    expect(result.current.routeContextValue.shareOrigin).toEqual(origin);
    expect(result.current.routeContextValue.shareDestination).toEqual(destination);
    expect(result.current.routeContextValue.shareTravelMode).toBe('WALKING');
    expect(mockSearchRoute).toHaveBeenCalledWith(origin, destination, 'WALKING');
    expect(mockClearNearest).toHaveBeenCalled();
  });

  it('enters emergency mode from alerts and dismisses alert feedback cleanly', async () => {
    const view = renderHook(() => useAppController());

    mockOrefState = {
      ...mockOrefState,
      isAlertActive: true,
      matchedRegion: { name: 'Tel Aviv' },
      countdown: 15,
    };

    view.rerender();

    await waitFor(() => {
      expect(mockGetLocation).toHaveBeenCalledTimes(1);
    });

    expect(view.result.current.emergencyMode).toBe(true);
    expect(view.result.current.panelExpanded).toBe(true);
    expect(view.result.current.routeContextValue.routeInfo).toBeNull();
    expect(mockPlayAlertSound).toHaveBeenCalledTimes(1);

    act(() => {
      view.result.current.dismissAlert();
    });

    expect(mockDismissAlert).toHaveBeenCalledTimes(1);
    expect(mockStopAlertSound).toHaveBeenCalledTimes(1);
  });

  it('uses the last known location as an emergency fallback without treating it as live geolocation', async () => {
    mockLocationState = {
      location: null,
      lastKnownLocation: { lat: 31.79, lng: 35.21 },
      isLoading: false,
      error: 'error.locationUnavailable',
      getLocation: mockGetLocation,
    };

    const { result } = renderHook(() => useAppController());

    act(() => {
      result.current.emergencyContextValue.onUseLastKnownLocation();
    });

    await waitFor(() => {
      expect(mockFindNearest).toHaveBeenCalledWith(
        mockShelterState.allShelters,
        31.79,
        35.21
      );
    });

    expect(result.current.emergencyMode).toBe(true);
    expect(result.current.nearMeMode).toBe(false);
    expect(result.current.emergencyContextValue.activeLookupLabel).toBe('emergency.lastKnownLocationLabel');
    expect(result.current.emergencyContextValue.currentLocation).toBeNull();
    expect(result.current.emergencyContextValue.lastKnownLocation).toEqual({ lat: 31.79, lng: 35.21 });
  });

  it('automatically uses the last known location when an alert opens emergency mode and live geolocation fails', async () => {
    mockLocationState = {
      location: null,
      lastKnownLocation: { lat: 31.79, lng: 35.21 },
      isLoading: false,
      error: 'error.locationUnavailable',
      getLocation: mockGetLocation,
    };

    const view = renderHook(() => useAppController());

    mockOrefState = {
      ...mockOrefState,
      isAlertActive: true,
      matchedRegion: { name: 'Tel Aviv' },
      countdown: 15,
    };

    view.rerender();

    await waitFor(() => {
      expect(mockGetLocation).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(mockFindNearest).toHaveBeenCalledWith(
        mockShelterState.allShelters,
        31.79,
        35.21
      );
    });

    expect(view.result.current.emergencyMode).toBe(true);
    expect(view.result.current.emergencyContextValue.activeLookupLabel).toBe('emergency.lastKnownLocationLabel');
    expect(view.result.current.emergencyContextValue.currentLocation).toBeNull();
  });
});

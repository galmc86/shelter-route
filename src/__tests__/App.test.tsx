import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from '../App';
import type { LatLng } from '../types';
import type { ShelterWithDistance } from '../hooks/useShelters';

const origin: LatLng = { lat: 32.1, lng: 34.8 };
const destination: LatLng = { lat: 32.2, lng: 34.9 };
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

let latestRouteContext: any;
let latestEmergencyContext: any;
let latestShelterContext: any;

const mockSearchRoute = vi.fn();
const mockSelectRoute = vi.fn();
const mockFilterByRoute = vi.fn();
const mockGetRoutesWithShelters = vi.fn(() => []);
const mockGetLocation = vi.fn();
const mockFindNearest = vi.fn();
const mockClearNearest = vi.fn();
const mockTrackEmergency = vi.fn();
const mockPlayAlertSound = vi.fn();
const mockStopAlertSound = vi.fn();
const mockDismissAlert = vi.fn();
const mockStartNavigation = vi.fn(() => Promise.resolve());
const mockStopNavigation = vi.fn();

let mockGoogleMapsState: { isLoaded: boolean; error: string | null };
let mockRouteState: any;
let mockShelterState: any;
let mockLocationState: any;
let mockNearestState: any;
let mockOrefState: any;
let mockAlertHistoryState: any;
let mockNavigationState: any;

vi.mock('../i18n', () => ({
  useLanguage: () => ({
    language: 'en' as const,
    t: (key: string) => key,
  }),
}));

vi.mock('../theme', () => ({
  useTheme: () => ({
    theme: 'light',
  }),
}));

vi.mock('../components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../components/Onboarding', () => ({
  Onboarding: ({ onComplete }: { onComplete: () => void }) => (
    <button onClick={onComplete}>complete-onboarding</button>
  ),
}));

vi.mock('../components/AppHeader', () => ({
  AppHeader: () => <div>header</div>,
}));

vi.mock('../components/OfflineIndicator', () => ({
  OfflineIndicator: () => <div>offline-indicator</div>,
}));

vi.mock('../components/FamilySafety', () => ({
  FamilySafety: () => <div>family-safety</div>,
}));

vi.mock('../components/SafetyDashboard', () => ({
  SafetyDashboard: () => <div>safety-dashboard</div>,
}));

vi.mock('../components/AlertBanner', () => ({
  AlertBanner: ({ onFindShelter }: { onFindShelter: () => void }) => (
    <button onClick={onFindShelter}>alert-find-shelter</button>
  ),
}));

vi.mock('../components/EmergencyButton', () => ({
  EmergencyButton: ({ onClick }: { onClick: () => void }) => (
    <button onClick={onClick}>emergency-button</button>
  ),
}));

vi.mock('../components/NavigationPanel', () => ({
  NavigationPanel: ({ onCancel }: { onCancel: () => void }) => (
    <button onClick={onCancel}>cancel-navigation</button>
  ),
}));

vi.mock('../components/MapView', () => ({
  MapView: () => <div>map-view</div>,
}));

vi.mock('../components/SearchPanel', () => ({
  SearchPanel: ({ panelExpanded }: { panelExpanded?: boolean }) => (
    <div>
      <div data-testid="panel-expanded">{String(panelExpanded)}</div>
      <div data-testid="emergency-mode">{String(latestEmergencyContext.emergencyMode)}</div>
      <div data-testid="near-me-mode">{String(latestEmergencyContext.nearMeMode)}</div>
      <div data-testid="route-info">{latestRouteContext.routeInfo ? 'route' : 'none'}</div>
      <div data-testid="nearby-count">{String(latestRouteContext.nearbyShelters.length)}</div>
      <button onClick={() => latestRouteContext.onSearch(origin, destination, 'WALKING')}>
        search-route
      </button>
      <button onClick={() => latestEmergencyContext.onNearMeClick()}>near-me</button>
      <button onClick={() => latestShelterContext.onNavigateToShelter?.(mockShelter)}>
        navigate-shelter
      </button>
    </div>
  ),
}));

vi.mock('../hooks/useGoogleMaps', () => ({
  useGoogleMaps: () => mockGoogleMapsState,
}));

vi.mock('../hooks/useRoute', () => ({
  useRoute: () => mockRouteState,
}));

vi.mock('../hooks/useShelters', () => ({
  useShelters: () => mockShelterState,
}));

vi.mock('../hooks/useCurrentLocation', () => ({
  useCurrentLocation: () => mockLocationState,
}));

vi.mock('../hooks/useNearestShelters', () => ({
  useNearestShelters: () => mockNearestState,
}));

vi.mock('../hooks/useCapacity', () => ({
  useCapacity: () => new Map(),
}));

vi.mock('../hooks/useOrefAlerts', () => ({
  useOrefAlerts: () => mockOrefState,
}));

vi.mock('../hooks/useAlertHistory', () => ({
  useAlertHistory: () => mockAlertHistoryState,
}));

vi.mock('../hooks/useNavigation', () => ({
  useNavigation: () => mockNavigationState,
}));

vi.mock('../utils/alertSound', () => ({
  playAlertSound: () => mockPlayAlertSound(),
  stopAlertSound: () => mockStopAlertSound(),
}));

vi.mock('../services/safetyAnalyticsService', () => ({
  trackRouteSearch: vi.fn(),
  trackEmergency: () => mockTrackEmergency(),
}));

vi.mock('../contexts/RouteContext', () => ({
  RouteProvider: ({ value, children }: { value: unknown; children: React.ReactNode }) => {
    latestRouteContext = value;
    return <>{children}</>;
  },
}));

vi.mock('../contexts/EmergencyContext', () => ({
  EmergencyProvider: ({ value, children }: { value: unknown; children: React.ReactNode }) => {
    latestEmergencyContext = value;
    return <>{children}</>;
  },
}));

vi.mock('../contexts/ShelterContext', () => ({
  ShelterProvider: ({ value, children }: { value: unknown; children: React.ReactNode }) => {
    latestShelterContext = value;
    return <>{children}</>;
  },
}));

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('shelter-route:onboarding-completed', 'true');
    latestRouteContext = undefined;
    latestEmergencyContext = undefined;
    latestShelterContext = undefined;

    mockGoogleMapsState = { isLoaded: true, error: null };
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
      allShelters: [{ id: 'base-shelter' }],
      nearbyShelters: [mockShelter],
      isLoading: false,
      filterByRoute: mockFilterByRoute,
      getRoutesWithShelters: mockGetRoutesWithShelters,
    };
    mockLocationState = {
      location: null,
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

  it('enters emergency mode when an alert activates', async () => {
    mockOrefState = {
      ...mockOrefState,
      isAlertActive: true,
      matchedRegion: { name: 'Tel Aviv' },
      countdown: 15,
    };

    render(<App />);

    await waitFor(() => {
      expect(mockGetLocation).toHaveBeenCalledTimes(1);
    });

    expect(mockPlayAlertSound).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('emergency-mode')).toHaveTextContent('true');
    expect(screen.getByTestId('panel-expanded')).toHaveTextContent('false');
    expect(screen.getByTestId('route-info')).toHaveTextContent('none');
    expect(screen.getByTestId('nearby-count')).toHaveTextContent('1');
  });

  it('resets emergency and near-me modes before a new route search', async () => {
    render(<App />);

    fireEvent.click(screen.getByText('emergency-button'));
    expect(screen.getByTestId('emergency-mode')).toHaveTextContent('true');

    fireEvent.click(screen.getByText('near-me'));
    expect(screen.getByTestId('near-me-mode')).toHaveTextContent('true');
    expect(screen.getByTestId('emergency-mode')).toHaveTextContent('false');

    fireEvent.click(screen.getByText('search-route'));

    await waitFor(() => {
      expect(mockSearchRoute).toHaveBeenCalledWith(origin, destination, 'WALKING');
    });

    expect(mockClearNearest).toHaveBeenCalled();
    expect(screen.getByTestId('emergency-mode')).toHaveTextContent('false');
    expect(screen.getByTestId('near-me-mode')).toHaveTextContent('false');
    expect(screen.getByTestId('panel-expanded')).toHaveTextContent('false');
  });

  it('defers shelter navigation until location becomes available', async () => {
    const view = render(<App />);

    fireEvent.click(screen.getByText('navigate-shelter'));

    expect(mockGetLocation).toHaveBeenCalledTimes(1);
    expect(mockStartNavigation).not.toHaveBeenCalled();

    mockLocationState = {
      ...mockLocationState,
      location: { lat: 32.12, lng: 34.82 },
    };

    view.rerender(<App />);

    await waitFor(() => {
      expect(mockStartNavigation).toHaveBeenCalledWith(
        mockShelter,
        { lat: 32.12, lng: 34.82 },
        expect.any(Function)
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('panel-expanded')).toHaveTextContent('false');
    });
  });
});

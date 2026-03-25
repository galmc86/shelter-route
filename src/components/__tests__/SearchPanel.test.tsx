import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SearchPanel } from '../SearchPanel';
import type { SavedLocation } from '../../hooks/useSavedLocations';

const mockOnNearMeClick = vi.fn();
const mockOnGetLocation = vi.fn();
const mockOnEmergencyClick = vi.fn();
const mockOnExitEmergency = vi.fn();
const mockSaveRoutePreset = vi.fn();
let mockIsOnline = true;
let mockShelterDataStatus = {
  loaded: true,
  fromCache: false,
  progress: 1,
  dataAgeDays: 0,
  isStale: false,
};

const mockRouteState = {
  routeInfo: null as unknown,
  selectedRouteIndex: 0,
  routesWithShelters: [] as Array<{
    route: { distance: string; duration: string; isFastest?: boolean };
    shelterCount: number;
  }>,
  nearbyShelters: [] as Array<{
    id: string;
    name: string;
    lat: number;
    lon: number;
    walkingTimeMinutes: number;
  }>,
  sheltersLoading: false,
  searchError: null as string | null,
  isSearching: false,
  onSearch: vi.fn(),
  onRouteSelect: vi.fn(),
  shareOrigin: null,
  shareDestination: null,
  shareTravelMode: 'WALKING',
  routeRisk: null,
  timeFilter: 1,
  onTimeFilterChange: vi.fn(),
};

const mockEmergencyState = {
  emergencyMode: false,
  onEmergencyClick: mockOnEmergencyClick,
  onExitEmergency: mockOnExitEmergency,
  currentLocation: { lat: 32.1, lng: 34.8 },
  lastKnownLocation: { lat: 31.9, lng: 34.7 },
  activeLookupLocation: null as { lat: number; lng: number } | null,
  activeLookupLabel: null as string | null,
  isLoadingLocation: false,
  locationError: null as string | null,
  onGetLocation: mockOnGetLocation,
  onSearchFromSavedLocation: vi.fn(),
  onUseLastKnownLocation: vi.fn(),
  nearMeMode: false,
  onNearMeClick: mockOnNearMeClick,
  onExitNearMe: vi.fn(),
  onUseMapCenter: vi.fn(),
};

const mockSavedLocationsState = {
  locations: [{ id: 'saved-1', name: 'Home', label: 'home', lat: 32.1, lng: 34.8 }] as SavedLocation[],
  addLocation: vi.fn(),
  removeLocation: vi.fn(),
  markLocationUsed: vi.fn(),
  saveRoutePreset: mockSaveRoutePreset,
  isMaxReached: false,
};

const mockRoutePlannerState = {
  originText: '',
  setOriginText: vi.fn(),
  destText: '',
  setDestText: vi.fn(),
  originPlace: null as { lat: number; lng: number; displayName: string } | null,
  setOriginPlace: vi.fn(),
  destPlace: null as { lat: number; lng: number; displayName: string } | null,
  setDestPlace: vi.fn(),
  travelMode: 'WALKING' as const,
  setTravelMode: vi.fn(),
  useMyLocation: false,
  setUseMyLocation: vi.fn(),
  showCopiedToast: false,
  currentOrigin: null as { lat: number; lng: number } | null,
  currentDestination: null as { lat: number; lng: number } | null,
  handleShare: vi.fn(),
  handleUseCurrentLocation: vi.fn(),
  handleSearch: vi.fn(),
  handleHistorySelect: vi.fn(),
  prefillOriginFromSavedLocation: vi.fn(),
  startSavedLocationRoute: vi.fn(),
};

vi.mock('../../i18n', () => ({
  useLanguage: () => ({
    language: 'en' as const,
    t: (key: string) => key,
  }),
}));

vi.mock('../../hooks/useSearchHistory', () => ({
  useSearchHistory: () => ({
    entries: [{ id: '1' }],
    addEntry: vi.fn(),
    removeEntry: vi.fn(),
    clearAll: vi.fn(),
    togglePin: vi.fn(),
    renameEntry: vi.fn(),
    updateShelterCount: vi.fn(),
    saveRoute: vi.fn(),
    unsaveRoute: vi.fn(),
  }),
}));

vi.mock('../../hooks/useSavedLocations', () => ({
  useSavedLocations: () => mockSavedLocationsState,
}));

vi.mock('../../contexts/RouteContext', () => ({
  useRouteContext: () => mockRouteState,
}));

vi.mock('../../contexts/EmergencyContext', () => ({
  useEmergencyContext: () => mockEmergencyState,
}));

vi.mock('../../contexts/ShelterContext', () => ({
  useShelterContext: () => ({
    selectedShelterId: null,
    onShelterClick: vi.fn(),
    capacityMap: new Map(),
    isLoaded: true,
    allShelters: [],
  }),
}));

vi.mock('../../hooks/useSearchPanelSheet', () => ({
  useSearchPanelSheet: () => ({
    panelRef: { current: null },
    handleTouchStart: vi.fn(),
    handleTouchMove: vi.fn(),
    handleTouchEnd: vi.fn(),
    handleHandleClick: vi.fn(),
  }),
}));

vi.mock('../../hooks/useSearchPanelRoutePlanner', () => ({
  useSearchPanelRoutePlanner: () => mockRoutePlannerState,
}));

vi.mock('../../hooks/useSearchPanelShelters', () => ({
  useSearchPanelShelters: () => ({
    sortMode: 'distance',
    setSortMode: vi.fn(),
    showAccessibleOnly: false,
    setShowAccessibleOnly: vi.fn(),
    displayedShelters: mockRouteState.nearbyShelters,
    bestRouteIndex: 0,
    currentRouteEntry: null,
    isRouteSaved: false,
    handleSaveRoute: vi.fn(),
    handleUnsaveRoute: vi.fn(),
  }),
}));

vi.mock('../../hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => mockIsOnline,
}));

vi.mock('../../hooks/useShelterDataStatus', () => ({
  useShelterDataStatus: () => mockShelterDataStatus,
}));

vi.mock('../LocationInput', () => ({
  LocationInput: () => <div>location-input</div>,
}));

vi.mock('../TravelModeSelector', () => ({
  TravelModeSelector: () => <div>travel-mode-selector</div>,
}));

vi.mock('../SearchHistory', () => ({
  SearchHistory: () => <div>search-history</div>,
}));

vi.mock('../SavedLocations', () => ({
  SavedLocations: (props: {
    locations: SavedLocation[];
    onSelectLocation: (location: SavedLocation) => void;
    onStartRouteFromLocation: (location: SavedLocation) => void;
  }) => (
    <div>
      <div>saved-locations</div>
      <button type="button" onClick={() => props.onSelectLocation(props.locations[0])}>select-saved-location</button>
      <button type="button" onClick={() => props.onStartRouteFromLocation(props.locations[0])}>start-route-from-saved</button>
    </div>
  ),
}));

vi.mock('../ShelterScore', () => ({
  ShelterScore: () => <div>shelter-score</div>,
}));

vi.mock('../RouteSummary', () => ({
  RouteSummary: () => <div>route-summary</div>,
}));

vi.mock('../ShelterResults', () => ({
  ShelterResults: () => <div>shelter-results</div>,
}));

describe('SearchPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRouteState.routeInfo = null;
    mockRouteState.routesWithShelters = [];
    mockRouteState.nearbyShelters = [];
    mockRouteState.searchError = null;
    mockEmergencyState.emergencyMode = false;
    mockEmergencyState.nearMeMode = false;
    mockEmergencyState.locationError = null;
    mockEmergencyState.isLoadingLocation = false;
    mockEmergencyState.activeLookupLocation = null;
    mockEmergencyState.activeLookupLabel = null;
    mockSavedLocationsState.locations = [{ id: 'saved-1', name: 'Home', label: 'home', lat: 32.1, lng: 34.8 }];
    mockSavedLocationsState.isMaxReached = false;
    mockRoutePlannerState.originText = '';
    mockRoutePlannerState.destText = '';
    mockRoutePlannerState.originPlace = null;
    mockRoutePlannerState.destPlace = null;
    mockRoutePlannerState.currentOrigin = null;
    mockRoutePlannerState.currentDestination = null;
    mockRoutePlannerState.useMyLocation = false;
    mockRoutePlannerState.travelMode = 'WALKING';
    mockIsOnline = true;
    mockShelterDataStatus = {
      loaded: true,
      fromCache: false,
      progress: 1,
      dataAgeDays: 0,
      isStale: false,
    };
  });

  it('defaults to the route mode surface', () => {
    render(<SearchPanel panelExpanded={true} onTogglePanel={vi.fn()} />);

    expect(screen.getByRole('tab', { name: 'search.mode.route' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('search.sectionRoute')).toBeInTheDocument();
    expect(screen.getAllByText('location-input')).toHaveLength(2);
    expect(screen.getByText('travel-mode-selector')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'search.button.ariaDisabled' })).toBeInTheDocument();
    expect(screen.getByText('search-history')).toBeInTheDocument();
    expect(screen.queryByText('saved-locations')).not.toBeInTheDocument();
  });

  it('switches to nearby mode and exposes nearby actions', () => {
    render(<SearchPanel panelExpanded={true} onTogglePanel={vi.fn()} />);

    fireEvent.click(screen.getByRole('tab', { name: 'search.mode.nearby' }));

    expect(screen.getByRole('tab', { name: 'search.mode.nearby' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('saved-locations')).toBeInTheDocument();
    expect(screen.queryByText('search-history')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'search.sheltersNearMe' }));
    fireEvent.click(screen.getByRole('button', { name: 'location.useMyLocation' }));

    expect(mockOnNearMeClick).toHaveBeenCalledTimes(1);
    expect(mockOnGetLocation).toHaveBeenCalledTimes(1);
  });

  it('switches back to route mode when starting a route from a saved location', () => {
    render(<SearchPanel panelExpanded={true} onTogglePanel={vi.fn()} />);

    fireEvent.click(screen.getByRole('tab', { name: 'search.mode.nearby' }));
    fireEvent.click(screen.getByRole('button', { name: 'start-route-from-saved' }));

    expect(screen.getByRole('tab', { name: 'search.mode.route' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByText('saved-locations')).not.toBeInTheDocument();
    expect(mockRoutePlannerState.prefillOriginFromSavedLocation).toHaveBeenCalledWith({ lat: 32.1, lng: 34.8 }, 'Home');
  });

  it('starts a saved preset route immediately when the profile has one', () => {
    mockSavedLocationsState.locations = [
      {
        id: 'saved-1',
        name: 'Home',
        label: 'home',
        lat: 32.1,
        lng: 34.8,
        routePreset: {
          destination: { lat: 32.2, lng: 34.9 },
          destinationName: 'Safe Room',
          travelMode: 'WALKING',
          savedAt: 1_710_000_000_000,
        },
      },
    ];

    render(<SearchPanel panelExpanded={true} onTogglePanel={vi.fn()} />);

    fireEvent.click(screen.getByRole('tab', { name: 'search.mode.nearby' }));
    fireEvent.click(screen.getByRole('button', { name: 'start-route-from-saved' }));

    expect(mockRoutePlannerState.startSavedLocationRoute).toHaveBeenCalledWith({
      origin: { lat: 32.1, lng: 34.8 },
      originName: 'Home',
      destination: { lat: 32.2, lng: 34.9 },
      destinationName: 'Safe Room',
      travelMode: 'WALKING',
    });
  });

  it('stores a route preset when searching from a saved profile origin', () => {
    mockRoutePlannerState.originPlace = { lat: 32.1, lng: 34.8, displayName: 'Home' };
    mockRoutePlannerState.destPlace = { lat: 32.22, lng: 34.91, displayName: 'Safe Room' };
    mockRoutePlannerState.currentOrigin = { lat: 32.1, lng: 34.8 };
    mockRoutePlannerState.currentDestination = { lat: 32.22, lng: 34.91 };

    render(<SearchPanel panelExpanded={true} onTogglePanel={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'search.button.ariaEnabled' }));

    expect(mockSaveRoutePreset).toHaveBeenCalledWith('saved-1', {
      destination: { lat: 32.22, lng: 34.91 },
      destinationName: 'Safe Room',
      travelMode: 'WALKING',
      savedAt: expect.any(Number),
    });
    expect(mockRoutePlannerState.handleSearch).toHaveBeenCalledTimes(1);
  });

  it('renders emergency as a dedicated mode and hides route-specific surfaces', () => {
    mockEmergencyState.emergencyMode = true;
    mockRouteState.routeInfo = { distance: '1 km' };
    mockRouteState.routesWithShelters = [
      { route: { distance: '1 km', duration: '10 min' }, shelterCount: 2 },
      { route: { distance: '1.2 km', duration: '11 min' }, shelterCount: 3 },
    ];
    mockRouteState.nearbyShelters = [
      { id: 's1', name: 'Shelter One', lat: 32.1, lon: 34.8, walkingTimeMinutes: 2 },
    ];

    render(<SearchPanel panelExpanded={true} onTogglePanel={vi.fn()} />);

    expect(screen.getByText('emergency.findShelter')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'emergency.exitAriaLabel' })).toBeInTheDocument();
    expect(screen.queryByRole('tablist', { name: 'search.modeSwitcher' })).not.toBeInTheDocument();
    expect(screen.queryByText('route-summary')).not.toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: 'routes.selectRoute' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'emergency.navigateNow - Shelter One' })).toBeInTheDocument();
  });

  it('surfaces offline and stale-data guidance inside emergency mode', () => {
    mockEmergencyState.emergencyMode = true;
    mockRouteState.nearbyShelters = [
      { id: 's1', name: 'Shelter One', lat: 32.1, lon: 34.8, walkingTimeMinutes: 2 },
    ];
    mockIsOnline = false;
    mockShelterDataStatus = {
      ...mockShelterDataStatus,
      fromCache: true,
      isStale: true,
    };

    render(<SearchPanel panelExpanded={true} onTogglePanel={vi.fn()} />);

    expect(screen.getByText('emergency.offlineStaleDataNotice')).toBeInTheDocument();
  });

  it('offers last-known-location fallback in emergency mode when live geolocation fails', () => {
    mockEmergencyState.emergencyMode = true;
    mockEmergencyState.locationError = 'error.locationUnavailable';

    render(<SearchPanel panelExpanded={true} onTogglePanel={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'emergency.useLastKnownLocation' }));

    expect(mockEmergencyState.onUseLastKnownLocation).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'emergency.useMapCenter' })).toBeInTheDocument();
  });

  it('shows cached-data confidence chips in nearby results mode', () => {
    mockEmergencyState.nearMeMode = true;
    mockEmergencyState.activeLookupLabel = 'Home';
    mockRouteState.nearbyShelters = [
      { id: 's1', name: 'Shelter One', lat: 32.1, lon: 34.8, walkingTimeMinutes: 2 },
    ];
    mockShelterDataStatus = {
      ...mockShelterDataStatus,
      fromCache: true,
      isStale: true,
    };

    render(<SearchPanel panelExpanded={true} onTogglePanel={vi.fn()} />);

    expect(screen.getByText('search.context.cachedData')).toBeInTheDocument();
    expect(screen.getByText('search.context.dataStale')).toBeInTheDocument();
  });

  it('renders route alternatives and lets the user switch between them', () => {
    mockRouteState.routeInfo = { distance: '800 m', duration: '10 min' };
    mockRouteState.routesWithShelters = [
      { route: { distance: '800 m', duration: '10 min', isFastest: true }, shelterCount: 2 },
      { route: { distance: '1 km', duration: '13 min' }, shelterCount: 4 },
      { route: { distance: '1.2 km', duration: '15 min' }, shelterCount: 1 },
    ];

    render(<SearchPanel panelExpanded={true} onTogglePanel={vi.fn()} />);

    const routeOptions = screen.getAllByRole('radio');
    expect(routeOptions).toHaveLength(3);
    expect(screen.getByText('routes.alternativeRoutes')).toBeInTheDocument();
    expect(screen.getByText('routes.fastest')).toBeInTheDocument();
    expect(screen.getByText('routes.mostShelters')).toBeInTheDocument();

    fireEvent.click(routeOptions[1]);

    expect(mockRouteState.onRouteSelect).toHaveBeenCalledWith(1);
  });
});

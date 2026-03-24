import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SearchPanel } from '../SearchPanel';

const mockOnNearMeClick = vi.fn();
const mockOnGetLocation = vi.fn();
const mockOnEmergencyClick = vi.fn();
const mockOnExitEmergency = vi.fn();

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
  activeLookupLocation: null as { lat: number; lng: number } | null,
  activeLookupLabel: null as string | null,
  isLoadingLocation: false,
  locationError: null as string | null,
  onGetLocation: mockOnGetLocation,
  onSearchFromSavedLocation: vi.fn(),
  nearMeMode: false,
  onNearMeClick: mockOnNearMeClick,
  onExitNearMe: vi.fn(),
  onUseMapCenter: vi.fn(),
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
  useSavedLocations: () => ({
    locations: [{ id: 'saved-1', name: 'Home', label: 'home', lat: 32.1, lng: 34.8 }],
    addLocation: vi.fn(),
    removeLocation: vi.fn(),
    isMaxReached: false,
  }),
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
  useSearchPanelRoutePlanner: () => ({
    originText: '',
    setOriginText: vi.fn(),
    destText: '',
    setDestText: vi.fn(),
    originPlace: null,
    setOriginPlace: vi.fn(),
    destPlace: null,
    setDestPlace: vi.fn(),
    travelMode: 'WALKING',
    setTravelMode: vi.fn(),
    useMyLocation: false,
    setUseMyLocation: vi.fn(),
    showCopiedToast: false,
    currentOrigin: null,
    currentDestination: null,
    handleShare: vi.fn(),
    handleUseCurrentLocation: vi.fn(),
    handleSearch: vi.fn(),
    handleHistorySelect: vi.fn(),
  }),
}));

vi.mock('../../hooks/useSearchPanelShelters', () => ({
  useSearchPanelShelters: () => ({
    sortMode: 'distance',
    setSortMode: vi.fn(),
    showAccessibleOnly: false,
    setShowAccessibleOnly: vi.fn(),
    displayedShelters: [],
    bestRouteIndex: 0,
    currentRouteEntry: null,
    isRouteSaved: false,
    handleSaveRoute: vi.fn(),
    handleUnsaveRoute: vi.fn(),
  }),
}));

vi.mock('../../hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => true,
}));

vi.mock('../../services/shelterApi', () => ({
  isShelterDataStale: () => false,
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
  SavedLocations: () => <div>saved-locations</div>,
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
});

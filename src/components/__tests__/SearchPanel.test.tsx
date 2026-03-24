import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SearchPanel } from '../SearchPanel';

const mockOnNearMeClick = vi.fn();
const mockOnGetLocation = vi.fn();

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
  useRouteContext: () => ({
    routeInfo: null,
    selectedRouteIndex: 0,
    routesWithShelters: [],
    nearbyShelters: [],
    sheltersLoading: false,
    searchError: null,
    isSearching: false,
    onSearch: vi.fn(),
    onRouteSelect: vi.fn(),
    shareOrigin: null,
    shareDestination: null,
    shareTravelMode: 'WALKING',
    routeRisk: null,
    timeFilter: 1,
    onTimeFilterChange: vi.fn(),
  }),
}));

vi.mock('../../contexts/EmergencyContext', () => ({
  useEmergencyContext: () => ({
    emergencyMode: false,
    onEmergencyClick: vi.fn(),
    onExitEmergency: vi.fn(),
    currentLocation: { lat: 32.1, lng: 34.8 },
    activeLookupLocation: null,
    activeLookupLabel: null,
    isLoadingLocation: false,
    locationError: null,
    onGetLocation: mockOnGetLocation,
    onSearchFromSavedLocation: vi.fn(),
    nearMeMode: false,
    onNearMeClick: mockOnNearMeClick,
    onExitNearMe: vi.fn(),
    onUseMapCenter: vi.fn(),
  }),
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
});

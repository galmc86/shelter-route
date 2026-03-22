import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Onboarding } from './components/Onboarding';

function isOnboardingCompleted(): boolean {
  try {
    return localStorage.getItem('shelter-route:onboarding-completed') === 'true';
  } catch {
    return false;
  }
}
import { AppHeader } from './components/AppHeader';
import { SearchPanel } from './components/SearchPanel';
import { MapView } from './components/MapView';
import { EmergencyButton } from './components/EmergencyButton';

import { FamilySafety } from './components/FamilySafety';
import { SafetyDashboard } from './components/SafetyDashboard';
import { OfflineIndicator } from './components/OfflineIndicator';
import { useGoogleMaps } from './hooks/useGoogleMaps';
import { useRoute } from './hooks/useRoute';
import { useShelters } from './hooks/useShelters';
import { useCurrentLocation } from './hooks/useCurrentLocation';
import { useNearestShelters } from './hooks/useNearestShelters';
import { useCapacity } from './hooks/useCapacity';
import { useOrefAlerts } from './hooks/useOrefAlerts';
import { useAlertHistory } from './hooks/useAlertHistory';
import { useNavigation } from './hooks/useNavigation';
import { AlertBanner } from './components/AlertBanner';
import { playAlertSound, stopAlertSound } from './utils/alertSound';
import { trackRouteSearch, trackEmergency } from './services/safetyAnalyticsService';
import { NavigationPanel } from './components/NavigationPanel';
import { useLanguage } from './i18n';
import { useTheme } from './theme';
import { RouteProvider } from './contexts/RouteContext';
import { EmergencyProvider } from './contexts/EmergencyContext';
import { ShelterProvider } from './contexts/ShelterContext';
import type { TravelMode, LatLng, RouteWithShelters } from './types';
import type { ShelterWithDistance } from './hooks/useShelters';
import type { RouteContextValue } from './contexts/RouteContext';
import type { EmergencyContextValue } from './contexts/EmergencyContext';
import type { ShelterContextValue } from './contexts/ShelterContext';
import type L from 'leaflet';
import './App.css';


function App() {
  const { language, t } = useLanguage();
  const { theme } = useTheme();
  const [selectedShelterId, setSelectedShelterId] = useState<string | null>(null);
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [panelExpanded, setPanelExpanded] = useState(true);
  const { isLoaded, error: mapsError } = useGoogleMaps();
  const { routes, selectedRouteIndex, selectedRoute, selectRoute, isLoading: isRouteLoading, error: routeError, searchRoute } = useRoute();
  const { allShelters, nearbyShelters, isLoading: sheltersLoading, filterByRoute, getRoutesWithShelters } = useShelters();
  const { location: currentLocation, isLoading: isLoadingLocation, error: locationError, getLocation } = useCurrentLocation(emergencyMode);
  const { nearestShelters, isSearching: isEmergencySearching, findNearest, clear: clearNearest } = useNearestShelters();
  const capacityMap = useCapacity(allShelters);
  const {
    isAlertActive,
    matchedRegion,
    countdown,
    dismissAlert: dismissAlertBase,
  } = useOrefAlerts(
    currentLocation?.lat ?? null,
    currentLocation?.lng ?? null
  );

  const prevAlertActive = useRef(false);
  const vibrationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);

  const dismissAlert = useCallback(() => {
    dismissAlertBase();
    stopAlertSound();
    if (vibrationInterval.current) {
      clearInterval(vibrationInterval.current);
      vibrationInterval.current = null;
    }
    if (navigator.vibrate) {
      navigator.vibrate(0);
    }
  }, [dismissAlertBase]);
  const {
    routeRisk,
    timeFilter,
    setTimeFilter,
  } = useAlertHistory(selectedRoute);
  const {
    navigationRoute: navHookRoute,
    targetShelter,
    isNavigating,
    isLoadingNav,
    navError,
    startNavigation,
    stopNavigation,
  } = useNavigation();
  const pendingNavShelterRef = useRef<ShelterWithDistance | null>(null);
  const [shareOrigin, setShareOrigin] = useState<LatLng | null>(null);
  const [shareDestination, setShareDestination] = useState<LatLng | null>(null);
  const [shareTravelMode, setShareTravelMode] = useState<TravelMode>('WALKING');
  const [showOnboarding, setShowOnboarding] = useState(() => !isOnboardingCompleted());
  const [nearMeMode, setNearMeMode] = useState(false);
  const [familyGroupCode, setFamilyGroupCode] = useState<string | null>(null);

  // Compute routes with shelter counts
  const routesWithShelters: RouteWithShelters[] = useMemo(() => {
    if (routes.length === 0) return [];
    return getRoutesWithShelters(routes);
  }, [routes, getRoutesWithShelters]);

  // Parse URL params on mount for shared routes and family group
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Parse family group code from URL
    const familyCode = params.get('familyGroup');
    if (familyCode && /^[A-Z0-9]{6}$/i.test(familyCode)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- initializing from URL params on mount
      setFamilyGroupCode(familyCode.toUpperCase());
    }

    const from = params.get('from');
    const to = params.get('to');
    const mode = params.get('mode') as TravelMode | null;

    if (from && to) {
      const [fromLat, fromLng] = from.split(',').map(Number);
      const [toLat, toLng] = to.split(',').map(Number);

      if (!isNaN(fromLat) && !isNaN(fromLng) && !isNaN(toLat) && !isNaN(toLng)) {
        // Validate coordinates are within Israel bounds
        const isValidLat = (lat: number) => lat >= 29.0 && lat <= 34.0;
        const isValidLng = (lng: number) => lng >= 34.0 && lng <= 36.5;

        if (!isValidLat(fromLat) || !isValidLng(fromLng) || !isValidLat(toLat) || !isValidLng(toLng)) {
          console.warn('Shared route URL contains coordinates outside Israel bounds, ignoring:', { fromLat, fromLng, toLat, toLng });
          return;
        }

        const origin: LatLng = { lat: fromLat, lng: fromLng };
        const destination: LatLng = { lat: toLat, lng: toLng };
        const travelMode: TravelMode = (mode && ['WALKING', 'BICYCLING', 'DRIVING'].includes(mode)) ? mode : 'WALKING';

        // eslint-disable-next-line react-hooks/set-state-in-effect -- initializing from URL params on mount
        setShareOrigin(origin);
        setShareDestination(destination);
        setShareTravelMode(travelMode);

        // Auto-trigger route search
        setPanelExpanded(false);
        searchRoute(origin, destination, travelMode);

        // Clean up URL params without reload
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Track route search analytics when routes are found
  const prevRoutesLength = useRef(0);
  useEffect(() => {
    if (routesWithShelters.length > 0 && routesWithShelters.length !== prevRoutesLength.current) {
      // Track the selected route's shelter count
      const shelterCount = routesWithShelters[selectedRouteIndex]?.shelterCount ?? 0;
      trackRouteSearch(shelterCount);
    }
    prevRoutesLength.current = routesWithShelters.length;
  }, [routesWithShelters, selectedRouteIndex]);

  // Filter shelters whenever route changes
  useEffect(() => {
    filterByRoute(selectedRoute);
  }, [selectedRoute, filterByRoute]);

  // When emergency mode or nearMe mode activates and we get location, find nearest shelters
  useEffect(() => {
    if ((emergencyMode || nearMeMode) && currentLocation && allShelters.length) {
      findNearest(allShelters, currentLocation.lat, currentLocation.lng);
    }
  }, [emergencyMode, nearMeMode, currentLocation, allShelters, findNearest]);

  // Auto-trigger emergency mode when OREF alert activates in user's area
  useEffect(() => {
    if (isAlertActive && !prevAlertActive.current) {
      // Alert just became active - trigger emergency mode
      // eslint-disable-next-line react-hooks/set-state-in-effect -- responding to external alert system
      setEmergencyMode(true);
      setSelectedShelterId(null);
      setPanelExpanded(false);
      getLocation();

      // Play audible alarm (respects user silent-mode preference)
      playAlertSound();

      // Continuous vibration pattern while alert is active
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 400]);
        vibrationInterval.current = setInterval(() => {
          navigator.vibrate([200, 100, 200, 100, 400]);
        }, 1200);
      }
    }

    // Stop sound and vibration when alert is no longer active
    if (!isAlertActive && prevAlertActive.current) {
      stopAlertSound();
      if (vibrationInterval.current) {
        clearInterval(vibrationInterval.current);
        vibrationInterval.current = null;
      }
      if (navigator.vibrate) {
        navigator.vibrate(0);
      }
    }

    prevAlertActive.current = isAlertActive;
  }, [isAlertActive, getLocation]);

  const handleSearch = useCallback(
    (origin: LatLng, destination: LatLng, travelMode: TravelMode) => {
      setSelectedShelterId(null);
      setEmergencyMode(false);
      setNearMeMode(false);
      clearNearest();
      setPanelExpanded(false);
      setShareOrigin(origin);
      setShareDestination(destination);
      setShareTravelMode(travelMode);
      searchRoute(origin, destination, travelMode);
    },
    [searchRoute, clearNearest]
  );

  const handleNearMeClick = useCallback(() => {
    setNearMeMode(true);
    setEmergencyMode(false);
    setSelectedShelterId(null);
    setPanelExpanded(true);
    getLocation();
  }, [getLocation]);

  const handleShelterClick = useCallback((shelter: ShelterWithDistance) => {
    setSelectedShelterId(shelter.id);
  }, []);

  const handleEmergencyClick = useCallback(() => {
    setEmergencyMode(true);
    setNearMeMode(false);
    setSelectedShelterId(null);
    setPanelExpanded(false);
    getLocation();
    trackEmergency();
  }, [getLocation]);

  const handleExitEmergency = useCallback(() => {
    setEmergencyMode(false);
    clearNearest();
    setSelectedShelterId(null);
  }, [clearNearest]);

  const handleExitNearMe = useCallback(() => {
    setNearMeMode(false);
    clearNearest();
    setSelectedShelterId(null);
  }, [clearNearest]);

  const handleRouteSelect = useCallback((index: number) => {
    selectRoute(index);
    setSelectedShelterId(null);
  }, [selectRoute]);

  const handleMapReady = useCallback((map: L.Map) => {
    leafletMapRef.current = map;
  }, []);

  const handleUseMapCenter = useCallback(() => {
    const map = leafletMapRef.current;
    if (!map || !allShelters.length) return;
    const center = map.getCenter();
    findNearest(allShelters, center.lat, center.lng);
  }, [allShelters, findNearest]);

  const displayShelters = (emergencyMode || nearMeMode) ? nearestShelters : nearbyShelters;

  const routeContextValue: RouteContextValue = useMemo(() => ({
    routeInfo: (emergencyMode || nearMeMode) ? null : selectedRoute,
    selectedRouteIndex,
    routesWithShelters: (emergencyMode || nearMeMode) ? [] : routesWithShelters,
    nearbyShelters: displayShelters,
    sheltersLoading: sheltersLoading || isEmergencySearching,
    searchError: routeError,
    isSearching: isRouteLoading,
    onSearch: handleSearch,
    onRouteSelect: handleRouteSelect,
    shareOrigin,
    shareDestination,
    shareTravelMode,
    routeRisk: routeRisk ?? null,
    timeFilter,
    onTimeFilterChange: setTimeFilter,
  }), [
    emergencyMode, nearMeMode, selectedRoute, selectedRouteIndex,
    routesWithShelters, displayShelters, sheltersLoading, isEmergencySearching,
    routeError, isRouteLoading, handleSearch, handleRouteSelect,
    shareOrigin, shareDestination, shareTravelMode, routeRisk, timeFilter, setTimeFilter,
  ]);

  const emergencyContextValue: EmergencyContextValue = useMemo(() => ({
    emergencyMode,
    onEmergencyClick: handleEmergencyClick,
    onExitEmergency: handleExitEmergency,
    currentLocation,
    isLoadingLocation,
    locationError: locationError ?? null,
    onGetLocation: getLocation,
    nearMeMode,
    onNearMeClick: handleNearMeClick,
    onExitNearMe: handleExitNearMe,
    onUseMapCenter: handleUseMapCenter,
  }), [
    emergencyMode, handleEmergencyClick, handleExitEmergency,
    currentLocation, isLoadingLocation, locationError, getLocation,
    nearMeMode, handleNearMeClick, handleExitNearMe, handleUseMapCenter,
  ]);

  const handleNavigateToShelter = useCallback(async (shelter: ShelterWithDistance) => {
    if (!currentLocation) {
      pendingNavShelterRef.current = shelter;
      getLocation();
      return;
    }
    pendingNavShelterRef.current = null;
    await startNavigation(shelter, currentLocation, t);
    setPanelExpanded(false);
  }, [currentLocation, getLocation, startNavigation, t]);

  // Auto-navigate once location arrives for a pending shelter.
  useEffect(() => {
    if (currentLocation && pendingNavShelterRef.current) {
      const shelter = pendingNavShelterRef.current;
      pendingNavShelterRef.current = null;
      startNavigation(shelter, currentLocation, t).then(() => {
        setPanelExpanded(false);
      });
    }
  }, [currentLocation, startNavigation, t]);

  const handleCancelNavigation = useCallback(() => {
    stopNavigation();
    setPanelExpanded(true);
  }, [stopNavigation]);

  const shelterContextValue: ShelterContextValue = useMemo(() => ({
    selectedShelterId,
    onShelterClick: handleShelterClick,
    onNavigateToShelter: handleNavigateToShelter,
    capacityMap,
    isLoaded,
    allShelters,
  }), [selectedShelterId, handleShelterClick, handleNavigateToShelter, capacityMap, isLoaded, allShelters]);

  if (mapsError) {
    return (
      <ErrorBoundary>
        <div className="app" dir={language === 'en' || language === 'ru' ? 'ltr' : 'rtl'} data-theme={theme}>
          <OfflineIndicator />
          <AppHeader />
          <div className="error-screen">
            <div className="error-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="#E53935">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
            </div>
            <h2>{t('error.mapLoad')}</h2>
            <p>{t('error.mapLoadDesc')}</p>
            <code>VITE_ORS_API_KEY=your_key_here</code>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
    <RouteProvider value={routeContextValue}>
    <EmergencyProvider value={emergencyContextValue}>
    <ShelterProvider value={shelterContextValue}>
    <div className={`app${isAlertActive ? ' app-with-alert' : ''}`} dir={language === 'en' || language === 'ru' ? 'ltr' : 'rtl'} data-theme={theme}>
      {showOnboarding && (
        <Onboarding onComplete={() => setShowOnboarding(false)} />
      )}
      {isAlertActive && (
        <AlertBanner
          matchedRegion={matchedRegion}
          countdown={countdown}
          onFindShelter={handleEmergencyClick}
          onDismiss={dismissAlert}
          isAlertActive={isAlertActive}
        />
      )}
      <OfflineIndicator />
      <AppHeader />
      <main className="main-content" id="main-content">
        {!isNavigating && (
          <div className="panel-column">
            <SearchPanel
              panelExpanded={panelExpanded}
              onTogglePanel={() => setPanelExpanded((v) => !v)}
            />
            {panelExpanded && (
              <>
                <div className="family-safety-wrapper">
                  <FamilySafety initialGroupCode={familyGroupCode} />
                </div>
                <SafetyDashboard />
              </>
            )}
          </div>
        )}
        <MapView
          routes={emergencyMode ? [] : routes}
          onSelectRoute={selectRoute}
          userLocation={(emergencyMode || nearMeMode || isNavigating) ? currentLocation : null}
          onMapReady={handleMapReady}
          emergencyCountdown={isAlertActive && countdown != null ? countdown : undefined}
          navigationRoute={navHookRoute}
          navigatingToShelter={targetShelter}
          onNavigateToShelter={handleNavigateToShelter}
        />
      </main>
      {isLoadingNav && (
        <div className="navigation-loading" role="status">
          <div className="loading-spinner" aria-hidden="true" />
          <span>{t('nav.calculatingRoute')}</span>
        </div>
      )}
      {navError && !isLoadingNav && (
        <div className="navigation-error" role="alert">
          <span>{navError}</span>
          <button onClick={stopNavigation} aria-label={t('nav.cancel')}>✕</button>
        </div>
      )}
      {isNavigating && navHookRoute && targetShelter && (
        <NavigationPanel
          shelter={targetShelter}
          route={navHookRoute}
          onCancel={handleCancelNavigation}
        />
      )}
      {!isNavigating && (
        <EmergencyButton onClick={handleEmergencyClick} panelExpanded={panelExpanded} />
      )}
    </div>
    </ShelterProvider>
    </EmergencyProvider>
    </RouteProvider>
    </ErrorBoundary>
  );
}

export default App;

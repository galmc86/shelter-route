import { useEffect, useState, useCallback, useMemo } from 'react';
import { AppHeader } from './components/AppHeader';
import { SearchPanel } from './components/SearchPanel';
import { MapView } from './components/MapView';
import { EmergencyButton } from './components/EmergencyButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { useGoogleMaps } from './hooks/useGoogleMaps';
import { useRoute } from './hooks/useRoute';
import { useShelters } from './hooks/useShelters';
import { useCurrentLocation } from './hooks/useCurrentLocation';
import { useNearestShelters } from './hooks/useNearestShelters';
import { useCapacity } from './hooks/useCapacity';
import { useLanguage } from './i18n';
import { useTheme } from './theme';
import type { TravelMode, LatLng, RouteWithShelters } from './types';
import type { ShelterWithDistance } from './hooks/useShelters';
import './App.css';

function App() {
  const { language, t } = useLanguage();
  const { theme } = useTheme();
  const { isLoaded, error: mapsError } = useGoogleMaps();
  const { routes, selectedRouteIndex, selectedRoute, selectRoute, isLoading: isRouteLoading, error: routeError, searchRoute } = useRoute();
  const { allShelters, nearbyShelters, isLoading: sheltersLoading, filterByRoute, getRoutesWithShelters } = useShelters();
  const { location: currentLocation, isLoading: isLoadingLocation, error: locationError, getLocation } = useCurrentLocation();
  const { nearestShelters, isSearching: isEmergencySearching, findNearest, clear: clearNearest } = useNearestShelters();
  const capacityMap = useCapacity(allShelters);
  const [selectedShelterId, setSelectedShelterId] = useState<string | null>(null);
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [panelExpanded, setPanelExpanded] = useState(true);
  const [shareOrigin, setShareOrigin] = useState<LatLng | null>(null);
  const [shareDestination, setShareDestination] = useState<LatLng | null>(null);
  const [shareTravelMode, setShareTravelMode] = useState<TravelMode>('WALKING');

  // Compute routes with shelter counts
  const routesWithShelters: RouteWithShelters[] = useMemo(() => {
    if (routes.length === 0) return [];
    return getRoutesWithShelters(routes);
  }, [routes, getRoutesWithShelters]);

  // Parse URL params on mount for shared routes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const from = params.get('from');
    const to = params.get('to');
    const mode = params.get('mode') as TravelMode | null;

    if (from && to) {
      const [fromLat, fromLng] = from.split(',').map(Number);
      const [toLat, toLng] = to.split(',').map(Number);

      if (!isNaN(fromLat) && !isNaN(fromLng) && !isNaN(toLat) && !isNaN(toLng)) {
        const origin: LatLng = { lat: fromLat, lng: fromLng };
        const destination: LatLng = { lat: toLat, lng: toLng };
        const travelMode: TravelMode = (mode && ['WALKING', 'BICYCLING', 'DRIVING'].includes(mode)) ? mode : 'WALKING';

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

  // Filter shelters whenever route changes
  useEffect(() => {
    filterByRoute(selectedRoute);
  }, [selectedRoute, filterByRoute]);

  // When emergency mode activates and we get location, find nearest shelters
  useEffect(() => {
    if (emergencyMode && currentLocation && allShelters.length) {
      findNearest(allShelters, currentLocation.lat, currentLocation.lng);
    }
  }, [emergencyMode, currentLocation, allShelters, findNearest]);

  const handleSearch = useCallback(
    (origin: LatLng, destination: LatLng, travelMode: TravelMode) => {
      setSelectedShelterId(null);
      setEmergencyMode(false);
      clearNearest();
      setPanelExpanded(false);
      setShareOrigin(origin);
      setShareDestination(destination);
      setShareTravelMode(travelMode);
      searchRoute(origin, destination, travelMode);
    },
    [searchRoute, clearNearest]
  );

  const handleShelterClick = useCallback((shelter: ShelterWithDistance) => {
    setSelectedShelterId(shelter.id);
  }, []);

  const handleEmergencyClick = useCallback(() => {
    setEmergencyMode(true);
    setSelectedShelterId(null);
    setPanelExpanded(false);
    getLocation();
  }, [getLocation]);

  const handleExitEmergency = useCallback(() => {
    setEmergencyMode(false);
    clearNearest();
    setSelectedShelterId(null);
  }, [clearNearest]);

  const handleRouteSelect = useCallback((index: number) => {
    selectRoute(index);
    setSelectedShelterId(null);
  }, [selectRoute]);

  const displayShelters = emergencyMode ? nearestShelters : nearbyShelters;

  if (mapsError) {
    return (
      <div className="app" dir={language === 'he' ? 'rtl' : 'ltr'} data-theme={theme}>
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
    );
  }

  return (
    <div className="app" dir={language === 'he' ? 'rtl' : 'ltr'} data-theme={theme}>
      <OfflineIndicator />
      <AppHeader />
      <main className="main-content" id="main-content">
        <SearchPanel
          isLoaded={isLoaded}
          onSearch={handleSearch}
          isSearching={isRouteLoading}
          routeInfo={emergencyMode ? null : selectedRoute}
          routes={emergencyMode ? [] : routes}
          selectedRouteIndex={selectedRouteIndex}
          onSelectRoute={selectRoute}
          nearbyShelters={displayShelters}
          sheltersLoading={sheltersLoading || isEmergencySearching}
          currentLocation={currentLocation}
          isLoadingLocation={isLoadingLocation}
          onGetLocation={getLocation}
          searchError={routeError}
          locationError={locationError}
          onShelterClick={handleShelterClick}
          selectedShelterId={selectedShelterId}
          emergencyMode={emergencyMode}
          onEmergencyClick={handleEmergencyClick}
          onExitEmergency={handleExitEmergency}
          panelExpanded={panelExpanded}
          onTogglePanel={() => setPanelExpanded((v) => !v)}
          shareOrigin={shareOrigin}
          shareDestination={shareDestination}
          shareTravelMode={shareTravelMode}
          routesWithShelters={emergencyMode ? [] : routesWithShelters}
          onRouteSelect={handleRouteSelect}
          capacityMap={capacityMap}
        />
        <MapView
          isLoaded={isLoaded}
          routeInfo={emergencyMode ? null : selectedRoute}
          routes={emergencyMode ? [] : routes}
          selectedRouteIndex={selectedRouteIndex}
          onSelectRoute={selectRoute}
          shelters={displayShelters}
          onShelterClick={handleShelterClick}
          selectedShelterId={selectedShelterId}
          userLocation={emergencyMode ? currentLocation : null}
          capacityMap={capacityMap}
        />
      </main>
      <EmergencyButton onClick={handleEmergencyClick} />
    </div>
  );
}

export default App;

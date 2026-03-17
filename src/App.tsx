import { useEffect, useState, useCallback } from 'react';
import { AppHeader } from './components/AppHeader';
import { SearchPanel } from './components/SearchPanel';
import { MapView } from './components/MapView';
import { EmergencyButton } from './components/EmergencyButton';
import { useGoogleMaps } from './hooks/useGoogleMaps';
import { useRoute } from './hooks/useRoute';
import { useShelters } from './hooks/useShelters';
import { useCurrentLocation } from './hooks/useCurrentLocation';
import { useNearestShelters } from './hooks/useNearestShelters';
import { useLanguage } from './i18n';
import type { TravelMode, LatLng } from './types';
import type { ShelterWithDistance } from './hooks/useShelters';
import './App.css';

function App() {
  const { language, t } = useLanguage();
  const { isLoaded, error: mapsError } = useGoogleMaps();
  const { routeInfo, isLoading: isRouteLoading, error: routeError, searchRoute } = useRoute();
  const { allShelters, nearbyShelters, isLoading: sheltersLoading, filterByRoute } = useShelters();
  const { location: currentLocation, isLoading: isLoadingLocation, error: locationError, getLocation } = useCurrentLocation();
  const { nearestShelters, isSearching: isEmergencySearching, findNearest, clear: clearNearest } = useNearestShelters();
  const [selectedShelterId, setSelectedShelterId] = useState<string | null>(null);
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [panelExpanded, setPanelExpanded] = useState(true);

  // Filter shelters whenever route changes
  useEffect(() => {
    filterByRoute(routeInfo);
  }, [routeInfo, filterByRoute]);

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

  const displayShelters = emergencyMode ? nearestShelters : nearbyShelters;

  if (mapsError) {
    return (
      <div className="app" dir={language === 'he' ? 'rtl' : 'ltr'}>
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
    <div className="app" dir={language === 'he' ? 'rtl' : 'ltr'}>
      <AppHeader />
      <main className="main-content">
        <SearchPanel
          isLoaded={isLoaded}
          onSearch={handleSearch}
          isSearching={isRouteLoading}
          routeInfo={emergencyMode ? null : routeInfo}
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
        />
        <MapView
          isLoaded={isLoaded}
          routeInfo={emergencyMode ? null : routeInfo}
          shelters={displayShelters}
          onShelterClick={handleShelterClick}
          selectedShelterId={selectedShelterId}
          userLocation={emergencyMode ? currentLocation : null}
        />
      </main>
      <EmergencyButton onClick={handleEmergencyClick} />
    </div>
  );
}

export default App;

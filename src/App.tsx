import { AppHeader } from './components/AppHeader';
import { SearchPanel } from './components/SearchPanel';
import { MapView } from './components/MapView';
import { EmergencyButton } from './components/EmergencyButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { AlertBanner } from './components/AlertBanner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useAppController } from './hooks/useAppController';
import './App.css';

const dir = (lang: string) => (lang === 'he' ? 'rtl' : 'ltr');

function App() {
  const c = useAppController();

  if (c.mapsError) {
    return (
      <div className="app" dir={dir(c.language)} data-theme={c.theme}>
        <OfflineIndicator />
        <AppHeader />
        <div className="error-screen">
          <div className="error-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="#E53935"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
          </div>
          <h2>{c.t('error.mapLoad')}</h2>
          <p>{c.t('error.mapLoadDesc')}</p>
          <code>VITE_ORS_API_KEY=your_key_here</code>
        </div>
      </div>
    );
  }

  const em = c.emergencyMode;
  return (
    <ErrorBoundary>
      <div className={`app${c.isAlertActive ? ' app-with-alert' : ''}`} dir={dir(c.language)} data-theme={c.theme}>
        {c.isAlertActive && (
          <AlertBanner matchedRegion={c.matchedRegion} countdown={c.countdown}
            onFindShelter={c.handleEmergencyClick} onDismiss={c.dismissAlert} />
        )}
        <OfflineIndicator />
        <AppHeader />
        <main className="main-content" id="main-content">
          <ErrorBoundary>
            <SearchPanel
              isLoaded={c.isLoaded} onSearch={c.handleSearch} isSearching={c.isRouteLoading}
              routeInfo={em ? null : c.selectedRoute} selectedRouteIndex={c.selectedRouteIndex}
              nearbyShelters={c.displayShelters}
              sheltersLoading={c.sheltersLoading || c.isEmergencySearching}
              currentLocation={c.currentLocation} isLoadingLocation={c.isLoadingLocation}
              onGetLocation={c.getLocation} searchError={c.routeError} locationError={c.locationError}
              onShelterClick={c.handleShelterClick} selectedShelterId={c.selectedShelterId}
              emergencyMode={em} onEmergencyClick={c.handleEmergencyClick}
              onExitEmergency={c.handleExitEmergency}
              panelExpanded={c.panelExpanded} onTogglePanel={() => c.setPanelExpanded((v) => !v)}
              shareOrigin={c.shareOrigin} shareDestination={c.shareDestination}
              shareTravelMode={c.shareTravelMode}
              routesWithShelters={em ? [] : c.routesWithShelters} onRouteSelect={c.handleRouteSelect}
              capacityMap={c.capacityMap} routeRisk={c.routeRisk}
              timeFilter={c.timeFilter} onTimeFilterChange={c.setTimeFilter}
            />
          </ErrorBoundary>
          <ErrorBoundary>
            <MapView
              isLoaded={c.isLoaded} routeInfo={em ? null : c.selectedRoute}
              routes={em ? [] : c.routes} selectedRouteIndex={c.selectedRouteIndex}
              onSelectRoute={c.selectRoute} shelters={c.displayShelters}
              onShelterClick={c.handleShelterClick} selectedShelterId={c.selectedShelterId}
              userLocation={em ? c.currentLocation : null} capacityMap={c.capacityMap}
            />
          </ErrorBoundary>
        </main>
        <EmergencyButton onClick={c.handleEmergencyClick} panelExpanded={c.panelExpanded} />
      </div>
    </ErrorBoundary>
  );
}

export default App;

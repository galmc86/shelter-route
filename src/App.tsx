import { useEffect, useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Onboarding } from './components/Onboarding';
import { AppHeader } from './components/AppHeader';
import { SearchPanel } from './components/SearchPanel';
import { MapView } from './components/MapView';
import { EmergencyButton } from './components/EmergencyButton';
import { FamilySafety } from './components/FamilySafety';
import { SafetyDashboard } from './components/SafetyDashboard';
import { OfflineIndicator } from './components/OfflineIndicator';
import { AlertBanner } from './components/AlertBanner';
import { NavigationPanel } from './components/NavigationPanel';
import { RouteProvider } from './contexts/RouteContext';
import { EmergencyProvider } from './contexts/EmergencyContext';
import { ShelterProvider } from './contexts/ShelterContext';
import { useAppController } from './hooks/useAppController';
import './App.css';

type UtilityPanel = 'family' | 'dashboard';

function App() {
  const {
    language,
    theme,
    t,
    mapsError,
    routes,
    mapUserLocation,
    familyGroupCode,
    panelExpanded,
    showOnboarding,
    emergencyMode,
    isAlertActive,
    matchedRegion,
    countdown,
    isNavigating,
    isLoadingNav,
    navError,
    navHookRoute,
    targetShelter,
    routeContextValue,
    emergencyContextValue,
    shelterContextValue,
    handleMapReady,
    handleEmergencyClick,
    handleNavigateToShelter,
    handleCancelNavigation,
    dismissAlert,
    stopNavigation,
    completeOnboarding,
    togglePanel,
  } = useAppController();
  const [activeUtilityPanel, setActiveUtilityPanel] = useState<UtilityPanel>('family');

  useEffect(() => {
    if (emergencyMode) {
      setActiveUtilityPanel('family');
    }
  }, [emergencyMode]);

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
        <Onboarding onComplete={completeOnboarding} />
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
              onTogglePanel={togglePanel}
            />
            {panelExpanded && !emergencyMode && (
              <section className="panel-utility-area" aria-label={t('panel.toolsLabel')}>
                <div className="panel-utility-tabs" role="tablist" aria-label={t('panel.toolsLabel')}>
                  <button
                    type="button"
                    role="tab"
                    className={`panel-utility-tab ${activeUtilityPanel === 'family' ? 'active' : ''}`}
                    aria-selected={activeUtilityPanel === 'family'}
                    onClick={() => setActiveUtilityPanel('family')}
                  >
                    {t('panel.tab.family')}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    className={`panel-utility-tab ${activeUtilityPanel === 'dashboard' ? 'active' : ''}`}
                    aria-selected={activeUtilityPanel === 'dashboard'}
                    onClick={() => setActiveUtilityPanel('dashboard')}
                  >
                    {t('panel.tab.dashboard')}
                  </button>
                </div>
                <div className="panel-utility-content">
                  {activeUtilityPanel === 'family' ? (
                    <div className="family-safety-wrapper">
                      <FamilySafety initialGroupCode={familyGroupCode} />
                    </div>
                  ) : (
                    <SafetyDashboard />
                  )}
                </div>
              </section>
            )}
          </div>
        )}
        <MapView
          routes={emergencyMode ? [] : routes}
          onSelectRoute={routeContextValue.onRouteSelect}
          userLocation={mapUserLocation}
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

import { useEffect, useState, type ReactNode } from 'react';
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

type AppSection = 'search' | 'family' | 'dashboard';

const sectionIcons: Record<AppSection, ReactNode> = {
  search: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Z" stroke="currentColor" strokeWidth="2" />
      <path d="m16 16 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  family: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3Zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3Zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5Zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5Z" />
    </svg>
  ),
  dashboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3 13h6v8H3v-8Zm12-10h6v18h-6V3ZM9 8h6v13H9V8Z" />
    </svg>
  ),
};

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
  const [activeSection, setActiveSection] = useState<AppSection>('search');

  useEffect(() => {
    if (emergencyMode) {
      setActiveSection('search');
    }
  }, [emergencyMode]);

  const renderPanelContent = () => {
    switch (activeSection) {
      case 'family':
        return (
          <section className="app-section-panel" aria-label={t('app.section.family')}>
            <div className="app-section-panel-scroll">
              <FamilySafety initialGroupCode={familyGroupCode} />
            </div>
          </section>
        );
      case 'dashboard':
        return (
          <section className="app-section-panel" aria-label={t('app.section.dashboard')}>
            <div className="app-section-panel-scroll">
              <SafetyDashboard />
            </div>
          </section>
        );
      case 'search':
      default:
        return (
          <SearchPanel
            panelExpanded={panelExpanded}
            onTogglePanel={togglePanel}
          />
        );
    }
  };

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
      {!emergencyMode && (
        <nav className="app-section-nav" aria-label={t('app.sectionNav')}>
          {(['search', 'family', 'dashboard'] as AppSection[]).map((section) => (
            <button
              type="button"
              key={section}
              className={`app-section-nav-item ${activeSection === section ? 'active' : ''}`}
              aria-current={activeSection === section ? 'page' : undefined}
              onClick={() => setActiveSection(section)}
            >
              <span className="app-section-nav-icon">{sectionIcons[section]}</span>
              <span className="app-section-nav-label">{t(`app.section.${section}`)}</span>
            </button>
          ))}
        </nav>
      )}
      <main className="main-content" id="main-content">
        {!isNavigating && (
          <div className="panel-column">
            {renderPanelContent()}
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
        <EmergencyButton
          onClick={handleEmergencyClick}
          panelExpanded={activeSection === 'search' ? panelExpanded : false}
        />
      )}
    </div>
    </ShelterProvider>
    </EmergencyProvider>
    </RouteProvider>
    </ErrorBoundary>
  );
}

export default App;

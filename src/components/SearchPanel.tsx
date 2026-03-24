import { useEffect, useMemo, useState } from 'react';
import './SearchPanel.css';
import { ShelterScore } from './ShelterScore';
import { RouteSummary } from './RouteSummary';
import { ShelterResults } from './ShelterResults';
import { SearchPanelNearbyMode } from './SearchPanelNearbyMode';
import { SearchPanelRouteMode } from './SearchPanelRouteMode';
import { useLanguage } from '../i18n';
import { useSearchHistory } from '../hooks/useSearchHistory';
import { useSavedLocations } from '../hooks/useSavedLocations';
import { useRouteContext } from '../contexts/RouteContext';
import { useEmergencyContext } from '../contexts/EmergencyContext';
import { useShelterContext } from '../contexts/ShelterContext';
import { useSearchPanelSheet } from '../hooks/useSearchPanelSheet';
import { useSearchPanelRoutePlanner } from '../hooks/useSearchPanelRoutePlanner';
import { useSearchPanelShelters } from '../hooks/useSearchPanelShelters';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { isShelterDataStale } from '../services/shelterApi';

interface SearchPanelProps {
  panelExpanded?: boolean;
  onTogglePanel?: () => void;
}

type SearchSurfaceMode = 'nearby' | 'route';

export function SearchPanel({
  panelExpanded,
  onTogglePanel,

}: SearchPanelProps) {
  const {
    routeInfo,
    selectedRouteIndex,
    routesWithShelters,
    nearbyShelters,
    sheltersLoading,
    searchError,
    isSearching,
    onSearch,
    onRouteSelect,
    shareOrigin,
    shareDestination,
    shareTravelMode,
    routeRisk,
    timeFilter,
    onTimeFilterChange,
  } = useRouteContext();

  const {
    emergencyMode,
    onEmergencyClick,
    onExitEmergency,
    currentLocation,
    activeLookupLocation,
    activeLookupLabel,
    isLoadingLocation,
    locationError,
    onGetLocation,
    onNearMeClick,
    onSearchFromSavedLocation,
    nearMeMode,
    onExitNearMe,
    onUseMapCenter,
  } = useEmergencyContext();

  const {
    selectedShelterId,
    onShelterClick,
    capacityMap,
    isLoaded,
    allShelters,
  } = useShelterContext();
  const { t } = useLanguage();
  const isOnline = useOnlineStatus();
  const [showShelterScore, setShowShelterScore] = useState(false);
  const [activeSearchMode, setActiveSearchMode] = useState<SearchSurfaceMode>('route');
  const { entries: historyEntries, addEntry: addHistoryEntry, removeEntry: removeHistoryEntry, clearAll: clearHistory, togglePin: toggleHistoryPin, renameEntry: renameHistoryEntry, updateShelterCount: updateHistoryShelterCount, saveRoute: saveHistoryRoute, unsaveRoute: unsaveHistoryRoute } = useSearchHistory();
  const { locations: savedLocations, addLocation: addSavedLocation, removeLocation: removeSavedLocation, isMaxReached: savedLocationsMaxReached } = useSavedLocations();
  const {
    originText,
    setOriginText,
    destText,
    setDestText,
    originPlace,
    setOriginPlace,
    destPlace,
    setDestPlace,
    travelMode,
    setTravelMode,
    useMyLocation,
    setUseMyLocation,
    showCopiedToast,
    currentOrigin,
    currentDestination,
    handleShare,
    handleUseCurrentLocation,
    handleSearch,
    handleHistorySelect,
  } = useSearchPanelRoutePlanner({
    routeInfo,
    sheltersLoading,
    nearbyShelters,
    shareOrigin,
    shareDestination,
    shareTravelMode,
    currentLocation: currentLocation ? { lat: currentLocation.lat, lng: currentLocation.lng } : null,
    onSearch,
    onGetLocation,
    addHistoryEntry,
    updateHistoryShelterCount,
    t,
  });
  const {
    sortMode,
    setSortMode,
    showAccessibleOnly,
    setShowAccessibleOnly,
    displayedShelters,
    bestRouteIndex,
    currentRouteEntry,
    isRouteSaved,
    handleSaveRoute,
    handleUnsaveRoute,
  } = useSearchPanelShelters({
    routeInfo,
    routesWithShelters,
    selectedRouteIndex,
    nearbyShelters,
    currentOrigin,
    currentDestination,
    historyEntries,
    travelMode,
    saveHistoryRoute,
    unsaveHistoryRoute,
  });

  const canSearch = (useMyLocation && currentLocation || originPlace) && destPlace && !isSearching;
  const {
    panelRef,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleHandleClick,
  } = useSearchPanelSheet({
    panelExpanded: panelExpanded ?? false,
    onTogglePanel,
  });
  const dataStale = useMemo(() => isShelterDataStale(), []);

  const contextualChips = useMemo(() => {
    if (emergencyMode || nearMeMode) {
      return [];
    }

    const chips: string[] = [];

    if (activeSearchMode === 'nearby' && savedLocations.length > 0) {
      chips.push(t('search.context.savedPlaces').replace('{count}', String(savedLocations.length)));
    }

    if (!isOnline) {
      chips.push(t('search.context.offline'));
    }

    if (currentLocation) {
      chips.push(t('search.context.locationReady'));
    } else if (locationError) {
      chips.push(t('search.context.locationUnavailable'));
    }

    if (dataStale) {
      chips.push(t('search.context.dataStale'));
    }

    return chips.slice(0, 3);
  }, [
    activeSearchMode,
    currentLocation,
    dataStale,
    emergencyMode,
    isOnline,
    locationError,
    nearMeMode,
    savedLocations.length,
    t,
  ]);

  useEffect(() => {
    if (nearMeMode) {
      setActiveSearchMode('nearby');
      return;
    }

    if (routeInfo) {
      setActiveSearchMode('route');
    }
  }, [nearMeMode, routeInfo]);

  return (
    <aside
      ref={panelRef}
      className={`search-panel ${panelExpanded ? 'panel-expanded' : 'panel-collapsed'}`}
      role="complementary"
      aria-label={t('search.ariaLabel')}
    >
      {/* Mobile drag handle */}
      <button
        className="panel-handle"
        onClick={handleHandleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        aria-label={panelExpanded ? t('search.panelCollapse') : t('search.panelExpand')}
        aria-expanded={panelExpanded}
      >
        <div className="handle-bar" />
        <span className="handle-label">
          {panelExpanded ? t('search.showMap') : (routeInfo || nearbyShelters.length > 0) ? `${nearbyShelters.length} ${t('search.showDetails')}` : t('search.planRoute')}
        </span>
      </button>

      {/* Emergency Mode Banner */}
      {emergencyMode && (
        <div className="emergency-banner" role="alert">
          <div className="emergency-banner-content">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white" aria-hidden="true">
              <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" />
              <path d="M12 7v6M12 15v1" stroke="#D32F2F" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <div>
              <div className="emergency-banner-title">{t('emergency.bannerTitle')}</div>
              <div className="emergency-banner-subtitle">
                {isLoadingLocation
                  ? t('emergency.locating')
                  : locationError
                    ? locationError
                    : `${nearbyShelters.length} ${t('emergency.nearbyShelters')}`}
              </div>
              {locationError && !isLoadingLocation && (
                <div className="emergency-fallback">
                  <button
                    className="emergency-map-center-btn"
                    onClick={onUseMapCenter}
                  >
                    {t('emergency.useMapCenter')}
                  </button>
                  <div className="emergency-permission-hint">
                    {t('emergency.locationPermissionHint')}
                  </div>
                </div>
              )}
            </div>
          </div>
          <button className="emergency-exit-btn" onClick={onExitEmergency} aria-label={t('emergency.exitAriaLabel')}>
            {t('emergency.exit')}
          </button>
        </div>
      )}

      {/* Navigate to Nearest Shelter - One-Tap Emergency Navigation */}
      {emergencyMode && nearbyShelters.length > 0 && (() => {
        const nearest = nearbyShelters[0];
        const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${nearest.lat},${nearest.lon}&travelmode=walking`;
        return (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="emergency-navigate-now-btn"
            aria-label={`${t('emergency.navigateNow')} - ${nearest.name}`}
          >
            <span className="emergency-navigate-now-icon" aria-hidden="true">&#x27A4;</span>
            <span className="emergency-navigate-now-text">
              <span className="emergency-navigate-now-label">{t('emergency.navigateNow')}</span>
              <span className="emergency-navigate-now-detail">
                {nearest.name} &middot; {t('emergency.walkingTime')}: ~{nearest.walkingTimeMinutes} {t('capacity.minutes')}
              </span>
            </span>
          </a>
        );
      })()}

      {/* Emergency Quick Button */}
      {!emergencyMode && (
        <button className="emergency-quick-btn" onClick={onEmergencyClick} aria-label={t('emergency.findShelter')}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" fill="#D32F2F" />
            <path d="M12 7v6M12 15v1" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          {t('emergency.findShelter')}
        </button>
      )}

      {!emergencyMode && !nearMeMode && (
        <div className="search-mode-tabs" role="tablist" aria-label={t('search.modeSwitcher')}>
          <button
            type="button"
            role="tab"
            className={`search-mode-tab ${activeSearchMode === 'nearby' ? 'active' : ''}`}
            aria-selected={activeSearchMode === 'nearby'}
            onClick={() => setActiveSearchMode('nearby')}
          >
            {t('search.mode.nearby')}
          </button>
          <button
            type="button"
            role="tab"
            className={`search-mode-tab ${activeSearchMode === 'route' ? 'active' : ''}`}
            aria-selected={activeSearchMode === 'route'}
            onClick={() => setActiveSearchMode('route')}
          >
            {t('search.mode.route')}
          </button>
        </div>
      )}

      {!emergencyMode && !nearMeMode && contextualChips.length > 0 && (
        <div className="search-context-row" role="status" aria-live="polite">
          {contextualChips.map((chip) => (
            <span key={chip} className="search-context-chip">
              {chip}
            </span>
          ))}
        </div>
      )}

      {!emergencyMode && nearMeMode && (
        <div className="nearby-results-banner" role="status" aria-live="polite">
          <div className="nearby-results-banner-copy">
            <div className="nearby-results-banner-title">{t('search.sheltersNearMe')}</div>
            {activeLookupLabel && (
              <div className="nearby-results-banner-subtitle">{activeLookupLabel}</div>
            )}
            <div className="nearby-results-banner-mode">
              {activeLookupLabel ? t('search.savedPlaceMode') : t('search.myLocation')}
            </div>
          </div>
          <button
            className="nearby-results-banner-exit"
            onClick={onExitNearMe}
            aria-label={t('emergency.exit')}
          >
            {t('emergency.exit')}
          </button>
        </div>
      )}

      {/* Shelter Score Toggle - shown in nearMe mode or when shelters are loaded */}
      {(nearbyShelters.length > 0) && !emergencyMode && activeLookupLocation && allShelters.length > 0 && (
        <>
          {!showShelterScore ? (
            <button
              className="shelter-score-toggle-btn"
              onClick={() => setShowShelterScore(true)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" fill="var(--color-primary, #1565C0)" />
                <text x="12" y="16" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">A</text>
              </svg>
              {t('shelterScore.checkScore')}
            </button>
          ) : (
            <>
              <button
                className="shelter-score-toggle-btn shelter-score-toggle-btn--active"
                onClick={() => setShowShelterScore(false)}
              >
                {t('shelterScore.hideScore')}
              </button>
              <ShelterScore
                lat={activeLookupLocation.lat}
                lng={activeLookupLocation.lng}
                shelters={allShelters}
                addressName={activeLookupLabel ?? t('search.myLocation')}
              />
            </>
          )}
        </>
      )}

      {!emergencyMode && !nearMeMode && activeSearchMode === 'nearby' && (
        <SearchPanelNearbyMode
          t={t}
          isLoadingLocation={isLoadingLocation}
          currentLocation={currentLocation ? { lat: currentLocation.lat, lng: currentLocation.lng } : null}
          savedLocations={savedLocations}
          savedLocationsMaxReached={savedLocationsMaxReached}
          onNearMeClick={onNearMeClick}
          onGetLocation={onGetLocation}
          onSearchFromSavedLocation={onSearchFromSavedLocation}
          onAddSavedLocation={addSavedLocation}
          onRemoveSavedLocation={removeSavedLocation}
        />
      )}

      {/* Regular search */}
      {!emergencyMode && !nearMeMode && activeSearchMode === 'route' && (
        <SearchPanelRouteMode
          t={t}
          originText={originText}
          destText={destText}
          travelMode={travelMode}
          isLoaded={isLoaded}
          isSearching={isSearching}
          isLoadingLocation={isLoadingLocation}
          currentLocation={currentLocation}
          canSearch={Boolean(canSearch)}
          historyEntries={!routeInfo ? historyEntries : []}
          onSetOriginText={setOriginText}
          onSetDestText={setDestText}
          onSetOriginPlace={setOriginPlace}
          onSetDestPlace={setDestPlace}
          onSetTravelMode={setTravelMode}
          onSetUseMyLocation={setUseMyLocation}
          onUseCurrentLocation={handleUseCurrentLocation}
          onSearch={handleSearch}
          onHistorySelect={handleHistorySelect}
          onRemoveHistory={removeHistoryEntry}
          onClearHistory={clearHistory}
          onToggleHistoryPin={toggleHistoryPin}
          onRenameHistory={renameHistoryEntry}
        />
      )}

      {/* Errors */}
      {searchError && (
        <div className="error-message" role="alert">{searchError}</div>
      )}
      {locationError && !emergencyMode && !nearMeMode && (
        <div className="error-message" role="alert">{locationError}</div>
      )}

      {/* Route Selector — show when multiple alternatives exist (our shelter-count version) */}
      {routesWithShelters.length > 1 && (
        <>
          <div className="divider" />
          <div className="route-selector" role="radiogroup" aria-label={t('routes.selectRoute')}>
            <div className="route-selector-header">{t('routes.alternativeRoutes')}</div>
            {routesWithShelters.map((rws, idx) => {
              const isSelected = idx === selectedRouteIndex;
              const isBest = idx === bestRouteIndex;
              return (
                <button
                  key={idx}
                  className={`route-option ${isSelected ? 'route-option-selected' : ''} ${isBest ? 'route-option-best' : ''}`}
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => onRouteSelect?.(idx)}
                  aria-label={`${t('routes.route')} ${idx + 1}, ${rws.route.distance}, ${rws.route.duration}, ${rws.shelterCount} ${t('route.sheltersLabel')}`}
                >
                  <div className="route-option-header">
                    <span className="route-option-number">{t('routes.route')} {idx + 1}</span>
                    {rws.route.isFastest && (
                      <span className="route-option-fastest-badge">{t('routes.fastest')}</span>
                    )}
                    {isBest && (
                      <span className="route-option-best-badge">{t('routes.mostShelters')}</span>
                    )}
                  </div>
                  <div className="route-option-details">
                    <span className="route-option-stat">{rws.route.distance}</span>
                    <span className="route-option-separator">|</span>
                    <span className="route-option-stat">{rws.route.duration}</span>
                    <span className="route-option-separator">|</span>
                    <span className="route-option-shelters">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" />
                      </svg>
                      {rws.shelterCount} {t('route.sheltersLabel')}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Route Info */}
      {routeInfo && (
        <>
          <div className="divider" />
          <RouteSummary
            routeInfo={routeInfo}
            sheltersLoading={sheltersLoading}
            nearbySheltersCount={nearbyShelters.length}
            routeRisk={routeRisk ?? null}
            timeFilter={timeFilter}
            onTimeFilterChange={onTimeFilterChange}
            canShare={Boolean(shareOrigin && shareDestination)}
            onShare={handleShare}
            currentRouteEntry={currentRouteEntry}
            isRouteSaved={isRouteSaved}
            onSaveRoute={handleSaveRoute}
            onUnsaveRoute={handleUnsaveRoute}
          />
        </>
      )}

      {/* Copied Toast */}
      {showCopiedToast && (
        <div className="copied-toast" role="status" aria-live="polite">
          {t('share.copied')}
        </div>
      )}

      <ShelterResults
        emergencyMode={emergencyMode}
        proximityMode={nearMeMode}
        nearbyShelters={nearbyShelters}
        displayedShelters={displayedShelters}
        sheltersLoading={sheltersLoading}
        showAccessibleOnly={showAccessibleOnly}
        onShowAccessibleOnlyChange={setShowAccessibleOnly}
        sortMode={sortMode}
        onSortModeChange={setSortMode}
        selectedShelterId={selectedShelterId}
        onShelterClick={onShelterClick}
        capacityMap={capacityMap}
      />


      {/* Emergency Hotline */}
      <div className="hotline-section">
        <a href="tel:104" className="hotline-link" aria-label={t('hotline.ariaLabel')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
          </svg>
          {t('hotline.label')}
        </a>
      </div>
    </aside>
  );
}

import { useState } from 'react';
import { LocationInput } from './LocationInput';
import './SearchPanel.css';
import { TravelModeSelector } from './TravelModeSelector';
import { SearchHistory } from './SearchHistory';
import { SavedLocations } from './SavedLocations';
import { ShelterScore } from './ShelterScore';
import { useLanguage } from '../i18n';
import { useSearchHistory } from '../hooks/useSearchHistory';
import { useSavedLocations } from '../hooks/useSavedLocations';
import { useRouteContext } from '../contexts/RouteContext';
import { useEmergencyContext } from '../contexts/EmergencyContext';
import { useShelterContext } from '../contexts/ShelterContext';
import { useSearchPanelSheet } from '../hooks/useSearchPanelSheet';
import { useSearchPanelRoutePlanner } from '../hooks/useSearchPanelRoutePlanner';
import { useSearchPanelShelters } from '../hooks/useSearchPanelShelters';
import { getCapacityColor, getCapacityStatusKey } from '../services/capacityService';
import { getAggregatedStatus, getStatusBadgeColor } from '../services/shelterReportsService';

import type { TimeFilter } from '../hooks/useAlertHistory';

interface SearchPanelProps {
  panelExpanded?: boolean;
  onTogglePanel?: () => void;
}

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
    isLoadingLocation,
    locationError,
    onGetLocation,
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
  const [routePlannerExpanded, setRoutePlannerExpanded] = useState(false);
  const [showShelterScore, setShowShelterScore] = useState(false);
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
    handleSavedLocationSelect,
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

      {/* Shelter Score Toggle - shown in nearMe mode or when shelters are loaded */}
      {(nearbyShelters.length > 0) && !emergencyMode && currentLocation && allShelters.length > 0 && (
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
                lat={currentLocation.lat}
                lng={currentLocation.lng}
                shelters={allShelters}
                addressName={t('search.myLocation')}
              />
            </>
          )}
        </>
      )}

      {/* Saved Locations (hidden in emergency and nearMe mode) */}
      {!emergencyMode && (
        <SavedLocations
          locations={savedLocations}
          onSelectLocation={handleSavedLocationSelect}
          onAddLocation={addSavedLocation}
          onRemoveLocation={removeSavedLocation}
          isMaxReached={savedLocationsMaxReached}
          currentLocation={currentLocation ? { lat: currentLocation.lat, lng: currentLocation.lng } : null}
          shelters={nearbyShelters.map((s) => ({ id: s.id, name: s.name, lat: s.lat, lon: s.lon, address: s.address }))}
        />
      )}

      {/* Regular search (hidden in emergency and nearMe mode) */}
      {!emergencyMode && (
        <>
          {/* Collapsible route planner toggle */}
          <button
            className="route-planner-toggle"
            onClick={() => setRoutePlannerExpanded((v) => !v)}
            aria-expanded={routePlannerExpanded}
          >
            <svg
              className={`route-planner-toggle-chevron ${routePlannerExpanded ? 'expanded' : ''}`}
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t('search.planSafeRoute')}
          </button>

          {routePlannerExpanded && (
            <>
              <div className="panel-section">
                <div className="section-label" id="route-label">{t('search.sectionRoute')}</div>
                <div className="inputs-container" role="group" aria-labelledby="route-label">
                  <LocationInput
                    placeholder={t('search.placeholder.origin')}
                    value={originText}
                    onChange={(v) => {
                      setOriginText(v);
                      setUseMyLocation(false);
                    }}
                    onPlaceSelect={(place) => {
                      setOriginPlace(place);
                      setUseMyLocation(false);
                    }}
                    isLoaded={isLoaded}
                    icon="origin"
                    showMyLocation
                    onUseCurrentLocation={handleUseCurrentLocation}
                    isLoadingLocation={isLoadingLocation}
                    currentLocation={currentLocation}
                  />
                  <LocationInput
                    placeholder={t('search.placeholder.dest')}
                    value={destText}
                    onChange={setDestText}
                    onPlaceSelect={setDestPlace}
                    isLoaded={isLoaded}
                    icon="dest"
                  />
                </div>
              </div>

              <div className="panel-section">
                <div className="section-label" id="travel-label">{t('search.sectionTransport')}</div>
                <TravelModeSelector
                  selected={travelMode}
                  onSelect={setTravelMode}
                />
              </div>

              <div className="search-btn-wrapper">
                <button
                  className="search-btn"
                  onClick={handleSearch}
                  disabled={!canSearch}
                  title={!canSearch ? t('search.button.tooltip') : undefined}
                  aria-label={canSearch ? t('search.button.ariaEnabled') : t('search.button.ariaDisabled')}
                >
                  {isSearching ? (
                    <>
                      <span className="loading-spinner small" aria-hidden="true" />
                      {t('search.searching')}
                    </>
                  ) : (
                    <>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle cx="10.5" cy="10.5" r="7" stroke="white" strokeWidth="2.5" />
                        <path d="M16 16l5.5 5.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                      </svg>
                      {t('search.button')}
                    </>
                  )}
                </button>
                {!canSearch && (
                  <span className="search-btn-tooltip" aria-hidden="true">
                    {t('search.button.tooltip')}
                  </span>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* Search History — shown when no route is displayed */}
      {!routeInfo && !emergencyMode && historyEntries.length > 0 && (
        <SearchHistory
          entries={historyEntries}
          onSelect={handleHistorySelect}
          onRemove={removeHistoryEntry}
          onClearAll={clearHistory}
          onTogglePin={toggleHistoryPin}
          onRename={renameHistoryEntry}
        />
      )}

      {/* Errors */}
      {searchError && (
        <div className="error-message" role="alert">{searchError}</div>
      )}
      {locationError && !emergencyMode && (
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
          <div className="route-info" aria-label={t('route.details')}>
            <div className="route-info-header">{t('route.details')}</div>
            <div className="route-stats">
              <div className="stat">
                <span className="stat-icon" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#757575">
                    <circle cx="12" cy="12" r="9" stroke="#757575" strokeWidth="2" fill="none" />
                    <path d="M12 7v5l3 3" stroke="#757575" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </span>
                <div>
                  <div className="stat-value">{routeInfo.duration}</div>
                </div>
              </div>
              <div className="stat">
                <span className="stat-icon" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#757575">
                    <path d="M3 12h18M3 12l4-4M3 12l4 4M21 12l-4-4M21 12l-4 4" stroke="#757575" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </span>
                <div>
                  <div className="stat-value">{routeInfo.distance}</div>
                </div>
              </div>
            </div>
            <div className="shelter-count" aria-live="polite">
              <div className="shelter-badge" aria-label={`${sheltersLoading ? t('shelters.loading') : nearbyShelters.length} ${t('route.sheltersLabel')}`}>
                {sheltersLoading ? '...' : nearbyShelters.length}
              </div>
              <span className="shelter-count-text">{t('route.sheltersAlongRoute')}</span>
            </div>
            {/* Route Risk Badge */}
            {routeRisk && routeRisk.riskLevel !== 'none' && (
              <div
                className={`route-risk-section route-risk--${routeRisk.riskLevel}`}
                role="status"
                aria-live="polite"
                aria-label={t(`risk.${routeRisk.riskLevel}`)}
              >
                <div className="route-risk-row">
                  <div className={`route-risk-badge route-risk-badge--${routeRisk.riskLevel}`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                      {routeRisk.riskLevel === 'high' ? (
                        <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
                      ) : (
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                      )}
                    </svg>
                    <span>{t(`risk.${routeRisk.riskLevel}`)}</span>
                  </div>
                </div>
                <div className="route-risk-details">
                  <span className="route-risk-text">
                    {t('risk.alertCount')
                      .replace('{{count}}', String(routeRisk.totalAlerts))
                      .replace('{{hours}}', String(timeFilter))}
                  </span>
                  <div className="time-filter-toggle" role="group" aria-label={t('history.timeRange')}>
                    {([1, 6, 24] as TimeFilter[]).map((h) => (
                      <button
                        key={h}
                        className={`time-filter-btn ${timeFilter === h ? 'active' : ''}`}
                        onClick={() => onTimeFilterChange?.(h)}
                        aria-pressed={timeFilter === h}
                      >
                        {t(`history.${h}h` as 'history.1h' | 'history.6h' | 'history.24h')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {routeRisk && routeRisk.riskLevel === 'none' && (
              <div className="route-risk-section route-risk--none" role="status" aria-live="polite">
                <div className="route-risk-row">
                  <div className="route-risk-badge route-risk-badge--none">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                      <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" />
                      <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>{t('risk.none')}</span>
                  </div>
                </div>
              </div>
            )}
            {shareOrigin && shareDestination && (
              <button className="share-btn" onClick={handleShare} aria-label={t('share.button')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M18 8a3 3 0 1 0-2.12-5.12M18 8a3 3 0 0 1-2.12-.88L8.12 11.88M18 8l-.88.88M6 14a3 3 0 1 0 2.12-1.12M6 14a3 3 0 0 1 2.12-1.12M6 14l.88-.88M18 20a3 3 0 1 0-2.12-1.12M18 20a3 3 0 0 1-2.12-1.12l-7.76-4.76" stroke="#1565C0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {t('share.button')}
              </button>
            )}
            {currentRouteEntry && !sheltersLoading && (
              <button
                className={`save-route-btn ${isRouteSaved ? 'saved' : ''}`}
                onClick={isRouteSaved ? handleUnsaveRoute : handleSaveRoute}
                aria-label={isRouteSaved ? t('savedRoutes.unsave') : t('savedRoutes.save')}
                aria-pressed={isRouteSaved}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"
                    fill={isRouteSaved ? '#1565C0' : 'none'}
                    stroke="#1565C0"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {isRouteSaved ? t('savedRoutes.saved') : t('savedRoutes.save')}
              </button>
            )}
          </div>
        </>
      )}

      {/* Copied Toast */}
      {showCopiedToast && (
        <div className="copied-toast" role="status" aria-live="polite">
          {t('share.copied')}
        </div>
      )}

      {/* No shelters message */}
      {((routeInfo && !sheltersLoading && nearbyShelters.length === 0) ||
        (nearbyShelters.length > 0 && displayedShelters.length === 0 && showAccessibleOnly)) && (
        <div className="info-message" role="status">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#1565C0" aria-hidden="true">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
          </svg>
          <span>{t('shelters.noSheltersFound')}</span>
        </div>
      )}

      {/* Shelter Loading Skeletons */}
      {sheltersLoading && nearbyShelters.length === 0 && (
        <>
          <div className="divider" />
          <div className="shelter-list" role="status" aria-label={t('shelters.loading')}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="shelter-skeleton" aria-hidden="true">
                <div className="skeleton-icon" />
                <div className="skeleton-info">
                  <div className="skeleton-name" />
                  <div className="skeleton-address" />
                </div>
                <div className="skeleton-distance" />
              </div>
            ))}
          </div>
        </>
      )}

      {/* Shelter List */}
      {nearbyShelters.length > 0 && (
        <>
          <div className="divider" />
          <div className="shelter-list-header" id="shelter-list-label">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#0D47A1" aria-hidden="true">
              <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" />
              <path d="M12 6v8M8 10h8" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {emergencyMode ? t('shelters.nearYou') : `${t('shelters.alongRoute')} (${nearbyShelters.length})`}
          </div>

          {/* Sort & Filter Controls */}
          <div className="shelter-controls">
            <div className="sort-toggle" role="group" aria-label={t('sort.label')}>
              <span className="control-label">{t('sort.label')}:</span>
              <button
                className={`sort-btn ${sortMode === 'distance' ? 'active' : ''}`}
                onClick={() => setSortMode('distance')}
                aria-pressed={sortMode === 'distance'}
              >
                {t('sort.distance')}
              </button>
              <button
                className={`sort-btn ${sortMode === 'walkingTime' ? 'active' : ''}`}
                onClick={() => setSortMode('walkingTime')}
                aria-pressed={sortMode === 'walkingTime'}
              >
                {t('sort.walkingTime')}
              </button>
            </div>
            <label className="accessibility-filter">
              <input
                type="checkbox"
                checked={showAccessibleOnly}
                onChange={(e) => setShowAccessibleOnly(e.target.checked)}
              />
              <span className="accessibility-filter-icon" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="4" r="2" />
                  <path d="M19 13v-2c-1.54.02-3.09-.75-4.07-1.83l-1.29-1.43c-.17-.19-.38-.34-.61-.45-.01 0-.01-.01-.02-.01H13c-.35-.2-.75-.3-1.19-.26C10.76 7.11 10 8.04 10 9.09V15c0 1.1.9 2 2 2h5v5h2v-5.5c0-1.1-.9-2-2-2h-3v-3.45c1.29 1.07 3.25 1.94 5 1.95zM12.83 18H10c-1.1 0-2-.9-2-2v-1l-3.07 3.07c-.39.39-.39 1.02 0 1.41L8 22.55c.39.39 1.02.39 1.41 0L12.83 18z" />
                </svg>
              </span>
              <span>{t('accessibility.filterLabel')}</span>
            </label>
          </div>

          <div className="shelter-list" role="list" aria-labelledby="shelter-list-label">
            {displayedShelters.map((shelter) => {
              const capData = capacityMap?.get(shelter.id);
              const occupancyPct = capData && capData.capacity > 0
                ? Math.round((capData.currentOccupancy / capData.capacity) * 100)
                : undefined;
              const capColor = getCapacityColor(occupancyPct);
              const capStatus = getCapacityStatusKey(occupancyPct);
              const communityStatus = getAggregatedStatus(shelter.id);
              const statusIcon = capStatus === 'capacity.low' ? '\u2713'
                : capStatus === 'capacity.medium' ? '\u26A0'
                : capStatus === 'capacity.high' ? '!'
                : '?';

              return (
                <button
                  key={shelter.id}
                  className={`shelter-item ${selectedShelterId === shelter.id ? 'selected' : ''}`}
                  onClick={() => onShelterClick?.(shelter)}
                  role="listitem"
                  aria-label={`${shelter.name}, ${shelter.distanceFromRoute} ${t('shelters.meters')}, ${t('shelters.walkingTime').replace('{{minutes}}', String(shelter.walkingTimeMinutes))}`}
                  aria-pressed={selectedShelterId === shelter.id}
                >
                  <div className="shelter-item-icon" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#1565C0">
                      <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" />
                      <path d="M12 7v6M9 10h6" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="shelter-item-info">
                    <div className="shelter-item-name">
                      {shelter.name}
                      {shelter.isAccessible && (
                        <span className="accessible-badge" title={t('accessibility.accessible')} aria-label={t('accessibility.accessible')}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="#1B5E20" aria-hidden="true">
                            <circle cx="12" cy="4" r="2" />
                            <path d="M19 13v-2c-1.54.02-3.09-.75-4.07-1.83l-1.29-1.43c-.17-.19-.38-.34-.61-.45-.01 0-.01-.01-.02-.01H13c-.35-.2-.75-.3-1.19-.26C10.76 7.11 10 8.04 10 9.09V15c0 1.1.9 2 2 2h5v5h2v-5.5c0-1.1-.9-2-2-2h-3v-3.45c1.29 1.07 3.25 1.94 5 1.95zM12.83 18H10c-1.1 0-2-.9-2-2v-1l-3.07 3.07c-.39.39-.39 1.02 0 1.41L8 22.55c.39.39 1.02.39 1.41 0L12.83 18z" />
                          </svg>
                        </span>
                      )}
                      {communityStatus && (
                        <span
                          className="shelter-community-badge"
                          style={{ backgroundColor: getStatusBadgeColor(communityStatus) }}
                          title={t(`report.${communityStatus === 'key-required' ? 'keyRequired' : communityStatus}`)}
                        >
                          {t(`report.${communityStatus === 'key-required' ? 'keyRequired' : communityStatus}`)}
                        </span>
                      )}
                    </div>
                    {shelter.address && (
                      <div className="shelter-item-address">{shelter.address}</div>
                    )}
                    <div className="shelter-item-meta">
                      <span className="shelter-walking-time">
                        {t('shelters.walkingTime').replace('{{minutes}}', String(shelter.walkingTimeMinutes))}
                      </span>
                      {shelter.floorLevel !== undefined && (
                        <span className="shelter-floor">
                          {shelter.floorLevel === 0
                            ? t('accessibility.groundFloor')
                            : t('accessibility.floor').replace('{{level}}', String(shelter.floorLevel))}
                        </span>
                      )}
                    </div>
                    <div className="capacity-bar-container" aria-label={occupancyPct !== undefined ? `${t('capacity.occupancy')}: ${occupancyPct}%` : t('capacity.unknown')}>
                      <div className="capacity-bar-track">
                        <div
                          className="capacity-bar-fill"
                          style={{
                            width: occupancyPct !== undefined ? `${occupancyPct}%` : '0%',
                            backgroundColor: capColor,
                          }}
                        />
                      </div>
                      <span className="capacity-bar-label" style={{ color: capColor }}>
                        <span className="capacity-status-icon" aria-hidden="true">{statusIcon}</span>
                        {occupancyPct !== undefined ? `${occupancyPct}%` : t('capacity.unknown')}
                        <span className="capacity-estimated-badge-sm" title={t('capacity.estimatedTooltip')}>
                          {t('capacity.estimated')}
                        </span>
                      </span>
                    </div>
                  </div>
                  <div className="shelter-item-distance">
                    {shelter.distanceFromRoute} {t('shelters.meter')}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Capacity Legend */}
          <div className="capacity-legend">
            <div className="capacity-legend-title">{t('capacity.legend')}</div>
            <div className="capacity-legend-items">
              <div className="capacity-legend-item">
                <span className="capacity-legend-dot" style={{ backgroundColor: '#4CAF50' }} />
                <span aria-hidden="true">{'\u2713'}</span>
                <span>{t('capacity.legendLow')}</span>
              </div>
              <div className="capacity-legend-item">
                <span className="capacity-legend-dot" style={{ backgroundColor: '#FF9800' }} />
                <span aria-hidden="true">{'\u26A0'}</span>
                <span>{t('capacity.legendMedium')}</span>
              </div>
              <div className="capacity-legend-item">
                <span className="capacity-legend-dot" style={{ backgroundColor: '#F44336' }} />
                <span aria-hidden="true">!</span>
                <span>{t('capacity.legendHigh')}</span>
              </div>
              <div className="capacity-legend-item">
                <span className="capacity-legend-dot" style={{ backgroundColor: '#9E9E9E' }} />
                <span aria-hidden="true">?</span>
                <span>{t('capacity.legendUnknown')}</span>
              </div>
            </div>
          </div>
        </>
      )}


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

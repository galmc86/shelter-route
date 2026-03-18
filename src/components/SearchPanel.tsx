import { useState, useCallback, useEffect, useMemo } from 'react';
import { LocationInput } from './LocationInput';
import { TravelModeSelector } from './TravelModeSelector';
import { useLanguage } from '../i18n';
import type { TravelMode, RouteInfo, LatLng, ShelterSortMode, RouteWithShelters } from '../types';
import type { ShelterWithDistance } from '../hooks/useShelters';
import type { LocationPoint } from '../types';
import type { NominatimResult } from '../services/nominatimService';

interface SearchPanelProps {
  isLoaded: boolean;
  onSearch: (origin: LatLng, destination: LatLng, travelMode: TravelMode) => void;
  isSearching: boolean;
  routeInfo: RouteInfo | null;
  nearbyShelters: ShelterWithDistance[];
  sheltersLoading: boolean;
  currentLocation: LocationPoint | null;
  isLoadingLocation: boolean;
  onGetLocation: () => void;
  searchError: string | null;
  locationError?: string | null;
  onShelterClick?: (shelter: ShelterWithDistance) => void;
  selectedShelterId?: string | null;
  emergencyMode?: boolean;
  onEmergencyClick?: () => void;
  onExitEmergency?: () => void;
  panelExpanded?: boolean;
  onTogglePanel?: () => void;
  shareOrigin?: { lat: number; lng: number } | null;
  shareDestination?: { lat: number; lng: number } | null;
  shareTravelMode?: TravelMode;
  routesWithShelters?: RouteWithShelters[];
  selectedRouteIndex?: number;
  onRouteSelect?: (index: number) => void;
}

export function SearchPanel({
  isLoaded,
  onSearch,
  isSearching,
  routeInfo,
  nearbyShelters,
  sheltersLoading,
  currentLocation,
  isLoadingLocation,
  onGetLocation,
  searchError,
  locationError,
  onShelterClick,
  selectedShelterId,
  emergencyMode,
  onEmergencyClick,
  onExitEmergency,
  panelExpanded,
  onTogglePanel,
  shareOrigin,
  shareDestination,
  shareTravelMode,
  routesWithShelters = [],
  selectedRouteIndex = 0,
  onRouteSelect,
}: SearchPanelProps) {
  const { t } = useLanguage();
  const [showCopiedToast, setShowCopiedToast] = useState(false);
  const [originText, setOriginText] = useState('');
  const [destText, setDestText] = useState('');
  const [originPlace, setOriginPlace] = useState<NominatimResult | null>(null);
  const [destPlace, setDestPlace] = useState<NominatimResult | null>(null);
  const [travelMode, setTravelMode] = useState<TravelMode>('WALKING');
  const [useMyLocation, setUseMyLocation] = useState(false);
  const [sortMode, setSortMode] = useState<ShelterSortMode>('distance');
  const [showAccessibleOnly, setShowAccessibleOnly] = useState(false);

  // Filter and sort shelters based on user preferences
  const displayedShelters = useMemo(() => {
    let shelters = [...nearbyShelters];

    // Filter by accessibility
    if (showAccessibleOnly) {
      shelters = shelters.filter((s) => s.isAccessible);
    }

    // Sort
    if (sortMode === 'walkingTime') {
      shelters.sort((a, b) => a.walkingTimeMinutes - b.walkingTimeMinutes);
    } else {
      shelters.sort((a, b) => a.distanceFromRoute - b.distanceFromRoute);
    }

    return shelters;
  }, [nearbyShelters, sortMode, showAccessibleOnly]);

  // Find the route index with the most shelters
  const bestRouteIndex = useMemo(() => {
    if (routesWithShelters.length <= 1) return 0;
    let maxCount = -1;
    let bestIdx = 0;
    routesWithShelters.forEach((rws, idx) => {
      if (rws.shelterCount > maxCount) {
        maxCount = rws.shelterCount;
        bestIdx = idx;
      }
    });
    return bestIdx;
  }, [routesWithShelters]);

  // Auto-hide copied toast after 2 seconds
  useEffect(() => {
    if (showCopiedToast) {
      const timer = setTimeout(() => setShowCopiedToast(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [showCopiedToast]);

  const handleShare = useCallback(async () => {
    if (!shareOrigin || !shareDestination) return;

    const params = new URLSearchParams({
      from: `${shareOrigin.lat},${shareOrigin.lng}`,
      to: `${shareDestination.lat},${shareDestination.lng}`,
      mode: shareTravelMode || 'WALKING',
    });

    const shareUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    const shelterCount = nearbyShelters.length;
    const shareText = t('share.text').replace('{{count}}', String(shelterCount));

    if (navigator.share) {
      try {
        await navigator.share({
          title: t('share.title'),
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch {
        // User cancelled or share failed, fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setShowCopiedToast(true);
    } catch {
      // Clipboard API not available, show URL in alert as last resort
      alert(shareUrl);
    }
  }, [shareOrigin, shareDestination, shareTravelMode, nearbyShelters.length, t]);

  const handleUseCurrentLocation = useCallback(() => {
    onGetLocation();
    setUseMyLocation(true);
    setOriginText(t('search.myLocation'));
  }, [onGetLocation, t]);

  const handleSearch = useCallback(() => {
    let origin: LatLng | null = null;

    if (useMyLocation && currentLocation) {
      origin = { lat: currentLocation.lat, lng: currentLocation.lng };
    } else if (originPlace) {
      origin = { lat: originPlace.lat, lng: originPlace.lng };
    }

    const destination: LatLng | null = destPlace
      ? { lat: destPlace.lat, lng: destPlace.lng }
      : null;

    if (!origin || !destination) return;

    onSearch(origin, destination, travelMode);
  }, [useMyLocation, currentLocation, originPlace, destPlace, travelMode, onSearch]);

  const canSearch = (useMyLocation && currentLocation || originPlace) && destPlace && !isSearching;

  return (
    <aside
      className={`search-panel ${panelExpanded ? 'panel-expanded' : 'panel-collapsed'}`}
      role="complementary"
      aria-label={t('search.ariaLabel')}
    >
      {/* Mobile drag handle */}
      <button
        className="panel-handle"
        onClick={onTogglePanel}
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
            </div>
          </div>
          <button
            className="emergency-exit-btn"
            onClick={onExitEmergency}
            aria-label={t('emergency.exitAriaLabel')}
          >
            {t('emergency.exit')}
          </button>
        </div>
      )}

      {/* Emergency Quick Button */}
      {!emergencyMode && (
        <button
          className="emergency-quick-btn"
          onClick={onEmergencyClick}
          aria-label={t('emergency.findShelter')}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" fill="#D32F2F" />
            <path d="M12 7v6M12 15v1" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          {t('emergency.findShelter')}
        </button>
      )}

      {/* Regular search (hidden in emergency mode) */}
      {!emergencyMode && (
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

      {/* Errors */}
      {searchError && (
        <div className="error-message" role="alert">{searchError}</div>
      )}
      {locationError && !emergencyMode && (
        <div className="error-message" role="alert">{locationError}</div>
      )}

      {/* Route Selector — show when multiple alternatives exist */}
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
            <div className="shelter-count">
              <div className="shelter-badge" aria-label={`${sheltersLoading ? t('shelters.loading') : nearbyShelters.length} ${t('route.sheltersLabel')}`}>
                {sheltersLoading ? '...' : nearbyShelters.length}
              </div>
              <span className="shelter-count-text">{t('route.sheltersAlongRoute')}</span>
            </div>
            {shareOrigin && shareDestination && (
              <button className="share-btn" onClick={handleShare} aria-label={t('share.button')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M18 8a3 3 0 1 0-2.12-5.12M18 8a3 3 0 0 1-2.12-.88L8.12 11.88M18 8l-.88.88M6 14a3 3 0 1 0 2.12-1.12M6 14a3 3 0 0 1 2.12-1.12M6 14l.88-.88M18 20a3 3 0 1 0-2.12-1.12M18 20a3 3 0 0 1-2.12-1.12l-7.76-4.76" stroke="#1565C0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {t('share.button')}
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
            {displayedShelters.map((shelter) => (
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
                </div>
                <div className="shelter-item-distance">
                  {shelter.distanceFromRoute} {t('shelters.meter')}
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Emergency Hotline */}
      <div className="hotline-section">
        <a
          href="tel:100"
          className="hotline-link"
          aria-label={t('hotline.ariaLabel')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
          </svg>
          {t('hotline.label')}
        </a>
      </div>
    </aside>
  );
}

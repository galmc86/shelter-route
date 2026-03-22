import { useState } from 'react';
import { SearchForm } from './SearchForm';
import { RouteSelector } from './RouteSelector';
import { RiskIndicator } from './RiskIndicator';
import { ShelterList } from './ShelterList';
import { useLanguage } from '../i18n';
import type { TravelMode, RouteInfo, LatLng, RouteWithShelters } from '../types';
import type { PlaceResult } from '../types';
import type { ShelterWithDistance } from '../utils/shelterDistance';
import type { LocationPoint } from '../types';
import type { CapacityData } from '../services/capacityService';
import type { RouteRiskAssessment } from '../services/alertHistoryService';
import type { TimeFilter } from '../hooks/useAlertHistory';

interface SearchPanelProps {
  isLoaded: boolean;
  onSearch: (origin: LatLng, destination: LatLng, travelMode: TravelMode) => void;
  isSearching: boolean;
  routeInfo: RouteInfo | null;
  selectedRouteIndex?: number;
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
  shareOrigin?: LatLng | null;
  shareDestination?: LatLng | null;
  shareTravelMode?: TravelMode;
  routesWithShelters?: RouteWithShelters[];
  onRouteSelect?: (index: number) => void;
  capacityMap?: Map<string, CapacityData>;
  routeRisk?: RouteRiskAssessment | null;
  timeFilter?: TimeFilter;
  onTimeFilterChange?: (hours: TimeFilter) => void;
}

export function SearchPanel({
  isLoaded, onSearch, isSearching, routeInfo, selectedRouteIndex = 0,
  nearbyShelters, sheltersLoading, currentLocation, isLoadingLocation, onGetLocation,
  searchError, locationError, onShelterClick, selectedShelterId,
  emergencyMode, onEmergencyClick, onExitEmergency,
  panelExpanded, onTogglePanel,
  shareOrigin, shareDestination, shareTravelMode,
  routesWithShelters = [], onRouteSelect,
  capacityMap, routeRisk, timeFilter = 24, onTimeFilterChange,
}: SearchPanelProps) {
  const { t } = useLanguage();
  const [originText, setOriginText] = useState('');
  const [destText, setDestText] = useState('');
  const [originPlace, setOriginPlace] = useState<PlaceResult | null>(null);
  const [destPlace, setDestPlace] = useState<PlaceResult | null>(null);
  const [travelMode, setTravelMode] = useState<TravelMode>('WALKING');
  const [useMyLocation, setUseMyLocation] = useState(false);

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
          <button className="emergency-exit-btn" onClick={onExitEmergency} aria-label={t('emergency.exitAriaLabel')}>
            {t('emergency.exit')}
          </button>
        </div>
      )}

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

      <SearchForm
        isLoaded={isLoaded} onSearch={onSearch} isSearching={isSearching}
        routeInfo={routeInfo} currentLocation={currentLocation}
        isLoadingLocation={isLoadingLocation} onGetLocation={onGetLocation}
        searchError={searchError} locationError={locationError}
        emergencyMode={emergencyMode}
        shareOrigin={shareOrigin} shareDestination={shareDestination}
        shareTravelMode={shareTravelMode}
        nearbyShelters={nearbyShelters} sheltersLoading={sheltersLoading}
        travelMode={travelMode} onTravelModeChange={setTravelMode}
        originText={originText} onOriginTextChange={setOriginText}
        destText={destText} onDestTextChange={setDestText}
        originPlace={originPlace} onOriginPlaceChange={setOriginPlace}
        destPlace={destPlace} onDestPlaceChange={setDestPlace}
        useMyLocation={useMyLocation} onUseMyLocationChange={setUseMyLocation}
      />

      <RouteSelector
        routeInfo={routeInfo} selectedRouteIndex={selectedRouteIndex}
        routesWithShelters={routesWithShelters} onRouteSelect={onRouteSelect}
        nearbyShelters={nearbyShelters} sheltersLoading={sheltersLoading}
        shareOrigin={shareOrigin} shareDestination={shareDestination}
        shareTravelMode={shareTravelMode}
      />

      {/* Risk indicator shown within route info section */}
      {routeInfo && (
        <RiskIndicator
          routeRisk={routeRisk ?? null}
          timeFilter={timeFilter}
          onTimeFilterChange={onTimeFilterChange}
        />
      )}

      <ShelterList
        nearbyShelters={nearbyShelters} sheltersLoading={sheltersLoading}
        onShelterClick={onShelterClick} selectedShelterId={selectedShelterId}
        emergencyMode={emergencyMode} capacityMap={capacityMap}
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

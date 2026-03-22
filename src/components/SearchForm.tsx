import React, { useCallback, useRef, useEffect, Suspense } from 'react';
import { LocationInput } from './LocationInput';
import { TravelModeSelector } from './TravelModeSelector';

const SearchHistory = React.lazy(() => import('./SearchHistory').then(m => ({ default: m.SearchHistory })));
import { useLanguage } from '../i18n';
import { useSearchHistory } from '../hooks/useSearchHistory';
import type { TravelMode, LatLng, PlaceResult, LocationPoint, SearchHistoryEntry, RouteInfo } from '../types';
import type { ShelterWithDistance } from '../utils/shelterDistance';

export interface SearchFormProps {
  isLoaded: boolean;
  onSearch: (origin: LatLng, destination: LatLng, travelMode: TravelMode) => void;
  isSearching: boolean;
  routeInfo: RouteInfo | null;
  currentLocation: LocationPoint | null;
  isLoadingLocation: boolean;
  onGetLocation: () => void;
  searchError: string | null;
  locationError?: string | null;
  emergencyMode?: boolean;
  shareOrigin?: LatLng | null;
  shareDestination?: LatLng | null;
  shareTravelMode?: TravelMode;
  nearbyShelters: ShelterWithDistance[];
  sheltersLoading: boolean;
  travelMode: TravelMode;
  onTravelModeChange: (mode: TravelMode) => void;
  originText: string;
  onOriginTextChange: (v: string) => void;
  destText: string;
  onDestTextChange: (v: string) => void;
  originPlace: PlaceResult | null;
  onOriginPlaceChange: (p: PlaceResult | null) => void;
  destPlace: PlaceResult | null;
  onDestPlaceChange: (p: PlaceResult | null) => void;
  useMyLocation: boolean;
  onUseMyLocationChange: (v: boolean) => void;
}

export function SearchForm(props: SearchFormProps) {
  const {
    isLoaded, onSearch, isSearching, routeInfo, currentLocation, isLoadingLocation,
    onGetLocation, searchError, locationError, emergencyMode,
    shareOrigin, shareDestination, nearbyShelters, sheltersLoading,
    travelMode, onTravelModeChange, originText, onOriginTextChange,
    destText, onDestTextChange, originPlace, onOriginPlaceChange,
    destPlace, onDestPlaceChange, useMyLocation, onUseMyLocationChange,
  } = props;
  const { t } = useLanguage();
  const hasSearchedRef = useRef(false);
  const history = useSearchHistory();

  useEffect(() => { if (routeInfo) hasSearchedRef.current = true; }, [routeInfo]);

  // Update shelter count in history when shelters finish loading for current route
  useEffect(() => {
    if (routeInfo && !sheltersLoading && nearbyShelters.length > 0) {
      const origin = shareOrigin || (useMyLocation && currentLocation
        ? { lat: currentLocation.lat, lng: currentLocation.lng }
        : originPlace ? { lat: originPlace.lat, lng: originPlace.lng } : null);
      const dest = shareDestination || (destPlace ? { lat: destPlace.lat, lng: destPlace.lng } : null);
      if (origin && dest) history.updateShelterCount(origin, dest, travelMode, nearbyShelters.length);
    }
  }, [routeInfo, sheltersLoading, nearbyShelters.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUseCurrentLocation = useCallback(() => {
    onGetLocation(); onUseMyLocationChange(true); onOriginTextChange(t('search.myLocation'));
  }, [onGetLocation, t, onUseMyLocationChange, onOriginTextChange]);

  const getOrigin = useCallback((): LatLng | null => {
    if (useMyLocation && currentLocation) return { lat: currentLocation.lat, lng: currentLocation.lng };
    if (originPlace) return { lat: originPlace.lat, lng: originPlace.lng };
    return null;
  }, [useMyLocation, currentLocation, originPlace]);

  const getDest = useCallback((): LatLng | null => {
    return destPlace ? { lat: destPlace.lat, lng: destPlace.lng } : null;
  }, [destPlace]);

  const setTravelMode = useCallback((newMode: TravelMode) => {
    onTravelModeChange(newMode);
    if (!hasSearchedRef.current) return;
    const origin = getOrigin(), destination = getDest();
    if (origin && destination) onSearch(origin, destination, newMode);
  }, [getOrigin, getDest, onSearch, onTravelModeChange]);

  const handleSearch = useCallback(() => {
    const origin = getOrigin(), destination = getDest();
    if (!origin || !destination) return;
    hasSearchedRef.current = true;
    onSearch(origin, destination, travelMode);
    history.addEntry({ origin, destination, originName: originText || t('search.myLocation'), destName: destText, travelMode });
  }, [getOrigin, getDest, travelMode, onSearch, history, originText, destText, t]);

  const handleHistorySelect = useCallback((entry: SearchHistoryEntry) => {
    onOriginTextChange(entry.originName); onDestTextChange(entry.destName);
    onOriginPlaceChange({ lat: entry.origin.lat, lng: entry.origin.lng, displayName: entry.originName });
    onDestPlaceChange({ lat: entry.destination.lat, lng: entry.destination.lng, displayName: entry.destName });
    onTravelModeChange(entry.travelMode); onUseMyLocationChange(false);
    hasSearchedRef.current = true;
    onSearch(entry.origin, entry.destination, entry.travelMode);
  }, [onSearch, onOriginTextChange, onDestTextChange, onOriginPlaceChange, onDestPlaceChange, onTravelModeChange, onUseMyLocationChange]);

  const canSearch = (useMyLocation && currentLocation || originPlace) && destPlace && !isSearching;

  if (emergencyMode) {
    return (
      <>
        {searchError && <div className="error-message" role="alert">{searchError}</div>}
      </>
    );
  }

  return (
    <>
      <div className="panel-section">
        <div className="section-label" id="route-label">{t('search.sectionRoute')}</div>
        <div className="inputs-container" role="group" aria-labelledby="route-label">
          <LocationInput
            placeholder={t('search.placeholder.origin')} value={originText}
            onChange={(v) => { onOriginTextChange(v); onUseMyLocationChange(false); }}
            onPlaceSelect={(place) => { onOriginPlaceChange(place); onUseMyLocationChange(false); }}
            isLoaded={isLoaded} icon="origin" showMyLocation
            onUseCurrentLocation={handleUseCurrentLocation}
            isLoadingLocation={isLoadingLocation} currentLocation={currentLocation}
          />
          <LocationInput
            placeholder={t('search.placeholder.dest')} value={destText}
            onChange={onDestTextChange} onPlaceSelect={onDestPlaceChange}
            isLoaded={isLoaded} icon="dest"
          />
        </div>
      </div>
      <div className="panel-section">
        <div className="section-label" id="travel-label">{t('search.sectionTransport')}</div>
        <TravelModeSelector selected={travelMode} onSelect={setTravelMode} />
      </div>
      <div className="search-btn-wrapper">
        <button className="search-btn" onClick={handleSearch} disabled={!canSearch}
          title={!canSearch ? t('search.button.tooltip') : undefined}
          aria-label={canSearch ? t('search.button.ariaEnabled') : t('search.button.ariaDisabled')}>
          {isSearching ? (
            <><span className="loading-spinner small" aria-hidden="true" />{t('search.searching')}</>
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
        {!canSearch && <span className="search-btn-tooltip" aria-hidden="true">{t('search.button.tooltip')}</span>}
      </div>

      {!routeInfo && history.entries.length > 0 && (
        <Suspense fallback={null}>
          <SearchHistory entries={history.entries} onSelect={handleHistorySelect}
            onRemove={history.removeEntry} onClearAll={history.clearAll}
            onTogglePin={history.togglePin} onRename={history.renameEntry} />
        </Suspense>
      )}

      {searchError && <div className="error-message" role="alert">{searchError}</div>}
      {locationError && <div className="error-message" role="alert">{locationError}</div>}
    </>
  );
}

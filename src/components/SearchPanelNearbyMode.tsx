import { SavedLocations } from './SavedLocations';
import type { TranslationKey } from '../i18n';
import type { SavedLocation } from '../services/savedLocationsService';
import type { SavedLocationSignal } from '../services/savedLocationSignalsService';
import type { LatLng } from '../types';

interface SearchPanelNearbyModeProps {
  t: (key: TranslationKey) => string;
  isLoadingLocation: boolean;
  currentLocation: LatLng | null;
  savedLocations: SavedLocation[];
  savedLocationSignals?: Record<string, SavedLocationSignal>;
  savedLocationsMaxReached: boolean;
  onNearMeClick: () => void;
  onGetLocation: () => void;
  onSelectSavedLocation: (location: SavedLocation) => void;
  onStartRouteFromSavedLocation: (location: SavedLocation) => void;
  onAddSavedLocation: (location: Omit<SavedLocation, 'id'>) => void;
  onRemoveSavedLocation: (id: string) => void;
}

export function SearchPanelNearbyMode({
  t,
  isLoadingLocation,
  currentLocation,
  savedLocations,
  savedLocationSignals,
  savedLocationsMaxReached,
  onNearMeClick,
  onGetLocation,
  onSelectSavedLocation,
  onStartRouteFromSavedLocation,
  onAddSavedLocation,
  onRemoveSavedLocation,
}: SearchPanelNearbyModeProps) {
  return (
    <>
      <div className="nearby-actions">
        <button
          type="button"
          className="nearby-primary-btn"
          onClick={onNearMeClick}
        >
          {t('search.sheltersNearMe')}
        </button>
        <button
          type="button"
          className="nearby-secondary-btn"
          onClick={onGetLocation}
          disabled={isLoadingLocation}
        >
          {isLoadingLocation ? t('location.locating') : t('location.useMyLocation')}
        </button>
      </div>
      <div className="nearby-mode-hint">
        {t('search.nearbyHint')}
      </div>
      <SavedLocations
        locations={savedLocations}
        locationSignals={savedLocationSignals}
        onSelectLocation={onSelectSavedLocation}
        onStartRouteFromLocation={onStartRouteFromSavedLocation}
        onAddLocation={onAddSavedLocation}
        onRemoveLocation={onRemoveSavedLocation}
        isMaxReached={savedLocationsMaxReached}
        currentLocation={currentLocation}
      />
    </>
  );
}

import { SavedLocations } from './SavedLocations';
import type { TranslationKey } from '../i18n';
import type { SavedLocation } from '../services/savedLocationsService';
import type { LatLng } from '../types';

interface SearchPanelNearbyModeProps {
  t: (key: TranslationKey) => string;
  isLoadingLocation: boolean;
  currentLocation: LatLng | null;
  savedLocations: SavedLocation[];
  savedLocationsMaxReached: boolean;
  onNearMeClick: () => void;
  onGetLocation: () => void;
  onSearchFromSavedLocation: (location: LatLng, label?: string) => void;
  onAddSavedLocation: (location: Omit<SavedLocation, 'id'>) => void;
  onRemoveSavedLocation: (id: string) => void;
}

export function SearchPanelNearbyMode({
  t,
  isLoadingLocation,
  currentLocation,
  savedLocations,
  savedLocationsMaxReached,
  onNearMeClick,
  onGetLocation,
  onSearchFromSavedLocation,
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
        onSelectLocation={(location) => onSearchFromSavedLocation(
          { lat: location.lat, lng: location.lng },
          location.name
        )}
        onAddLocation={onAddSavedLocation}
        onRemoveLocation={onRemoveSavedLocation}
        isMaxReached={savedLocationsMaxReached}
        currentLocation={currentLocation}
      />
    </>
  );
}

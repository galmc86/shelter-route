import { useState, useCallback } from 'react';
import { useLanguage } from '../i18n';
import type { SavedLocation, SavedLocationLabel } from '../hooks/useSavedLocations';
import type { LatLng } from '../types';

interface SavedLocationsProps {
  locations: SavedLocation[];
  onSelectLocation: (location: SavedLocation) => void;
  onAddLocation: (loc: Omit<SavedLocation, 'id'>) => void;
  onRemoveLocation: (id: string) => void;
  isMaxReached: boolean;
  currentLocation: LatLng | null;
}

const LABEL_ICONS: Record<SavedLocationLabel, string> = {
  home: '\uD83C\uDFE0',
  work: '\uD83C\uDFE2',
  school: '\uD83C\uDFEB',
  other: '\uD83D\uDCCD',
};

const LABEL_OPTIONS: SavedLocationLabel[] = ['home', 'work', 'school', 'other'];

export function SavedLocations({
  locations,
  onSelectLocation,
  onAddLocation,
  onRemoveLocation,
  isMaxReached,
  currentLocation,
}: SavedLocationsProps) {
  const { t } = useLanguage();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLabel, setNewLabel] = useState<SavedLocationLabel>('home');

  const handleAdd = useCallback(() => {
    if (!currentLocation || !newName.trim()) return;

    onAddLocation({
      name: newName.trim(),
      label: newLabel,
      lat: currentLocation.lat,
      lng: currentLocation.lng,
    });

    setNewName('');
    setNewLabel('home');
    setShowAddForm(false);
  }, [currentLocation, newName, newLabel, onAddLocation]);

  const handleChipClick = useCallback(
    (loc: SavedLocation) => {
      onSelectLocation(loc);
    },
    [onSelectLocation]
  );

  if (locations.length === 0 && !currentLocation) {
    return null;
  }

  return (
    <div className="saved-locations" role="region" aria-label={t('savedLocations.title')}>
      <div className="saved-locations-chips">
        {locations.map((loc) => (
          <div
            key={loc.id}
            className="saved-location-chip"
            role="group"
            aria-label={loc.name}
          >
            <button
              type="button"
              className="saved-location-chip-select"
              onClick={() => handleChipClick(loc)}
              aria-label={`${loc.name} - ${t('savedLocations.tapToFind')}`}
            >
              <span className="saved-location-chip-icon" aria-hidden="true">
                {LABEL_ICONS[loc.label]}
              </span>
              <span className="saved-location-chip-name">{loc.name}</span>
            </button>
            <button
              type="button"
              className="saved-location-chip-remove"
              onClick={() => onRemoveLocation(loc.id)}
              aria-label={`${t('savedLocations.remove')} ${loc.name}`}
            >
              &times;
            </button>
          </div>
        ))}

        {!isMaxReached && currentLocation && (
          <button
            className="saved-location-add-btn"
            onClick={() => setShowAddForm((v) => !v)}
            aria-label={t('savedLocations.addCurrent')}
          >
            +
          </button>
        )}
      </div>

      {showAddForm && currentLocation && (
        <div className="saved-location-form">
          <div className="saved-location-form-labels">
            {LABEL_OPTIONS.map((label) => (
              <button
                key={label}
                className={`saved-location-label-btn ${newLabel === label ? 'active' : ''}`}
                onClick={() => setNewLabel(label)}
                aria-pressed={newLabel === label}
              >
                <span aria-hidden="true">{LABEL_ICONS[label]}</span>
                <span>{t(`savedLocations.label.${label}`)}</span>
              </button>
            ))}
          </div>
          <div className="saved-location-form-row">
            <input
              type="text"
              className="saved-location-name-input"
              placeholder={t('savedLocations.namePlaceholder')}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={30}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
              }}
            />
            <button
              className="saved-location-save-btn"
              onClick={handleAdd}
              disabled={!newName.trim()}
            >
              {t('savedLocations.save')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

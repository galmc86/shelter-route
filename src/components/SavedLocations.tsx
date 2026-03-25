import { useCallback, useMemo, useState } from 'react';
import { useLanguage } from '../i18n';
import type { SavedLocation, SavedLocationLabel } from '../hooks/useSavedLocations';
import type { SavedLocationSignal } from '../services/savedLocationSignalsService';
import type { LatLng } from '../types';

interface SavedLocationsProps {
  locations: SavedLocation[];
  locationSignals?: Record<string, SavedLocationSignal>;
  onSelectLocation: (location: SavedLocation) => void;
  onStartRouteFromLocation: (location: SavedLocation) => void;
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
  locationSignals = {},
  onSelectLocation,
  onStartRouteFromLocation,
  onAddLocation,
  onRemoveLocation,
  isMaxReached,
  currentLocation,
}: SavedLocationsProps) {
  const { t } = useLanguage();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLabel, setNewLabel] = useState<SavedLocationLabel>('home');
  const lastUsedLocationId = useMemo(() => {
    const latestLocation = locations.reduce<SavedLocation | null>((currentLatest, location) => {
      if (typeof location.lastUsedAt !== 'number') {
        return currentLatest;
      }

      if (!currentLatest || location.lastUsedAt > (currentLatest.lastUsedAt ?? 0)) {
        return location;
      }

      return currentLatest;
    }, null);

    return latestLocation ? latestLocation.id : null;
  }, [locations]);
  const selectedLabelExists = useMemo(
    () => locations.some((location) => location.label === newLabel),
    [locations, newLabel]
  );
  const defaultName = newLabel === 'other' ? '' : t(`savedLocations.label.${newLabel}`);
  const resolvedName = newName.trim() || defaultName;
  const canSaveSelectedLabel = Boolean(
    currentLocation &&
    resolvedName &&
    (!isMaxReached || (newLabel !== 'other' && selectedLabelExists))
  );

  const handleAdd = useCallback(() => {
    if (!currentLocation || !canSaveSelectedLabel) return;

    onAddLocation({
      name: resolvedName,
      label: newLabel,
      lat: currentLocation.lat,
      lng: currentLocation.lng,
    });

    setNewName('');
    setNewLabel('home');
    setShowAddForm(false);
  }, [canSaveSelectedLabel, currentLocation, newLabel, onAddLocation, resolvedName]);

  const handleChipClick = useCallback(
    (loc: SavedLocation) => {
      onSelectLocation(loc);
    },
    [onSelectLocation]
  );
  const handleRouteStart = useCallback((loc: SavedLocation) => {
    onStartRouteFromLocation(loc);
  }, [onStartRouteFromLocation]);

  const handleToggleAddForm = useCallback(() => {
    if (showAddForm) {
      setShowAddForm(false);
      setNewName('');
      setNewLabel('home');
      return;
    }

    setShowAddForm(true);
    setNewLabel('home');
    setNewName(t('savedLocations.label.home'));
  }, [showAddForm, t]);

  const handleLabelChange = useCallback((label: SavedLocationLabel) => {
    const previousDefaultName = newLabel === 'other' ? '' : t(`savedLocations.label.${newLabel}`);
    const nextDefaultName = label === 'other' ? '' : t(`savedLocations.label.${label}`);

    setNewLabel(label);
    setNewName((current) => {
      const trimmed = current.trim();
      if (!trimmed || trimmed === previousDefaultName) {
        return nextDefaultName;
      }
      return current;
    });
  }, [newLabel, t]);

  if (locations.length === 0 && !currentLocation) {
    return null;
  }

  return (
    <div className="saved-locations" role="region" aria-label={t('savedLocations.title')}>
      <div className="saved-locations-chips">
        {locations.map((loc) => (
          <div
            key={loc.id}
            className={`saved-location-chip ${loc.id === lastUsedLocationId ? 'saved-location-chip-last-used' : ''}`}
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
              <span className="saved-location-chip-content">
                <span className="saved-location-chip-heading">
                  <span className="saved-location-chip-name">{loc.name}</span>
                  {loc.id === lastUsedLocationId && loc.lastUsedAt ? (
                    <span className="saved-location-chip-badge">
                      {t('savedLocations.lastUsed')}
                    </span>
                  ) : null}
                </span>
                {locationSignals[loc.id]?.closestShelterMinutes || loc.routePreset || locationSignals[loc.id]?.hasAccessibleNearby ? (
                  <span className="saved-location-chip-meta">
                    {locationSignals[loc.id]?.closestShelterMinutes ? (
                      <span className="saved-location-chip-signal">
                        {t('savedLocations.closestShelter').replace('{{minutes}}', String(locationSignals[loc.id]?.closestShelterMinutes))}
                      </span>
                    ) : null}
                    {loc.routePreset ? (
                      <span className="saved-location-chip-signal">
                        {t('savedLocations.routePreset').replace('{{destination}}', loc.routePreset.destinationName)}
                      </span>
                    ) : null}
                    {locationSignals[loc.id]?.hasAccessibleNearby ? (
                      <span className="saved-location-chip-signal-badge">
                        {t('savedLocations.accessibleNearby')}
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </span>
            </button>
            <button
              type="button"
              className="saved-location-chip-action"
              onClick={() => handleRouteStart(loc)}
              aria-label={loc.routePreset
                ? `${t('savedLocations.startPresetRoute')} ${loc.name}`
                : `${t('savedLocations.startRoute')} ${loc.name}`
              }
              title={loc.routePreset
                ? t('savedLocations.routePreset').replace('{{destination}}', loc.routePreset.destinationName)
                : t('savedLocations.startRoute')
              }
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 7h10.5a3.5 3.5 0 0 1 0 7H10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M12.5 18 9 14.5 12.5 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
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

        {currentLocation && (
          <button
            className="saved-location-add-btn"
            onClick={handleToggleAddForm}
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
                onClick={() => handleLabelChange(label)}
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
              placeholder={defaultName || t('savedLocations.namePlaceholder')}
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
              disabled={!canSaveSelectedLabel}
            >
              {t('savedLocations.save')}
            </button>
          </div>
          {isMaxReached && !canSaveSelectedLabel ? (
            <div className="saved-location-form-hint">{t('savedLocations.maxReached')}</div>
          ) : null}
        </div>
      )}
    </div>
  );
}

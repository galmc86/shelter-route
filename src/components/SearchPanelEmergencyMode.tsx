import type { TranslationKey } from '../i18n';

interface EmergencyNearestShelter {
  name: string;
  lat: number;
  lon: number;
  walkingTimeMinutes: number;
}

interface SearchPanelEmergencyModeProps {
  t: (key: TranslationKey) => string;
  nearbyShelterCount: number;
  nearestShelter: EmergencyNearestShelter | null;
  isLoadingLocation: boolean;
  locationError: string | null;
  onUseMapCenter: () => void;
  onExitEmergency: () => void;
}

export function SearchPanelEmergencyMode({
  t,
  nearbyShelterCount,
  nearestShelter,
  isLoadingLocation,
  locationError,
  onUseMapCenter,
  onExitEmergency,
}: SearchPanelEmergencyModeProps) {
  const mapsUrl = nearestShelter
    ? `https://www.google.com/maps/dir/?api=1&destination=${nearestShelter.lat},${nearestShelter.lon}&travelmode=walking`
    : null;

  const subtitle = isLoadingLocation
    ? t('emergency.locating')
    : locationError
      ? locationError
      : `${nearbyShelterCount} ${t('emergency.nearbyShelters')}`;

  return (
    <section className="emergency-mode-surface" role="alert" aria-live="assertive">
      <div className="emergency-mode-topline">
        <span className="emergency-mode-badge">{t('emergency.bannerTitle')}</span>
        <button
          type="button"
          className="emergency-mode-exit"
          onClick={onExitEmergency}
          aria-label={t('emergency.exitAriaLabel')}
        >
          {t('emergency.exit')}
        </button>
      </div>

      <div className="emergency-mode-main">
        <div className="emergency-mode-icon" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" fill="currentColor" />
            <path d="M12 7v6M12 15v1" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>
        <div className="emergency-mode-copy">
          <div className="emergency-mode-title">{t('emergency.findShelter')}</div>
          <div className="emergency-mode-subtitle">{subtitle}</div>
        </div>
      </div>

      {locationError && !isLoadingLocation && (
        <div className="emergency-mode-fallback">
          <button
            type="button"
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

      {mapsUrl && nearestShelter && (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="emergency-navigate-now-btn"
          aria-label={`${t('emergency.navigateNow')} - ${nearestShelter.name}`}
        >
          <span className="emergency-navigate-now-icon" aria-hidden="true">&#x27A4;</span>
          <span className="emergency-navigate-now-text">
            <span className="emergency-navigate-now-label">{t('emergency.navigateNow')}</span>
            <span className="emergency-navigate-now-detail">
              {nearestShelter.name} &middot; {t('emergency.walkingTime')}: ~{nearestShelter.walkingTimeMinutes} {t('capacity.minutes')}
            </span>
          </span>
        </a>
      )}
    </section>
  );
}

import { useLanguage } from '../i18n';
import type { ShelterWithDistance } from '../hooks/useShelters';
import type { CapacityData } from '../services/capacityService';
import { getCapacityColor } from '../services/capacityService';

interface ShelterPopupProps {
  shelter: ShelterWithDistance;
  hasRoute: boolean;
  capacityData?: CapacityData;
}

export function ShelterPopup({ shelter, hasRoute, capacityData }: ShelterPopupProps) {
  const { language, t } = useLanguage();
  const dir = language === 'he' ? 'rtl' : 'ltr';

  const name = shelter.name || t('shelters.publicShelter');
  const distanceText = Math.round(shelter.distanceFromRoute);
  const distanceLabel = hasRoute ? t('shelters.fromRoute') : t('shelters.fromYou');
  const metersLabel = t('shelters.meters');
  const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${shelter.lat},${shelter.lon}&travelmode=walking`;

  const walkingMinutes = shelter.walkingTimeMinutes ?? Math.max(1, Math.round(distanceText / 80));

  const occupancyPct =
    capacityData && capacityData.capacity > 0
      ? Math.round((capacityData.currentOccupancy / capacityData.capacity) * 100)
      : undefined;
  const capColor = getCapacityColor(occupancyPct);

  return (
    <div className="shelter-popup" style={{ direction: dir }}>
      <div className="shelter-popup-name">{name}</div>

      {shelter.address && (
        <div className="shelter-popup-address">{shelter.address}</div>
      )}

      <div className="shelter-popup-distance">
        {distanceText} {metersLabel} {distanceLabel}
        <span className="shelter-popup-walking">
          (~{walkingMinutes} {t('capacity.minutes')} {t('capacity.walkingTime')})
        </span>
      </div>

      {occupancyPct !== undefined && (
        <div className="shelter-popup-capacity">
          <div className="shelter-popup-capacity-label">{t('capacity.title')}</div>
          <div className="shelter-popup-capacity-row">
            <div className="shelter-popup-capacity-track">
              <div
                className="shelter-popup-capacity-fill"
                style={{ width: `${occupancyPct}%`, backgroundColor: capColor }}
              />
            </div>
            <span className="shelter-popup-capacity-pct" style={{ color: capColor }}>
              {occupancyPct}%
            </span>
          </div>
        </div>
      )}

      <div className="shelter-popup-actions">
        <a
          href={navUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shelter-popup-nav"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M21 3L3 10.53v.98l6.84 2.65L12.48 21h.98L21 3z"/>
          </svg>
          {t('shelters.navigateToShelter')}
        </a>
        <a
          href={navUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shelter-popup-gmaps"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Google Maps
        </a>
      </div>
    </div>
  );
}

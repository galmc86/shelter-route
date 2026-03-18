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

      <a
        href={navUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="shelter-popup-nav"
      >
        {t('shelters.navigateToShelter')}
      </a>
    </div>
  );
}

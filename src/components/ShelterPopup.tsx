import { useState } from 'react';
import { useLanguage } from '../i18n';
import type { ShelterWithDistance } from '../hooks/useShelters';
import type { CapacityData } from '../services/capacityService';
import { getCapacityColor } from '../services/capacityService';
import { getAggregatedStatus, getStatusBadgeColor } from '../services/shelterReportsService';
import { ShelterReport } from './ShelterReport';

interface ShelterPopupProps {
  shelter: ShelterWithDistance;
  hasRoute: boolean;
  capacityData?: CapacityData;
  onNavigate?: (shelter: ShelterWithDistance) => void;
}

export function ShelterPopup({ shelter, hasRoute, capacityData, onNavigate }: ShelterPopupProps) {
  const { language, t } = useLanguage();
  const dir = language === 'en' || language === 'ru' ? 'ltr' : 'rtl';
  const [showReportForm, setShowReportForm] = useState(false);
  const aggregatedStatus = getAggregatedStatus(shelter.id);

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
          <div className="shelter-popup-capacity-label">
            {t('capacity.title')}
            <span className="capacity-estimated-badge" title={t('capacity.estimatedTooltip')}>
              {t('capacity.estimated')}
            </span>
          </div>
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

      {aggregatedStatus && (
        <div className="shelter-popup-community-status">
          <span
            className="shelter-status-badge"
            style={{ backgroundColor: getStatusBadgeColor(aggregatedStatus) }}
          >
            {t(`report.${aggregatedStatus === 'key-required' ? 'keyRequired' : aggregatedStatus}`)}
          </span>
        </div>
      )}

      {onNavigate ? (
        <div className="shelter-popup-nav-actions">
          <button
            className="shelter-popup-nav-btn"
            onClick={() => onNavigate(shelter)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3 11l19-9-9 19-2-8-8-2z" fill="currentColor" />
            </svg>
            {t('nav.navigate')}
          </button>
          <a
            href={navUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shelter-popup-gmaps-link"
          >
            {t('nav.openGoogleMaps')}
          </a>
        </div>
      ) : (
        <a
          href={navUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shelter-popup-nav"
        >
          {t('shelters.navigateToShelter')}
        </a>
      )}

      <button
        className="shelter-popup-report-btn"
        onClick={() => setShowReportForm(!showReportForm)}
        type="button"
      >
        {t('report.reportStatus')}
      </button>

      {showReportForm && (
        <ShelterReport
          shelterId={shelter.id}
          onClose={() => setShowReportForm(false)}
        />
      )}
    </div>
  );
}

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

  // Position the capacity fill gradient based on percentage
  const capFillPosition =
    occupancyPct !== undefined
      ? occupancyPct <= 50
        ? '0% 0%'
        : occupancyPct <= 75
          ? '50% 0%'
          : '100% 0%'
      : undefined;

  return (
    <div className="shelter-popup" style={{ direction: dir }}>
      <div className="shelter-popup-name">{name}</div>

      {shelter.address && (
        <div className="shelter-popup-address">{shelter.address}</div>
      )}

      <div className="shelter-popup-distance">
        <span className="shelter-popup-distance-badge">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z" fill="currentColor" />
          </svg>
          {distanceText} {metersLabel} {distanceLabel}
        </span>
        <span className="shelter-popup-walking-badge">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7" fill="currentColor" />
          </svg>
          ~{walkingMinutes} {t('capacity.minutes')}
        </span>
      </div>

      {occupancyPct !== undefined && (
        <div className="shelter-popup-capacity">
          <div className="shelter-popup-capacity-label">
            {t('capacity.title')}
            <span className="shelter-popup-capacity-estimated">
              ({t('capacity.estimated')})
            </span>
          </div>
          <div className="shelter-popup-capacity-row">
            <div className="shelter-popup-capacity-track">
              <div
                className="shelter-popup-capacity-fill"
                style={{
                  width: `${occupancyPct}%`,
                  backgroundPosition: capFillPosition,
                }}
              />
            </div>
            <span
              className="shelter-popup-capacity-pct"
              style={{
                color: capColor,
                backgroundColor: `${capColor}18`,
              }}
            >
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M19 19H5V5h7V3H5a2 2 0 00-2 2v14a2 2 0 002 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" fill="currentColor" />
            </svg>
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
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6h-5.6z" fill="currentColor" />
        </svg>
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

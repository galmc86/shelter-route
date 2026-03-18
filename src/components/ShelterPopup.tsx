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

  // Walking time estimate: ~80m per minute
  const walkingMinutes = Math.max(1, Math.round(distanceText / 80));

  // Capacity
  const occupancyPct =
    capacityData && capacityData.capacity > 0
      ? Math.round((capacityData.currentOccupancy / capacityData.capacity) * 100)
      : undefined;
  const capColor = getCapacityColor(occupancyPct);

  return (
    <div style={{ direction: dir, fontFamily: '-apple-system, sans-serif', padding: 4, minWidth: 200, maxWidth: 280 }}>
      {/* Name */}
      <div style={{ fontWeight: 600, color: '#0D47A1', fontSize: 14, marginBottom: 6 }}>
        {name}
      </div>

      {/* Address */}
      {shelter.address && (
        <div style={{ fontSize: 12, color: '#424242', marginBottom: 6, lineHeight: 1.4 }}>
          {shelter.address}
        </div>
      )}

      {/* Distance + walking time */}
      <div style={{ fontSize: 12, color: '#1565C0', fontWeight: 600, marginTop: 8, paddingTop: 8, borderTop: '1px solid #eee' }}>
        {distanceText} {metersLabel} {distanceLabel}
        <span style={{ marginInlineStart: 8, color: '#757575', fontWeight: 400 }}>
          (~{walkingMinutes} {t('capacity.minutes')} {t('capacity.walkingTime')})
        </span>
      </div>

      {/* Capacity indicator */}
      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #eee' }}>
        <div style={{ fontSize: 11, color: '#757575', marginBottom: 4 }}>
          {t('capacity.title')}
        </div>
        {occupancyPct !== undefined ? (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <div
                style={{
                  flex: 1,
                  height: 6,
                  backgroundColor: '#E0E0E0',
                  borderRadius: 3,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${occupancyPct}%`,
                    height: '100%',
                    backgroundColor: capColor,
                    borderRadius: 3,
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: capColor, minWidth: 32, textAlign: 'end' }}>
                {occupancyPct}%
              </span>
            </div>
            <div style={{ fontSize: 10, color: '#9E9E9E', marginTop: 2 }}>
              {capacityData!.currentOccupancy} {t('capacity.of')} {capacityData!.capacity}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 11, color: '#9E9E9E' }}>
            {t('capacity.unknown')}
          </div>
        )}
      </div>

      {/* Navigate button */}
      <a
        href={navUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'block',
          textAlign: 'center',
          marginTop: 8,
          padding: 8,
          background: '#1565C0',
          color: 'white',
          textDecoration: 'none',
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 500,
        }}
      >
        {t('shelters.navigateToShelter')}
      </a>
    </div>
  );
}

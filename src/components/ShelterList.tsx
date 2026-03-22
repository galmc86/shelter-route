import { useState, useMemo } from 'react';
import { useLanguage } from '../i18n';
import type { ShelterSortMode } from '../types';
import type { ShelterWithDistance } from '../utils/shelterDistance';
import type { CapacityData } from '../services/capacityService';
import { getCapacityColor, getCapacityStatusKey } from '../services/capacityService';

export interface ShelterListProps {
  nearbyShelters: ShelterWithDistance[];
  sheltersLoading: boolean;
  onShelterClick?: (shelter: ShelterWithDistance) => void;
  selectedShelterId?: string | null;
  emergencyMode?: boolean;
  capacityMap?: Map<string, CapacityData>;
}

export function ShelterList({
  nearbyShelters, sheltersLoading, onShelterClick,
  selectedShelterId, emergencyMode, capacityMap,
}: ShelterListProps) {
  const { t } = useLanguage();
  const [sortMode, setSortMode] = useState<ShelterSortMode>('distance');
  const [showAccessibleOnly, setShowAccessibleOnly] = useState(false);

  // Filter and sort shelters based on user preferences
  const displayedShelters = useMemo(() => {
    let shelters = [...nearbyShelters];
    if (showAccessibleOnly) {
      shelters = shelters.filter((s) => s.isAccessible);
    }
    if (sortMode === 'walkingTime') {
      shelters.sort((a, b) => a.walkingTimeMinutes - b.walkingTimeMinutes);
    } else {
      shelters.sort((a, b) => a.distanceFromRoute - b.distanceFromRoute);
    }
    return shelters;
  }, [nearbyShelters, sortMode, showAccessibleOnly]);

  return (
    <>
      {/* No shelters message */}
      {nearbyShelters.length > 0 && displayedShelters.length === 0 && showAccessibleOnly && (
        <div className="info-message" role="status">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#1565C0" aria-hidden="true">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
          </svg>
          <span>{t('shelters.noSheltersFound')}</span>
        </div>
      )}

      {/* Shelter Loading Skeletons */}
      {sheltersLoading && nearbyShelters.length === 0 && (
        <>
          <div className="divider" />
          <div className="shelter-list" role="status" aria-label={t('shelters.loading')}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="shelter-skeleton" aria-hidden="true">
                <div className="skeleton-icon" />
                <div className="skeleton-info">
                  <div className="skeleton-name" />
                  <div className="skeleton-address" />
                </div>
                <div className="skeleton-distance" />
              </div>
            ))}
          </div>
        </>
      )}

      {/* Shelter List */}
      {nearbyShelters.length > 0 && (
        <>
          <div className="divider" />
          <div className="shelter-list-header" id="shelter-list-label">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#0D47A1" aria-hidden="true">
              <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" />
              <path d="M12 6v8M8 10h8" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {emergencyMode ? t('shelters.nearYou') : `${t('shelters.alongRoute')} (${nearbyShelters.length})`}
          </div>

          {/* Sort & Filter Controls */}
          <div className="shelter-controls">
            <div className="sort-toggle" role="group" aria-label={t('sort.label')}>
              <span className="control-label">{t('sort.label')}:</span>
              {(['distance', 'walkingTime'] as const).map((mode) => (
                <button key={mode} className={`sort-btn ${sortMode === mode ? 'active' : ''}`}
                  onClick={() => setSortMode(mode)} aria-pressed={sortMode === mode}>
                  {t(`sort.${mode}`)}
                </button>
              ))}
            </div>
            <label className="accessibility-filter">
              <input type="checkbox" checked={showAccessibleOnly} onChange={(e) => setShowAccessibleOnly(e.target.checked)} />
              <span className="accessibility-filter-icon" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="4" r="2" />
                  <path d="M19 13v-2c-1.54.02-3.09-.75-4.07-1.83l-1.29-1.43c-.17-.19-.38-.34-.61-.45-.01 0-.01-.01-.02-.01H13c-.35-.2-.75-.3-1.19-.26C10.76 7.11 10 8.04 10 9.09V15c0 1.1.9 2 2 2h5v5h2v-5.5c0-1.1-.9-2-2-2h-3v-3.45c1.29 1.07 3.25 1.94 5 1.95zM12.83 18H10c-1.1 0-2-.9-2-2v-1l-3.07 3.07c-.39.39-.39 1.02 0 1.41L8 22.55c.39.39 1.02.39 1.41 0L12.83 18z" />
                </svg>
              </span>
              <span>{t('accessibility.filterLabel')}</span>
            </label>
          </div>

          <div className="shelter-list" role="list" aria-labelledby="shelter-list-label">
            {displayedShelters.map((shelter) => {
              const capData = capacityMap?.get(shelter.id);
              const occupancyPct = capData && capData.capacity > 0
                ? Math.round((capData.currentOccupancy / capData.capacity) * 100)
                : undefined;
              const capColor = getCapacityColor(occupancyPct);
              const capStatus = getCapacityStatusKey(occupancyPct);
              const statusIcon = capStatus === 'capacity.low' ? '\u2713'
                : capStatus === 'capacity.medium' ? '\u26A0'
                : capStatus === 'capacity.high' ? '!'
                : '?';

              return (
                <button
                  key={shelter.id}
                  className={`shelter-item ${selectedShelterId === shelter.id ? 'selected' : ''}`}
                  onClick={() => onShelterClick?.(shelter)}
                  role="listitem"
                  aria-label={`${shelter.name}, ${shelter.distanceFromRoute} ${t('shelters.meters')}, ${t('shelters.walkingTime').replace('{{minutes}}', String(shelter.walkingTimeMinutes))}`}
                  aria-pressed={selectedShelterId === shelter.id}
                >
                  <div className="shelter-item-icon" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#1565C0">
                      <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" />
                      <path d="M12 7v6M9 10h6" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="shelter-item-info">
                    <div className="shelter-item-name">
                      {shelter.name}
                      {shelter.isAccessible && (
                        <span className="accessible-badge" title={t('accessibility.accessible')} aria-label={t('accessibility.accessible')}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="#1B5E20" aria-hidden="true">
                            <circle cx="12" cy="4" r="2" />
                            <path d="M19 13v-2c-1.54.02-3.09-.75-4.07-1.83l-1.29-1.43c-.17-.19-.38-.34-.61-.45-.01 0-.01-.01-.02-.01H13c-.35-.2-.75-.3-1.19-.26C10.76 7.11 10 8.04 10 9.09V15c0 1.1.9 2 2 2h5v5h2v-5.5c0-1.1-.9-2-2-2h-3v-3.45c1.29 1.07 3.25 1.94 5 1.95zM12.83 18H10c-1.1 0-2-.9-2-2v-1l-3.07 3.07c-.39.39-.39 1.02 0 1.41L8 22.55c.39.39 1.02.39 1.41 0L12.83 18z" />
                          </svg>
                        </span>
                      )}
                    </div>
                    {shelter.address && (
                      <div className="shelter-item-address">{shelter.address}</div>
                    )}
                    <div className="shelter-item-meta">
                      <span className="shelter-walking-time">
                        {t('shelters.walkingTime').replace('{{minutes}}', String(shelter.walkingTimeMinutes))}
                      </span>
                      {shelter.floorLevel !== undefined && (
                        <span className="shelter-floor">
                          {shelter.floorLevel === 0
                            ? t('accessibility.groundFloor')
                            : t('accessibility.floor').replace('{{level}}', String(shelter.floorLevel))}
                        </span>
                      )}
                    </div>
                    <div className="capacity-bar-container" aria-label={occupancyPct !== undefined ? `${t('capacity.occupancy')}: ${occupancyPct}%` : t('capacity.unknown')}>
                      <div className="capacity-bar-track">
                        <div className="capacity-bar-fill" style={{ width: occupancyPct !== undefined ? `${occupancyPct}%` : '0%', backgroundColor: capColor }} />
                      </div>
                      <span className="capacity-bar-label" style={{ color: capColor }}>
                        <span className="capacity-status-icon" aria-hidden="true">{statusIcon}</span>
                        {occupancyPct !== undefined ? `${occupancyPct}%` : t('capacity.unknown')}
                      </span>
                    </div>
                  </div>
                  <div className="shelter-item-distance">
                    {shelter.distanceFromRoute} {t('shelters.meter')}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Capacity Legend */}
          <div className="capacity-legend">
            <div className="capacity-legend-title">{t('capacity.legend')}</div>
            <div className="capacity-legend-items">
              {([['#4CAF50', '\u2713', 'capacity.legendLow'], ['#FF9800', '\u26A0', 'capacity.legendMedium'],
                ['#F44336', '!', 'capacity.legendHigh'], ['#9E9E9E', '?', 'capacity.legendUnknown']] as const).map(([color, icon, key]) => (
                <div key={key} className="capacity-legend-item">
                  <span className="capacity-legend-dot" style={{ backgroundColor: color }} />
                  <span aria-hidden="true">{icon}</span>
                  <span>{t(key)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}

import { useLanguage } from '../i18n';
import type { ShelterSortMode } from '../types';
import type { ShelterWithDistance } from '../hooks/useShelters';
import type { CapacityData } from '../services/capacityService';
import { getCapacityColor, getCapacityStatusKey } from '../services/capacityService';
import { getAggregatedStatus, getStatusBadgeColor } from '../services/shelterReportsService';
import type { RankedShelter } from '../services/shelterRankingService';
import { getShelterKindLabel } from '../utils/shelterKind';

interface ShelterResultsProps {
  emergencyMode: boolean;
  proximityMode?: boolean;
  showIdleState?: boolean;
  nearbyShelters: ShelterWithDistance[];
  displayedShelters: RankedShelter[];
  sheltersLoading: boolean;
  showAccessibleOnly: boolean;
  onShowAccessibleOnlyChange: (value: boolean) => void;
  sortMode: ShelterSortMode;
  onSortModeChange: (mode: ShelterSortMode) => void;
  selectedShelterId: string | null;
  onShelterClick?: (shelter: ShelterWithDistance) => void;
  capacityMap?: Map<string, CapacityData>;
}

export function ShelterResults({
  emergencyMode,
  proximityMode = false,
  showIdleState = false,
  nearbyShelters,
  displayedShelters,
  sheltersLoading,
  showAccessibleOnly,
  onShowAccessibleOnlyChange,
  sortMode,
  onSortModeChange,
  selectedShelterId,
  onShelterClick,
  capacityMap,
}: ShelterResultsProps) {
  const { t } = useLanguage();
  const detailShelter = selectedShelterId
    ? displayedShelters.find((shelter) => shelter.id === selectedShelterId) ?? null
    : (emergencyMode || proximityMode) ? displayedShelters[0] ?? null : null;
  const detailCapacityData = detailShelter ? capacityMap?.get(detailShelter.id) : undefined;
  const detailOccupancyPct = detailShelter
    ? detailShelter.occupancyPercent ?? (detailCapacityData && detailCapacityData.capacity > 0
      ? Math.round((detailCapacityData.currentOccupancy / detailCapacityData.capacity) * 100)
      : undefined)
    : undefined;
  const detailKindLabel = detailShelter ? getShelterKindLabel(detailShelter.kind, t) : null;

  if (showIdleState) {
    return (
      <div className="search-idle-state" role="status">
        <div className="search-idle-state-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Z" stroke="currentColor" strokeWidth="2" />
            <path d="m16 16 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <div className="search-idle-state-title">{t('search.idleTitle')}</div>
        <div className="search-idle-state-body">{t('search.idleBody')}</div>
      </div>
    );
  }

  if ((nearbyShelters.length === 0 && !sheltersLoading) || (displayedShelters.length === 0 && !sheltersLoading && showAccessibleOnly)) {
    return (
      <div className="info-message" role="status">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#1565C0" aria-hidden="true">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
        </svg>
        <span>{t('shelters.noSheltersFound')}</span>
      </div>
    );
  }

  if (sheltersLoading && nearbyShelters.length === 0) {
    return (
      <>
        <div className="divider" />
        <div className="shelter-list" role="status" aria-label={t('shelters.loading')}>
          {[0, 1, 2].map((index) => (
            <div key={index} className="shelter-skeleton" aria-hidden="true">
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
    );
  }

  if (nearbyShelters.length === 0) {
    return null;
  }

  return (
    <>
      <div className="divider" />
      <div className="shelter-list-header" id="shelter-list-label">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#0D47A1" aria-hidden="true">
          <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" />
          <path d="M12 6v8M8 10h8" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </svg>
        {emergencyMode || proximityMode ? t('shelters.nearYou') : `${t('shelters.alongRoute')} (${nearbyShelters.length})`}
      </div>

      {detailShelter && (
        <div className="shelter-detail-card" role="status" aria-live="polite">
          <div className="shelter-detail-header">
            <div className="shelter-detail-title-group">
              <div className="shelter-detail-title">{detailShelter.name}</div>
              <div className="shelter-detail-badges">
                {(emergencyMode || proximityMode) && detailShelter.recommendationReasonKey && (
                  <span className="shelter-detail-pill shelter-detail-pill--recommended">
                    {t('sort.recommended')}
                  </span>
                )}
                {detailShelter.isAccessible && (
                  <span className="shelter-detail-pill shelter-detail-pill--accessible">
                    {t('accessibility.accessible')}
                  </span>
                )}
                {detailKindLabel && (
                  <span className="shelter-detail-pill shelter-detail-pill--secondary">
                    {detailKindLabel}
                  </span>
                )}
              </div>
            </div>
            <div className="shelter-detail-metric">
              <span className="shelter-detail-metric-value">{detailShelter.distanceFromRoute}</span>
              <span className="shelter-detail-metric-label">{t('shelters.meter')}</span>
            </div>
          </div>
          {detailShelter.address && (
            <div className="shelter-detail-subtitle">
              {detailShelter.address}
            </div>
          )}
          <div className="shelter-detail-meta">
            <span className="shelter-detail-chip">
              {t('shelters.walkingTime').replace('{{minutes}}', String(detailShelter.walkingTimeMinutes))}
            </span>
            <span className="shelter-detail-chip">
              {detailOccupancyPct !== undefined
                ? `${t(getCapacityStatusKey(detailOccupancyPct))} · ${detailOccupancyPct}%`
                : t('capacity.unknown')}
            </span>
            {detailShelter.recommendationReasonKey && (
              <span className="shelter-detail-chip shelter-detail-chip--reason">
                {t('recommendation.label').replace('{{reason}}', t(detailShelter.recommendationReasonKey))}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="shelter-controls">
        <div className="sort-toggle" role="group" aria-label={t('sort.label')}>
          <span className="control-label">{t('sort.label')}:</span>
          {(emergencyMode || proximityMode) && (
            <button
              className={`sort-btn ${sortMode === 'recommended' ? 'active' : ''}`}
              onClick={() => onSortModeChange('recommended')}
              aria-pressed={sortMode === 'recommended'}
            >
              {t('sort.recommended')}
            </button>
          )}
          <button
            className={`sort-btn ${sortMode === 'distance' ? 'active' : ''}`}
            onClick={() => onSortModeChange('distance')}
            aria-pressed={sortMode === 'distance'}
          >
            {t('sort.distance')}
          </button>
          <button
            className={`sort-btn ${sortMode === 'walkingTime' ? 'active' : ''}`}
            onClick={() => onSortModeChange('walkingTime')}
            aria-pressed={sortMode === 'walkingTime'}
          >
            {t('sort.walkingTime')}
          </button>
        </div>
        <label className="accessibility-filter">
          <input
            type="checkbox"
            checked={showAccessibleOnly}
            onChange={(event) => onShowAccessibleOnlyChange(event.target.checked)}
          />
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
        {displayedShelters.map((shelter, index) => {
          const kindLabel = getShelterKindLabel(shelter.kind, t);
          const capData = capacityMap?.get(shelter.id);
          const occupancyPct = shelter.occupancyPercent ?? (capData && capData.capacity > 0
            ? Math.round((capData.currentOccupancy / capData.capacity) * 100)
            : undefined);
          const capColor = getCapacityColor(occupancyPct);
          const capStatus = getCapacityStatusKey(occupancyPct);
          const communityStatus = shelter.communityStatus ?? getAggregatedStatus(shelter.id);
          const statusIcon = capStatus === 'capacity.low' ? '\u2713'
            : capStatus === 'capacity.medium' ? '\u26A0'
            : capStatus === 'capacity.high' ? '!'
            : '?';
          const showRecommendation = (emergencyMode || proximityMode) && sortMode === 'recommended' && index === 0;
          const recommendationText = t('recommendation.label').replace(
            '{{reason}}',
            t(shelter.recommendationReasonKey)
          );
          const capacitySummary = occupancyPct !== undefined
            ? `${t(capStatus)} · ${occupancyPct}%`
            : t('capacity.unknown');
          const walkingTimeLabel = t('shelters.walkingTime').replace('{{minutes}}', String(shelter.walkingTimeMinutes));
          const floorLabel = shelter.floorLevel !== undefined
            ? shelter.floorLevel === 0
              ? t('accessibility.groundFloor')
              : t('accessibility.floor').replace('{{level}}', String(shelter.floorLevel))
            : null;

          return (
            <button
              key={shelter.id}
              className={`shelter-item ${selectedShelterId === shelter.id ? 'selected' : ''} ${showRecommendation ? 'shelter-item-recommended' : ''}`}
              onClick={() => onShelterClick?.(shelter)}
              role="listitem"
              aria-label={`${shelter.name}, ${shelter.distanceFromRoute} ${t('shelters.meters')}, ${walkingTimeLabel}`}
              aria-pressed={selectedShelterId === shelter.id}
            >
              <div className="shelter-item-icon" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#1565C0">
                  <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" />
                  <path d="M12 7v6M9 10h6" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div className="shelter-item-info">
                <div className="shelter-item-topline">
                  <div className="shelter-item-title-group">
                    <div className="shelter-item-name">{shelter.name}</div>
                    <div className="shelter-item-badges">
                      {kindLabel && (
                        <span className="shelter-kind-badge" aria-label={kindLabel} title={kindLabel}>
                          {kindLabel}
                        </span>
                      )}
                      {communityStatus && (
                        <span
                          className="shelter-community-badge"
                          style={{ backgroundColor: getStatusBadgeColor(communityStatus) }}
                          title={t(`report.${communityStatus === 'key-required' ? 'keyRequired' : communityStatus}`)}
                        >
                          {t(`report.${communityStatus === 'key-required' ? 'keyRequired' : communityStatus}`)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shelter-item-distance">
                    <span className="shelter-item-distance-value">{shelter.distanceFromRoute}</span>
                    <span className="shelter-item-distance-unit">{t('shelters.meter')}</span>
                  </div>
                </div>
                {showRecommendation && (
                  <div className="shelter-item-recommendation">
                    <span className="shelter-item-recommendation-badge">{t('sort.recommended')}</span>
                    <span>{recommendationText}</span>
                  </div>
                )}
                <div className="shelter-item-primary-metrics">
                  <span className="shelter-item-chip shelter-item-chip--walking">
                    {walkingTimeLabel}
                  </span>
                  {shelter.isAccessible && (
                    <span className="shelter-item-chip shelter-item-chip--accessible">
                      {t('accessibility.accessible')}
                    </span>
                  )}
                  {floorLabel && (
                    <span className="shelter-item-chip shelter-item-chip--secondary">
                      {floorLabel}
                    </span>
                  )}
                  <span className="shelter-item-chip shelter-item-chip--capacity" style={{ color: capColor }}>
                    <span className="capacity-status-icon" aria-hidden="true">{statusIcon}</span>
                    {capacitySummary}
                  </span>
                </div>
                <div className="shelter-item-secondary">
                  {shelter.address && (
                    <div className="shelter-item-address">{shelter.address}</div>
                  )}
                  <div className="capacity-bar-container" aria-label={occupancyPct !== undefined ? `${t('capacity.occupancy')}: ${occupancyPct}%` : t('capacity.unknown')}>
                    <div className="capacity-bar-track">
                      <div
                        className="capacity-bar-fill"
                        style={{
                          width: occupancyPct !== undefined ? `${occupancyPct}%` : '0%',
                          backgroundColor: capColor,
                        }}
                      />
                    </div>
                    <span className="capacity-bar-label" style={{ color: capColor }}>
                      <span className="capacity-status-icon" aria-hidden="true">{statusIcon}</span>
                      {occupancyPct !== undefined ? `${occupancyPct}%` : t('capacity.unknown')}
                      <span className="capacity-estimated-badge-sm" title={t('capacity.estimatedTooltip')}>
                        {t('capacity.estimated')}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="capacity-legend">
        <div className="capacity-legend-title">{t('capacity.legend')}</div>
        <div className="capacity-legend-items">
          <div className="capacity-legend-item">
            <span className="capacity-legend-dot" style={{ backgroundColor: '#4CAF50' }} />
            <span aria-hidden="true">{'\u2713'}</span>
            <span>{t('capacity.legendLow')}</span>
          </div>
          <div className="capacity-legend-item">
            <span className="capacity-legend-dot" style={{ backgroundColor: '#FF9800' }} />
            <span aria-hidden="true">{'\u26A0'}</span>
            <span>{t('capacity.legendMedium')}</span>
          </div>
          <div className="capacity-legend-item">
            <span className="capacity-legend-dot" style={{ backgroundColor: '#F44336' }} />
            <span aria-hidden="true">!</span>
            <span>{t('capacity.legendHigh')}</span>
          </div>
          <div className="capacity-legend-item">
            <span className="capacity-legend-dot" style={{ backgroundColor: '#9E9E9E' }} />
            <span aria-hidden="true">?</span>
            <span>{t('capacity.legendUnknown')}</span>
          </div>
        </div>
      </div>
    </>
  );
}

import { useLanguage } from '../i18n';
import type { RouteInfo } from '../types';
import type { RouteRiskAssessment } from '../services/alertHistoryService';
import type { TimeFilter } from '../hooks/useAlertHistory';
import type { SearchHistoryEntry } from '../types';

interface RouteSummaryProps {
  routeInfo: RouteInfo;
  sheltersLoading: boolean;
  nearbySheltersCount: number;
  routeRisk: RouteRiskAssessment | null;
  timeFilter: TimeFilter;
  onTimeFilterChange?: (hours: TimeFilter) => void;
  canShare: boolean;
  onShare: () => void;
  currentRouteEntry: SearchHistoryEntry | null;
  isRouteSaved: boolean;
  onSaveRoute: () => void;
  onUnsaveRoute: () => void;
}

export function RouteSummary({
  routeInfo,
  sheltersLoading,
  nearbySheltersCount,
  routeRisk,
  timeFilter,
  onTimeFilterChange,
  canShare,
  onShare,
  currentRouteEntry,
  isRouteSaved,
  onSaveRoute,
  onUnsaveRoute,
}: RouteSummaryProps) {
  const { t } = useLanguage();

  return (
    <div className="route-info" aria-label={t('route.details')}>
      <div className="route-info-header">{t('route.details')}</div>
      <div className="route-stats">
        <div className="stat">
          <span className="stat-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#757575">
              <circle cx="12" cy="12" r="9" stroke="#757575" strokeWidth="2" fill="none" />
              <path d="M12 7v5l3 3" stroke="#757575" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          <div>
            <div className="stat-value">{routeInfo.duration}</div>
          </div>
        </div>
        <div className="stat">
          <span className="stat-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#757575">
              <path d="M3 12h18M3 12l4-4M3 12l4 4M21 12l-4-4M21 12l-4 4" stroke="#757575" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          <div>
            <div className="stat-value">{routeInfo.distance}</div>
          </div>
        </div>
      </div>
      <div className="shelter-count" aria-live="polite">
        <div className="shelter-badge" aria-label={`${sheltersLoading ? t('shelters.loading') : nearbySheltersCount} ${t('route.sheltersLabel')}`}>
          {sheltersLoading ? '...' : nearbySheltersCount}
        </div>
        <span className="shelter-count-text">{t('route.sheltersAlongRoute')}</span>
      </div>
      {routeRisk && routeRisk.riskLevel !== 'none' && (
        <div
          className={`route-risk-section route-risk--${routeRisk.riskLevel}`}
          role="status"
          aria-live="polite"
          aria-label={t(`risk.${routeRisk.riskLevel}`)}
        >
          <div className="route-risk-row">
            <div className={`route-risk-badge route-risk-badge--${routeRisk.riskLevel}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                {routeRisk.riskLevel === 'high' ? (
                  <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
                ) : (
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                )}
              </svg>
              <span>{t(`risk.${routeRisk.riskLevel}`)}</span>
            </div>
          </div>
          <div className="route-risk-details">
            <span className="route-risk-text">
              {t('risk.alertCount')
                .replace('{{count}}', String(routeRisk.totalAlerts))
                .replace('{{hours}}', String(timeFilter))}
            </span>
            <div className="time-filter-toggle" role="group" aria-label={t('history.timeRange')}>
              {([1, 6, 24] as TimeFilter[]).map((hours) => (
                <button
                  key={hours}
                  className={`time-filter-btn ${timeFilter === hours ? 'active' : ''}`}
                  onClick={() => onTimeFilterChange?.(hours)}
                  aria-pressed={timeFilter === hours}
                >
                  {t(`history.${hours}h` as 'history.1h' | 'history.6h' | 'history.24h')}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {routeRisk && routeRisk.riskLevel === 'none' && (
        <div className="route-risk-section route-risk--none" role="status" aria-live="polite">
          <div className="route-risk-row">
            <div className="route-risk-badge route-risk-badge--none">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" />
                <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>{t('risk.none')}</span>
            </div>
          </div>
        </div>
      )}
      {canShare && (
        <button className="share-btn" onClick={onShare} aria-label={t('share.button')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M18 8a3 3 0 1 0-2.12-5.12M18 8a3 3 0 0 1-2.12-.88L8.12 11.88M18 8l-.88.88M6 14a3 3 0 1 0 2.12-1.12M6 14a3 3 0 0 1 2.12-1.12M6 14l.88-.88M18 20a3 3 0 1 0-2.12-1.12M18 20a3 3 0 0 1-2.12-1.12l-7.76-4.76" stroke="#1565C0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {t('share.button')}
        </button>
      )}
      {currentRouteEntry && !sheltersLoading && (
        <button
          className={`save-route-btn ${isRouteSaved ? 'saved' : ''}`}
          onClick={isRouteSaved ? onUnsaveRoute : onSaveRoute}
          aria-label={isRouteSaved ? t('savedRoutes.unsave') : t('savedRoutes.save')}
          aria-pressed={isRouteSaved}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"
              fill={isRouteSaved ? '#1565C0' : 'none'}
              stroke="#1565C0"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {isRouteSaved ? t('savedRoutes.saved') : t('savedRoutes.save')}
        </button>
      )}
    </div>
  );
}

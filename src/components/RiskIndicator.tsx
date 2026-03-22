import { useLanguage } from '../i18n';
import type { RouteRiskAssessment } from '../services/alertHistoryService';
import type { TimeFilter } from '../hooks/useAlertHistory';

export interface RiskIndicatorProps {
  routeRisk: RouteRiskAssessment | null;
  timeFilter: TimeFilter;
  onTimeFilterChange?: (hours: TimeFilter) => void;
}

export function RiskIndicator({
  routeRisk,
  timeFilter,
  onTimeFilterChange,
}: RiskIndicatorProps) {
  const { t } = useLanguage();

  if (!routeRisk) return null;

  if (routeRisk.riskLevel === 'none') {
    return (
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
    );
  }

  return (
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
          {([1, 6, 24] as TimeFilter[]).map((h) => (
            <button
              key={h}
              className={`time-filter-btn ${timeFilter === h ? 'active' : ''}`}
              onClick={() => onTimeFilterChange?.(h)}
              aria-pressed={timeFilter === h}
            >
              {t(`history.${h}h` as 'history.1h' | 'history.6h' | 'history.24h')}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

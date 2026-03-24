import { useState, useCallback, useEffect, useMemo } from 'react';
import { getAnalytics } from '../services/safetyAnalyticsService';
import { useLanguage } from '../i18n';

interface SafetyDashboardProps {
  presentation?: 'accordion' | 'section';
}

export function SafetyDashboard({ presentation = 'accordion' }: SafetyDashboardProps) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(presentation === 'section');

  const toggle = useCallback(() => setExpanded((v) => !v), []);

  useEffect(() => {
    if (presentation === 'section') {
      setExpanded(true);
    }
  }, [presentation]);

  const analytics = useMemo(() => {
    if (!expanded) return null;
    return getAnalytics();
  }, [expanded]);

  const maxShelterCount = useMemo(() => {
    if (!analytics) return 1;
    return Math.max(...analytics.recentShelterCounts, 1);
  }, [analytics]);

  const content = analytics && (
    <div className="safety-dashboard-content">
          <div className="safety-dashboard-stats">
            <div className="safety-dashboard-stat">
              <span className="safety-dashboard-stat-value">{analytics.totalRoutes}</span>
              <span className="safety-dashboard-stat-label">{t('dashboard.routesAnalyzed')}</span>
            </div>
            <div className="safety-dashboard-stat">
              <span className="safety-dashboard-stat-value">{analytics.averageSheltersPerRoute}</span>
              <span className="safety-dashboard-stat-label">{t('dashboard.avgShelters')}</span>
            </div>
            <div className="safety-dashboard-stat">
              <span className="safety-dashboard-stat-value">{analytics.totalEmergencies}</span>
              <span className="safety-dashboard-stat-label">{t('dashboard.emergencyActivations')}</span>
            </div>
          </div>
          {analytics.recentShelterCounts.length > 0 && (
            <div className="safety-dashboard-chart">
              <span className="safety-dashboard-chart-label">{t('dashboard.recentRoutes')}</span>
              <div className="safety-dashboard-bars" role="img" aria-label={t('dashboard.recentRoutes')}>
                {analytics.recentShelterCounts.map((count, i) => (
                  <div className="safety-dashboard-bar-wrapper" key={i}>
                    <div
                      className="safety-dashboard-bar"
                      style={{ height: `${Math.max((count / maxShelterCount) * 100, 4)}%` }}
                      title={`${count} ${t('dashboard.shelters')}`}
                    />
                    <span className="safety-dashboard-bar-label">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
    </div>
  );

  return (
    <section
      className={`safety-dashboard${presentation === 'section' ? ' safety-dashboard--section' : ''}`}
      aria-label={t('dashboard.title')}
    >
      {presentation === 'accordion' && (
        <button
          className="safety-dashboard-toggle"
          onClick={toggle}
          aria-expanded={expanded}
          type="button"
        >
          <span className="safety-dashboard-icon" aria-hidden="true">&#x1F4CA;</span>
          <span>{t('dashboard.title')}</span>
          <span className="safety-dashboard-chevron" aria-hidden="true">
            {expanded ? '\u25B2' : '\u25BC'}
          </span>
        </button>
      )}
      {expanded && content}
    </section>
  );
}

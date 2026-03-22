import { useLanguage } from '../i18n';
import type { RouteOption } from '../types';
import type { ShelterWithDistance } from '../hooks/useShelters';

interface NavigationPanelProps {
  shelter: ShelterWithDistance;
  route: RouteOption;
  onCancel: () => void;
}

export function NavigationPanel({ shelter, route, onCancel }: NavigationPanelProps) {
  const { language, t } = useLanguage();
  const dir = language === 'he' ? 'rtl' : 'ltr';

  const name = shelter.name || t('shelters.publicShelter');
  const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${shelter.lat},${shelter.lon}&travelmode=walking`;

  return (
    <div className="navigation-panel" style={{ direction: dir }} role="status" aria-live="polite">
      <div className="navigation-panel-content">
        <div className="navigation-panel-info">
          <div className="navigation-panel-label">{t('nav.walkingTo')}</div>
          <div className="navigation-panel-name">{name}</div>
          <div className="navigation-panel-stats">
            <span className="navigation-panel-stat">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" fill="none" />
                <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
              </svg>
              {route.duration}
            </span>
            <span className="navigation-panel-sep">|</span>
            <span className="navigation-panel-stat">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M3 12h18M3 12l4-4M3 12l4 4M21 12l-4-4M21 12l-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              {route.distance}
            </span>
          </div>
        </div>
        <div className="navigation-panel-actions">
          <button
            className="navigation-panel-cancel"
            onClick={onCancel}
            aria-label={t('nav.cancel')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
      <a
        href={navUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="navigation-panel-gmaps"
      >
        {t('nav.openGoogleMaps')}
      </a>
    </div>
  );
}

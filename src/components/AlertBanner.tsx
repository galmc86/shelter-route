import { useLanguage } from '../i18n';
import type { AlertRegion } from '../services/orefAlertService';

interface AlertBannerProps {
  matchedRegion: AlertRegion | null;
  countdown: number | null;
  onFindShelter: () => void;
  onDismiss: () => void;
}

export function AlertBanner({
  matchedRegion,
  countdown,
  onFindShelter,
  onDismiss,
}: AlertBannerProps) {
  const { language, t } = useLanguage();
  const isExpired = countdown !== null && countdown <= 0;
  const regionName = matchedRegion
    ? language === 'he' ? matchedRegion.name : matchedRegion.nameEn
    : '';

  return (
    <div className="alert-banner" role="alert" aria-live="assertive">
      <div className="alert-banner-content">
        <div className="alert-banner-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M1 21h22L12 2 1 21z"
              fill="#FFF"
              stroke="#FFF"
              strokeWidth="1"
            />
            <path
              d="M12 9v4M12 15v1"
              stroke="#D32F2F"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <div className="alert-banner-info">
          <div className="alert-banner-title">{t('alert.title')}</div>
          {regionName && (
            <div className="alert-banner-region">
              {t('alert.region')} {regionName}
            </div>
          )}
        </div>

        <div className="alert-banner-countdown-section">
          {isExpired ? (
            <div className="alert-banner-expired">{t('alert.expired')}</div>
          ) : countdown !== null ? (
            <>
              <div className="alert-banner-countdown-label">{t('alert.countdown')}</div>
              <div className="alert-banner-countdown">
                <span className="alert-banner-countdown-number">{countdown}</span>
                <span className="alert-banner-countdown-unit">{t('alert.seconds')}</span>
              </div>
            </>
          ) : null}
        </div>

        <div className="alert-banner-actions">
          <button
            className="alert-banner-find-btn"
            onClick={onFindShelter}
            aria-label={t('alert.findShelter')}
          >
            {t('alert.findShelter')}
          </button>
          <button
            className="alert-banner-dismiss-btn"
            onClick={onDismiss}
            aria-label={t('alert.dismiss')}
          >
            {t('alert.dismiss')}
          </button>
        </div>
      </div>
    </div>
  );
}

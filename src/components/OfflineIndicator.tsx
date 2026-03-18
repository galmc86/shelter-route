import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useServiceWorker } from '../hooks/useServiceWorker';
import { useLanguage } from '../i18n';

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  const { isUpdateAvailable, applyUpdate } = useServiceWorker();
  const { t } = useLanguage();

  return (
    <>
      {!isOnline && (
        <div className="offline-indicator" role="alert" aria-live="assertive">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {t('offline.indicator')}
        </div>
      )}
      {isUpdateAvailable && (
        <div className="sw-update-toast" role="alert">
          <span>{t('sw.updateAvailable')}</span>
          <button onClick={applyUpdate}>
            {t('sw.updateButton')}
          </button>
        </div>
      )}
    </>
  );
}

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useLanguage } from '../i18n';
import type { RouteInfo, RouteWithShelters, LatLng, TravelMode } from '../types';
import type { ShelterWithDistance } from '../utils/shelterDistance';

export interface RouteSelectorProps {
  routeInfo: RouteInfo | null;
  selectedRouteIndex: number;
  routesWithShelters: RouteWithShelters[];
  onRouteSelect?: (index: number) => void;
  nearbyShelters: ShelterWithDistance[];
  sheltersLoading: boolean;
  shareOrigin?: LatLng | null;
  shareDestination?: LatLng | null;
  shareTravelMode?: TravelMode;
}

export function RouteSelector(props: RouteSelectorProps) {
  const { routeInfo, selectedRouteIndex, routesWithShelters, onRouteSelect,
    nearbyShelters, sheltersLoading, shareOrigin, shareDestination, shareTravelMode } = props;
  const { t } = useLanguage();
  const [showCopiedToast, setShowCopiedToast] = useState(false);

  // Find the route index with the most shelters
  const bestRouteIndex = useMemo(() => {
    if (routesWithShelters.length <= 1) return 0;
    let maxCount = -1;
    let bestIdx = 0;
    routesWithShelters.forEach((rws, idx) => {
      if (rws.shelterCount > maxCount) {
        maxCount = rws.shelterCount;
        bestIdx = idx;
      }
    });
    return bestIdx;
  }, [routesWithShelters]);

  // Auto-hide copied toast after 2 seconds
  useEffect(() => {
    if (showCopiedToast) {
      const timer = setTimeout(() => setShowCopiedToast(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [showCopiedToast]);

  const handleShare = useCallback(async () => {
    if (!shareOrigin || !shareDestination) return;

    const params = new URLSearchParams({
      from: `${shareOrigin.lat},${shareOrigin.lng}`,
      to: `${shareDestination.lat},${shareDestination.lng}`,
      mode: shareTravelMode || 'WALKING',
    });

    const shareUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    const shelterCount = nearbyShelters.length;
    const shareText = t('share.text').replace('{{count}}', String(shelterCount));

    if (navigator.share) {
      try {
        await navigator.share({
          title: t('share.title'),
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch {
        // User cancelled or share failed, fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setShowCopiedToast(true);
    } catch {
      // Clipboard API not available, show URL in alert as last resort
      alert(shareUrl);
    }
  }, [shareOrigin, shareDestination, shareTravelMode, nearbyShelters.length, t]);

  return (
    <>
      {/* Route Selector -- show when multiple alternatives exist */}
      {routesWithShelters.length > 1 && (
        <>
          <div className="divider" />
          <div className="route-selector" role="radiogroup" aria-label={t('routes.selectRoute')}>
            <div className="route-selector-header">{t('routes.alternativeRoutes')}</div>
            {routesWithShelters.map((rws, idx) => {
              const isSelected = idx === selectedRouteIndex;
              const isBest = idx === bestRouteIndex;
              return (
                <button
                  key={idx}
                  className={`route-option ${isSelected ? 'route-option-selected' : ''} ${isBest ? 'route-option-best' : ''}`}
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => onRouteSelect?.(idx)}
                  aria-label={`${t('routes.route')} ${idx + 1}, ${rws.route.distance}, ${rws.route.duration}, ${rws.shelterCount} ${t('route.sheltersLabel')}`}
                >
                  <div className="route-option-header">
                    <span className="route-option-number">{t('routes.route')} {idx + 1}</span>
                    {rws.route.isFastest && (
                      <span className="route-option-fastest-badge">{t('routes.fastest')}</span>
                    )}
                    {isBest && (
                      <span className="route-option-best-badge">{t('routes.mostShelters')}</span>
                    )}
                  </div>
                  <div className="route-option-details">
                    <span className="route-option-stat">{rws.route.distance}</span>
                    <span className="route-option-separator">|</span>
                    <span className="route-option-stat">{rws.route.duration}</span>
                    <span className="route-option-separator">|</span>
                    <span className="route-option-shelters">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" />
                      </svg>
                      {rws.shelterCount} {t('route.sheltersLabel')}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Route Info */}
      {routeInfo && (
        <>
          <div className="divider" />
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
              <div className="shelter-badge" aria-label={`${sheltersLoading ? t('shelters.loading') : nearbyShelters.length} ${t('route.sheltersLabel')}`}>
                {sheltersLoading ? '...' : nearbyShelters.length}
              </div>
              <span className="shelter-count-text">{t('route.sheltersAlongRoute')}</span>
            </div>
            {shareOrigin && shareDestination && (
              <button className="share-btn" onClick={handleShare} aria-label={t('share.button')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M18 8a3 3 0 1 0-2.12-5.12M18 8a3 3 0 0 1-2.12-.88L8.12 11.88M18 8l-.88.88M6 14a3 3 0 1 0 2.12-1.12M6 14a3 3 0 0 1 2.12-1.12M6 14l.88-.88M18 20a3 3 0 1 0-2.12-1.12M18 20a3 3 0 0 1-2.12-1.12l-7.76-4.76" stroke="#1565C0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {t('share.button')}
              </button>
            )}
          </div>
        </>
      )}

      {/* Copied Toast */}
      {showCopiedToast && (
        <div className="copied-toast" role="status" aria-live="polite">
          {t('share.copied')}
        </div>
      )}

      {/* No shelters message (route exists but no shelters found) */}
      {routeInfo && !sheltersLoading && nearbyShelters.length === 0 && (
        <div className="info-message" role="status">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#1565C0" aria-hidden="true">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
          </svg>
          <span>{t('shelters.noSheltersFound')}</span>
        </div>
      )}
    </>
  );
}

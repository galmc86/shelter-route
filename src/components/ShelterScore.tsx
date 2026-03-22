import { useMemo, useState, useCallback } from 'react';
import { useLanguage } from '../i18n';
import { computeShelterScore } from '../services/shelterScoreService';
import type { Shelter } from '../types';

interface ShelterScoreProps {
  lat: number;
  lng: number;
  shelters: Shelter[];
  addressName?: string;
}

export function ShelterScore({ lat, lng, shelters, addressName }: ShelterScoreProps) {
  const { t } = useLanguage();
  const [showCopied, setShowCopied] = useState(false);

  const result = useMemo(
    () => computeShelterScore(lat, lng, shelters),
    [lat, lng, shelters],
  );

  const walkTimeDisplay = useMemo(() => {
    if (result.nearestWalkTime >= 9999) return '--';
    const mins = Math.ceil(result.nearestWalkTime / 60);
    return `${mins}`;
  }, [result.nearestWalkTime]);

  const handleShare = useCallback(async () => {
    const loc = addressName || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    const text = t('shelterScore.richShareText')
      .replace('{{grade}}', result.grade)
      .replace('{{score}}', String(result.score))
      .replace('{{count}}', String(result.sheltersNearby))
      .replace('{{location}}', loc);
    const shareUrl = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title: t('shelterScore.title'), text, url: shareUrl });
        return;
      } catch {
        // Fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    } catch {
      // Clipboard not available
    }
  }, [addressName, lat, lng, result, t]);

  // SVG circle progress
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (result.score / 100) * circumference;

  return (
    <div className="shelter-score" role="region" aria-label={t('shelterScore.title')}>
      <div className="shelter-score-header">
        <div className="shelter-score-title">{t('shelterScore.title')}</div>
        {addressName && (
          <div className="shelter-score-address">{addressName}</div>
        )}
      </div>

      <div className="shelter-score-main">
        {/* Grade circle */}
        <div className="shelter-score-circle" aria-label={`${t('shelterScore.grade')}: ${result.grade}, ${result.score}/100`}>
          <svg width="90" height="90" viewBox="0 0 90 90">
            <circle
              cx="45"
              cy="45"
              r={radius}
              fill="none"
              stroke="var(--color-divider, #eee)"
              strokeWidth="6"
            />
            <circle
              cx="45"
              cy="45"
              r={radius}
              fill="none"
              stroke={result.color}
              strokeWidth="6"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              transform="rotate(-90 45 45)"
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
          </svg>
          <div className="shelter-score-grade" style={{ color: result.color }}>
            {result.grade}
          </div>
          <div className="shelter-score-value">{result.score}/100</div>
        </div>

        {/* Factors breakdown */}
        <div className="shelter-score-factors">
          <div className="shelter-score-factor">
            <span className="shelter-score-factor-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--color-primary, #1565C0)">
                <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" />
              </svg>
            </span>
            <span className="shelter-score-factor-label">{t('shelterScore.nearbyShelters')}</span>
            <span className="shelter-score-factor-value">{result.sheltersNearby}</span>
          </div>
          <div className="shelter-score-factor">
            <span className="shelter-score-factor-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--color-primary, #1565C0)">
                <path d="M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z" />
              </svg>
            </span>
            <span className="shelter-score-factor-label">{t('shelterScore.nearestWalkTime')}</span>
            <span className="shelter-score-factor-value">
              {result.nearestDistance < 9999
                ? `${walkTimeDisplay} ${t('capacity.minutes')}`
                : '--'}
            </span>
          </div>
          <div className="shelter-score-factor">
            <span className="shelter-score-factor-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--color-primary, #1565C0)">
                <circle cx="12" cy="4" r="2" />
                <path d="M19 13v-2c-1.54.02-3.09-.75-4.07-1.83l-1.29-1.43c-.17-.19-.38-.34-.61-.45H13c-.35-.2-.75-.3-1.19-.26C10.76 7.11 10 8.04 10 9.09V15c0 1.1.9 2 2 2h5v5h2v-5.5c0-1.1-.9-2-2-2h-3v-3.45c1.29 1.07 3.25 1.94 5 1.95z" />
              </svg>
            </span>
            <span className="shelter-score-factor-label">{t('shelterScore.accessibleShelters')}</span>
            <span className="shelter-score-factor-value">{result.accessibleCount}</span>
          </div>
          <div className="shelter-score-factor">
            <span className="shelter-score-factor-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--color-primary, #1565C0)">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" />
              </svg>
            </span>
            <span className="shelter-score-factor-label">{t('shelterScore.nearestDistance')}</span>
            <span className="shelter-score-factor-value">
              {result.nearestDistance < 9999
                ? `${result.nearestDistance} ${t('shelters.meter')}`
                : '--'}
            </span>
          </div>
        </div>
      </div>

      {/* Share button */}
      <button className="shelter-score-share-btn" onClick={handleShare}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M18 8a3 3 0 1 0-2.12-5.12M18 8a3 3 0 0 1-2.12-.88L8.12 11.88M6 14a3 3 0 1 0 2.12-1.12M6 14l.88-.88M18 20a3 3 0 1 0-2.12-1.12l-7.76-4.76" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {showCopied ? t('share.copied') : t('shelterScore.share')}
      </button>
    </div>
  );
}

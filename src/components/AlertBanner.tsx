import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../i18n';
import './AlertBanner.css';
import type { AlertRegion } from '../services/orefAlertService';
import { useFamilyGroupState } from '../hooks/useFamilyGroupState';

interface AlertBannerProps {
  matchedRegion: AlertRegion | null;
  countdown: number | null;
  onFindShelter: () => void;
  onDismiss: () => void;
  isAlertActive: boolean;
  emergencyMode?: boolean;
}

const DEBRIEF_DURATION = 600; // 10 minutes in seconds

const EMERGENCY_CONTACTS = [
  { number: '100', labelKey: 'alert.police' as const },
  { number: '101', labelKey: 'alert.mda' as const },
  { number: '102', labelKey: 'alert.fire' as const },
  { number: '104', labelKey: 'alert.homeFrontCommand' as const },
];

function formatMinutesSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function FloatingCountdownBadge({
  countdown,
  totalTime,
  visible,
  onFindShelter,
}: {
  countdown: number;
  totalTime: number;
  visible: boolean;
  onFindShelter: () => void;
}) {
  const size = 60;
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = totalTime > 0 ? countdown / totalTime : 0;
  const dashOffset = circumference * (1 - progress);

  return (
    <button
      className={`floating-countdown-badge${visible ? ' floating-countdown-badge--visible' : ''}`}
      onClick={onFindShelter}
      aria-label={`${countdown} seconds remaining. Tap to find shelter.`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="floating-countdown-ring"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="#D32F2F"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <span className="floating-countdown-number">{countdown}</span>
    </button>
  );
}

function DebriefScreen({
  onDismiss,
  hasFamilyGroup,
  isFamilySafe,
  onMarkSafe,
}: {
  onDismiss: () => void;
  hasFamilyGroup: boolean;
  isFamilySafe: boolean;
  onMarkSafe: () => void;
}) {
  const { t } = useLanguage();
  const [debriefCountdown, setDebriefCountdown] = useState(DEBRIEF_DURATION);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setDebriefCountdown((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleDismiss = useCallback(() => {
    if (hasFamilyGroup && !isFamilySafe) {
      onMarkSafe();
    }
    onDismiss();
  }, [hasFamilyGroup, isFamilySafe, onDismiss, onMarkSafe]);

  return (
    <div className="alert-banner alert-banner--debrief" role="alert" aria-live="polite">
      <div className="alert-banner-content alert-banner-content--debrief">
        <div className="debrief-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"
              fill="#FFFFFF"
              opacity="0.2"
            />
            <path
              d="M9 12l2 2 4-4"
              stroke="#FFFFFF"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </div>

        <div className="debrief-main">
          <div className="debrief-title">{t('alert.staySheltered')}</div>
          <div className="debrief-subtitle">{t('alert.remainInShelter')}</div>

          <div className="debrief-countdown-section">
            <span className="debrief-countdown-time">
              {formatMinutesSeconds(debriefCountdown)}
            </span>
            <span className="debrief-countdown-label">
              {t('alert.minutesRemaining')}
            </span>
          </div>

          <div className="debrief-actions">
            <button
              className="debrief-safe-btn"
              onClick={handleDismiss}
              aria-label={t('alert.imSafe')}
            >
              {t('alert.imSafe')}
            </button>
          </div>

          {hasFamilyGroup && (
            <div className="debrief-family-note">
              {isFamilySafe ? t('family.alertSafeShared') : t('family.alertCheckInNeeded')}
            </div>
          )}

          <div className="debrief-help-section">
            <div className="debrief-help-title">{t('alert.needHelp')}</div>
            <div className="debrief-hotlines">
              {EMERGENCY_CONTACTS.map(({ number, labelKey }) => (
                <a
                  key={number}
                  href={`tel:${number}`}
                  className="debrief-hotline-link"
                  aria-label={`${t(labelKey)} ${number}`}
                >
                  <span className="debrief-hotline-number">{number}</span>
                  <span className="debrief-hotline-label">{t(labelKey)}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AlertBanner({
  matchedRegion,
  countdown,
  onFindShelter,
  onDismiss,
  isAlertActive,
  emergencyMode = false,
}: AlertBannerProps) {
  const { language, t } = useLanguage();
  const isExpired = countdown !== null && countdown <= 0;
  const regionName = matchedRegion
    ? language === 'he' ? matchedRegion.name : (matchedRegion.nameEn || matchedRegion.name)
    : '';

  const bannerRef = useRef<HTMLDivElement>(null);
  const [bannerVisible, setBannerVisible] = useState(true);
  const previousAlertActive = useRef(false);
  const {
    hasGroup: hasFamilyGroup,
    isCurrentMemberSafe: familyCheckInSafe,
    markNeedsCheckIn,
    markFamilySafe,
  } = useFamilyGroupState();

  useEffect(() => {
    const el = bannerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setBannerVisible(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isAlertActive && !previousAlertActive.current && hasFamilyGroup) {
      markNeedsCheckIn();
    }

    previousAlertActive.current = isAlertActive;
  }, [hasFamilyGroup, isAlertActive, markNeedsCheckIn]);

  const totalTime = matchedRegion?.timeToShelter ?? 0;
  const showBadge = isAlertActive && !bannerVisible && countdown !== null && countdown > 0;
  const ctaLabel = emergencyMode ? t('alert.refreshShelter') : t('alert.openShelter');
  const ctaHint = emergencyMode ? t('alert.actionHintActive') : t('alert.actionHintFallback');

  // Show debrief screen when countdown expires
  if (isExpired) {
    return (
      <DebriefScreen
        onDismiss={onDismiss}
        hasFamilyGroup={hasFamilyGroup}
        isFamilySafe={familyCheckInSafe}
        onMarkSafe={markFamilySafe}
      />
    );
  }

  return (
    <>
      <div className="alert-banner" role="alert" aria-live="assertive" ref={bannerRef}>
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
            {countdown !== null ? (
              <>
                <div className="alert-banner-countdown-label">{t('alert.countdown')}</div>
                <div className="alert-banner-countdown">
                  <span className="alert-banner-countdown-number">{countdown}</span>
                  <span className="alert-banner-countdown-unit">{t('alert.seconds')}</span>
                </div>
              </>
            ) : null}
          </div>

          <div className="alert-banner-actions alert-banner-actions--countdown">
            <div className="alert-banner-action-stack">
              <button
                className="alert-banner-find-btn"
                onClick={onFindShelter}
                aria-label={ctaLabel}
              >
                {ctaLabel}
              </button>
              <div className="alert-banner-action-hint">{ctaHint}</div>
              {hasFamilyGroup && (
                <div className="alert-banner-family-row">
                  <span className={`alert-banner-family-status ${familyCheckInSafe ? 'is-safe' : 'is-pending'}`}>
                    {familyCheckInSafe ? t('family.alertSafeShared') : t('family.alertCheckInNeeded')}
                  </span>
                  <button
                    className={`alert-banner-safe-btn ${familyCheckInSafe ? 'is-safe' : ''}`}
                    type="button"
                    onClick={markFamilySafe}
                  >
                    {familyCheckInSafe ? t('family.markedSafe') : t('alert.imSafe')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {isAlertActive && countdown !== null && countdown > 0 && (
        <FloatingCountdownBadge
          countdown={countdown}
          totalTime={totalTime}
          visible={showBadge}
          onFindShelter={onFindShelter}
        />
      )}
    </>
  );
}

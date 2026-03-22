import { useState, useCallback, type ReactNode } from 'react';
import { useLanguage } from '../i18n';

export type ShelterStatus = 'open' | 'locked' | 'crowded' | 'needsKey' | 'damaged' | 'empty';

interface ShelterStatusReportProps {
  shelterId: string;
  shelterName: string;
  onClose?: () => void;
}

const STORAGE_KEY = 'shelter-status-reports';

function saveReport(shelterId: string, status: ShelterStatus) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const reports = raw ? JSON.parse(raw) : [];
    reports.unshift({ shelterId, status, timestamp: Date.now() });
    // Keep last 100 reports
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports.slice(0, 100)));
  } catch {
    // ignore
  }
}

const STATUS_ICONS: Record<ShelterStatus, ReactNode> = {
  open: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 12l2 2 4-4" stroke="#2E7D32" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="12" cy="12" r="9" stroke="#2E7D32" strokeWidth="2"/>
    </svg>
  ),
  locked: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" stroke="#E65100" strokeWidth="2"/>
      <path d="M8 11V7a4 4 0 118 0v4" stroke="#E65100" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  crowded: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="7" r="2.5" stroke="#C62828" strokeWidth="1.8"/>
      <circle cx="15" cy="7" r="2.5" stroke="#C62828" strokeWidth="1.8"/>
      <path d="M4 21v-2a4 4 0 014-4h2" stroke="#C62828" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M20 21v-2a4 4 0 00-4-4h-2" stroke="#C62828" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  ),
  needsKey: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="8" cy="15" r="5" stroke="#F57F17" strokeWidth="2"/>
      <path d="M12 11l8-8M17 3l3 3M15 6l2 2" stroke="#F57F17" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  damaged: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2L1 21h22L12 2z" stroke="#D32F2F" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M12 9v4M12 16v1" stroke="#D32F2F" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  ),
  empty: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 7l9-4 9 4v10l-9 4-9-4V7z" stroke="#1565C0" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M9 12h6" stroke="#1565C0" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
};

export function ShelterStatusReport({ shelterId, shelterName, onClose }: ShelterStatusReportProps) {
  const { t } = useLanguage();
  const [submitted, setSubmitted] = useState(false);

  const handleReport = useCallback(
    (status: ShelterStatus) => {
      saveReport(shelterId, status);
      setSubmitted(true);
      setTimeout(() => {
        onClose?.();
      }, 1500);
    },
    [shelterId, onClose]
  );

  if (submitted) {
    return (
      <div className="status-report-section">
        <div className="status-report-thanks">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 12l2 2 4-4" stroke="#2E7D32" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="12" cy="12" r="9" stroke="#2E7D32" strokeWidth="2"/>
          </svg>
          {t('shelterStatus.thankYou')}
        </div>
      </div>
    );
  }

  const statuses: ShelterStatus[] = ['open', 'locked', 'crowded', 'needsKey', 'damaged', 'empty'];

  return (
    <div className="status-report-section">
      <div className="status-report-header">
        <span>{t('shelterStatus.reportTitle')}</span>
        {onClose && (
          <button className="status-report-close" onClick={onClose} aria-label={t('bugReport.close')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        )}
      </div>
      <div className="status-report-subtitle">{shelterName}</div>
      <div className="status-report-grid">
        {statuses.map((status) => (
          <button
            key={status}
            className={`status-report-btn status-report-btn--${status}`}
            onClick={() => handleReport(status)}
            aria-label={t(`shelterStatus.${status}` as 'shelterStatus.open')}
          >
            <span className="status-report-btn-icon">{STATUS_ICONS[status]}</span>
            <span className="status-report-btn-label">
              {t(`shelterStatus.${status}` as 'shelterStatus.open')}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

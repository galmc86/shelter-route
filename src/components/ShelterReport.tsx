import { useState } from 'react';
import { useLanguage, type TranslationKey } from '../i18n';
import { addReport } from '../services/shelterReportsService';
import type { ShelterReportStatus } from '../services/shelterReportsService';

interface ShelterReportProps {
  shelterId: string;
  onClose: () => void;
}

const STATUS_OPTIONS: { status: ShelterReportStatus; icon: string; labelKey: TranslationKey }[] = [
  { status: 'open', icon: '\u2705', labelKey: 'report.open' },
  { status: 'locked', icon: '\uD83D\uDD12', labelKey: 'report.locked' },
  { status: 'crowded', icon: '\uD83D\uDC65', labelKey: 'report.crowded' },
  { status: 'empty', icon: '\uD83D\uDCED', labelKey: 'report.empty' },
  { status: 'damaged', icon: '\u26A0\uFE0F', labelKey: 'report.damaged' },
  { status: 'key-required', icon: '\uD83D\uDD11', labelKey: 'report.keyRequired' },
];

export function ShelterReport({ shelterId, onClose }: ShelterReportProps) {
  const { t } = useLanguage();
  const [submitted, setSubmitted] = useState(false);

  const handleReport = (status: ShelterReportStatus) => {
    addReport(shelterId, status);
    setSubmitted(true);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  if (submitted) {
    return (
      <div className="shelter-report-thanks">
        {t('report.thanks')}
      </div>
    );
  }

  return (
    <div className="shelter-report-form">
      <div className="shelter-report-title">{t('report.title')}</div>
      <div className="shelter-report-buttons">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.status}
            className="shelter-report-btn"
            onClick={() => handleReport(opt.status)}
            type="button"
          >
            <span className="shelter-report-btn-icon" aria-hidden="true">{opt.icon}</span>
            <span className="shelter-report-btn-label">{t(opt.labelKey)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

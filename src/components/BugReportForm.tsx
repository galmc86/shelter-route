import { useState, useCallback } from 'react';
import { useLanguage } from '../i18n';
import { useTheme } from '../theme';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { queueReport, flushQueue } from '../services/bugReportService';
import type { BugReport } from '../services/bugReportService';

interface BugReportFormProps {
  open: boolean;
  onClose: () => void;
}

const CATEGORIES: BugReport['category'][] = [
  'shelter-data',
  'routing',
  'alerts',
  'ui',
  'other',
];

export function BugReportForm({ open, onClose }: BugReportFormProps) {
  const { language, t } = useLanguage();
  const { theme } = useTheme();
  const isOnline = useOnlineStatus();
  const [category, setCategory] = useState<BugReport['category']>('other');
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!description.trim()) return;

      queueReport({
        category,
        description: description.trim(),
        timestamp: Date.now(),
        context: {
          language,
          theme,
          userAgent: navigator.userAgent,
          online: isOnline,
          url: window.location.href,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
          },
        },
      });

      // Try to send immediately if online
      if (isOnline) {
        flushQueue().catch(() => {});
      }

      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setDescription('');
        setCategory('other');
        onClose();
      }, 2000);
    },
    [category, description, language, theme, isOnline, onClose]
  );

  if (!open) return null;

  return (
    <div className="bug-report-overlay" onClick={onClose}>
      <div
        className="bug-report-dialog"
        dir={language === 'he' ? 'rtl' : 'ltr'}
        role="dialog"
        aria-modal="true"
        aria-label={t('bugReport.title')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bug-report-header">
          <h2 className="bug-report-title">{t('bugReport.title')}</h2>
          <button
            className="bug-report-close-btn"
            onClick={onClose}
            aria-label={t('bugReport.close')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        {submitted ? (
          <div className="bug-report-success">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="#4CAF50">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            <p>{t('bugReport.thankYou')}</p>
            {!isOnline && (
              <p className="bug-report-offline-note">
                {t('bugReport.queuedOffline')}
              </p>
            )}
          </div>
        ) : (
          <form className="bug-report-form" onSubmit={handleSubmit}>
            <label className="bug-report-label">
              {t('bugReport.categoryLabel')}
            </label>
            <div className="bug-report-categories">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`bug-report-category-btn${category === cat ? ' active' : ''}`}
                  onClick={() => setCategory(cat)}
                >
                  {t(`bugReport.category.${cat}` as Parameters<typeof t>[0])}
                </button>
              ))}
            </div>

            <label className="bug-report-label" htmlFor="bug-description">
              {t('bugReport.descriptionLabel')}
            </label>
            <textarea
              id="bug-description"
              className="bug-report-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('bugReport.descriptionPlaceholder')}
              rows={4}
              required
            />

            <div className="bug-report-actions">
              <button
                type="button"
                className="bug-report-cancel-btn"
                onClick={onClose}
              >
                {t('bugReport.cancel')}
              </button>
              <button
                type="submit"
                className="bug-report-submit-btn"
                disabled={!description.trim()}
              >
                {t('bugReport.submit')}
              </button>
            </div>

            {!isOnline && (
              <p className="bug-report-offline-note">
                {t('bugReport.offlineNote')}
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

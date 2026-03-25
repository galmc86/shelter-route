import React, { useState, useCallback, Suspense, useMemo, type ChangeEvent } from 'react';
import { useLanguage } from '../i18n';
import './AppHeader.css';
import { useTheme } from '../theme';
import { useShelterDataStatus } from '../hooks/useShelterDataStatus';
import type { Language } from '../i18n/translations';

const BugReportForm = React.lazy(() => import('./BugReportForm').then(m => ({ default: m.BugReportForm })));

const languageLabels: Record<Language, string> = {
  he: 'עברית',
  en: 'English',
  ar: 'العربية',
  ru: 'Русский',
};

export function AppHeader() {
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { dataAgeDays, isStale } = useShelterDataStatus();
  const [bugReportOpen, setBugReportOpen] = useState(false);

  const handleLanguageChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      setLanguage(e.target.value as Language);
    },
    [setLanguage]
  );

  const handleOpenBugReport = useCallback(() => setBugReportOpen(true), []);
  const handleCloseBugReport = useCallback(() => setBugReportOpen(false), []);

  const dataAgeLabel = useMemo(() => {
    if (dataAgeDays === null) return null;
    if (dataAgeDays === 0) return t('data.updatedToday');
    return t('data.updatedDaysAgo').replace('{days}', String(dataAgeDays));
  }, [dataAgeDays, t]);

  const themeAriaLabel =
    theme === 'light'
      ? t('theme.toggleDark')
      : theme === 'dark'
        ? t('theme.toggleHighContrast')
        : t('theme.toggleLight');

  return (
    <>
      <header className="header">
        <div className="header-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" fill="white" opacity="0.9"/>
            <path d="M12 6v8M8 10h8" stroke="#1565C0" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <div>
          <h1 className="header-title">{t('header.title')}</h1>
          <span className="header-subtitle">{t('header.subtitle')}</span>
          {dataAgeLabel && (
            <span
              className={`header-data-age${isStale ? ' header-data-age--stale' : ''}`}
              title={isStale ? t('data.stale') : undefined}
            >
              {isStale ? t('data.stale') : dataAgeLabel}
            </span>
          )}
        </div>
        <div className="header-actions">
          <button
            className="bug-report-btn"
            onClick={handleOpenBugReport}
            aria-label={t('bugReport.button')}
            title={t('bugReport.button')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="white"/>
            </svg>
          </button>
          <button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            aria-label={themeAriaLabel}
            title={themeAriaLabel}
          >
            {theme === 'light' ? (
              /* Moon icon — click to go to dark */
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" fill="white"/>
              </svg>
            ) : theme === 'dark' ? (
              /* Eye/contrast icon — click to go to high-contrast */
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="2"/>
                <path d="M12 3a9 9 0 0 1 0 18V3z" fill="white"/>
              </svg>
            ) : (
              /* Sun icon — click to go to light */
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="5" fill="white"/>
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            )}
          </button>
          <select
            className="lang-select"
            value={language}
            onChange={handleLanguageChange}
            aria-label="Select language"
          >
            {(Object.keys(languageLabels) as Language[]).map((lang) => (
              <option key={lang} value={lang}>
                {languageLabels[lang]}
              </option>
            ))}
          </select>
        </div>
      </header>
      <Suspense fallback={null}>
        <BugReportForm open={bugReportOpen} onClose={handleCloseBugReport} />
      </Suspense>
    </>
  );
}

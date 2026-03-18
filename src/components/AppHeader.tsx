import { useLanguage } from '../i18n';
import { useTheme } from '../theme';

export function AppHeader() {
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  const toggleLanguage = () => {
    setLanguage(language === 'he' ? 'en' : 'he');
  };

  const themeAriaLabel =
    theme === 'light'
      ? t('theme.toggleDark')
      : theme === 'dark'
        ? t('theme.toggleHighContrast')
        : t('theme.toggleLight');

  return (
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
      </div>
      <div className="header-actions">
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
        <button
          className="lang-toggle-btn"
          onClick={toggleLanguage}
          aria-label={language === 'he' ? 'Switch to English' : 'החלף לעברית'}
        >
          {language === 'he' ? 'EN' : 'עב'}
        </button>
      </div>
    </header>
  );
}

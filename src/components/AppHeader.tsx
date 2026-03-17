import { useLanguage } from '../i18n';

export function AppHeader() {
  const { language, setLanguage, t } = useLanguage();

  const toggleLanguage = () => {
    setLanguage(language === 'he' ? 'en' : 'he');
  };

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
      <button
        className="lang-toggle-btn"
        onClick={toggleLanguage}
        aria-label={language === 'he' ? 'Switch to English' : 'החלף לעברית'}
      >
        {language === 'he' ? 'EN' : 'עב'}
      </button>
    </header>
  );
}

import { useState, useCallback } from 'react';
import { useLanguage } from '../i18n';

const ONBOARDING_STORAGE_KEY = 'shelter-route:onboarding-completed';

interface OnboardingProps {
  onComplete: () => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const { t, language } = useLanguage();
  const [step, setStep] = useState(0);
  const [locationGranted, setLocationGranted] = useState(false);
  const totalSteps = 3;

  const handleGrantLocation = useCallback(() => {
    navigator.geolocation.getCurrentPosition(
      () => {
        setLocationGranted(true);
      },
      () => {
        // Permission denied or error — user can still continue
      }
    );
  }, []);

  const handleComplete = useCallback(() => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    onComplete();
  }, [onComplete]);

  const handleNext = useCallback(() => {
    if (step < totalSteps - 1) {
      setStep((s) => s + 1);
    } else {
      handleComplete();
    }
  }, [step, handleComplete]);

  const handleSkip = useCallback(() => {
    handleComplete();
  }, [handleComplete]);

  const stepIndicator = t('onboarding.step')
    .replace('{{current}}', String(step + 1))
    .replace('{{total}}', String(totalSteps));

  const isRtl = language !== 'en' && language !== 'ru';

  return (
    <div className="onboarding-overlay" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="onboarding-card" role="dialog" aria-modal="true" aria-label={stepIndicator}>
        <div className="onboarding-progress">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div
              key={i}
              className={`onboarding-dot${i === step ? ' onboarding-dot-active' : ''}${i < step ? ' onboarding-dot-completed' : ''}`}
            />
          ))}
        </div>

        <div className="onboarding-step-container">
          {step === 0 && (
            <div className="onboarding-step">
              <div className="onboarding-icon">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#1565C0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </div>
              <h2 className="onboarding-title">{t('onboarding.welcomeTitle')}</h2>
              <p className="onboarding-desc">{t('onboarding.welcomeDesc')}</p>
            </div>
          )}

          {step === 1 && (
            <div className="onboarding-step">
              <div className="onboarding-icon">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#1565C0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <h2 className="onboarding-title">{t('onboarding.locationTitle')}</h2>
              <p className="onboarding-desc">{t('onboarding.locationDesc')}</p>
              <button
                className={`onboarding-location-btn${locationGranted ? ' onboarding-location-granted' : ''}`}
                onClick={handleGrantLocation}
                disabled={locationGranted}
                type="button"
              >
                {locationGranted ? (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {t('onboarding.locationGranted')}
                  </>
                ) : (
                  t('onboarding.grantLocation')
                )}
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="onboarding-step">
              <div className="onboarding-icon onboarding-icon-emergency">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="#E53935">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
              </div>
              <h2 className="onboarding-title">{t('onboarding.emergencyTitle')}</h2>
              <p className="onboarding-desc">{t('onboarding.emergencyDesc')}</p>
              <div className="onboarding-emergency-preview">
                <div className="onboarding-emergency-btn-preview">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                  </svg>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="onboarding-actions">
          {step < totalSteps - 1 ? (
            <>
              <button className="onboarding-btn-skip" onClick={handleSkip} type="button">
                {t('onboarding.skip')}
              </button>
              <button className="onboarding-btn-next" onClick={handleNext} type="button">
                {t('onboarding.next')}
              </button>
            </>
          ) : (
            <button className="onboarding-btn-next onboarding-btn-start" onClick={handleNext} type="button">
              {t('onboarding.getStarted')}
            </button>
          )}
        </div>

        <p className="onboarding-step-indicator">{stepIndicator}</p>
      </div>
    </div>
  );
}

// isOnboardingCompleted helper moved to App.tsx to avoid react-refresh lint error

import { useState, useCallback } from 'react';
import type { LocationPoint } from '../types';
import { useLanguage } from '../i18n';

export function useCurrentLocation() {
  const { t } = useLanguage();
  const [location, setLocation] = useState<LocationPoint | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError(t('error.geolocationUnsupported'));
      return;
    }

    setIsLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setIsLoading(false);
      },
      (err) => {
        setError(
          err.code === 1
            ? t('error.locationDenied')
            : t('error.locationUnavailable')
        );
        setIsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [t]);

  return { location, isLoading, error, getLocation };
}

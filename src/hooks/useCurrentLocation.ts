import { useState, useCallback, useEffect, useRef } from 'react';
import type { LocationPoint } from '../types';
import { useLanguage } from '../i18n';
import { reportError } from '../services/errorReportingService';

export function useCurrentLocation(continuous = false) {
  const { t } = useLanguage();
  const [location, setLocation] = useState<LocationPoint | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

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
        const msg = err.code === 1 ? 'Permission denied' : `Unavailable (code ${err.code})`;
        reportError('geolocation', msg, err.message);
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

  // Continuous geolocation via watchPosition
  useEffect(() => {
    if (!continuous) {
      // Clean up any existing watcher when continuous becomes false
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (!navigator.geolocation) {
      // Defer setState to avoid synchronous setState in effect
      queueMicrotask(() => setError(t('error.geolocationUnsupported')));
      return;
    }

    queueMicrotask(() => setError(null));

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setIsLoading(false);
      },
      (err) => {
        const msg = err.code === 1 ? 'Permission denied' : `Unavailable (code ${err.code})`;
        reportError('geolocation', msg, err.message);
        setError(
          err.code === 1
            ? t('error.locationDenied')
            : t('error.locationUnavailable')
        );
        setIsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [continuous, t]);

  return { location, isLoading, error, getLocation };
}

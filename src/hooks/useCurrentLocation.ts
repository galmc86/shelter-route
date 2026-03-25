import { useState, useCallback, useEffect, useRef } from 'react';
import type { LocationPoint } from '../types';
import { useLanguage } from '../i18n';
import { reportError } from '../services/errorReportingService';

const LAST_KNOWN_LOCATION_KEY = 'shelter-route:last-known-location';

interface StoredLocation {
  lat: number;
  lng: number;
  savedAt: number;
}

function loadLastKnownLocation(): StoredLocation | null {
  try {
    const raw = localStorage.getItem(LAST_KNOWN_LOCATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredLocation>;
    if (typeof parsed.lat !== 'number' || typeof parsed.lng !== 'number' || typeof parsed.savedAt !== 'number') {
      return null;
    }
    return {
      lat: parsed.lat,
      lng: parsed.lng,
      savedAt: parsed.savedAt,
    };
  } catch {
    return null;
  }
}

function saveLastKnownLocation(location: LocationPoint): void {
  try {
    localStorage.setItem(LAST_KNOWN_LOCATION_KEY, JSON.stringify({
      lat: location.lat,
      lng: location.lng,
      savedAt: Date.now(),
    }));
  } catch {
    // Storage unavailable — ignore
  }
}

export function useCurrentLocation(continuous = false) {
  const { t } = useLanguage();
  const [location, setLocation] = useState<LocationPoint | null>(null);
  const [lastKnownLocation, setLastKnownLocation] = useState<LocationPoint | null>(() => {
    const stored = loadLastKnownLocation();
    return stored ? { lat: stored.lat, lng: stored.lng } : null;
  });
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
        const nextLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setLocation(nextLocation);
        setLastKnownLocation(nextLocation);
        saveLastKnownLocation(nextLocation);
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
        const nextLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setLocation(nextLocation);
        setLastKnownLocation(nextLocation);
        saveLastKnownLocation(nextLocation);
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

  return { location, lastKnownLocation, isLoading, error, getLocation };
}

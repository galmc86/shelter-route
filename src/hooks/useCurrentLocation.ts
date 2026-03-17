import { useState, useCallback } from 'react';
import type { LocationPoint } from '../types';

export function useCurrentLocation() {
  const [location, setLocation] = useState<LocationPoint | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('הדפדפן לא תומך בשירותי מיקום');
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
            ? 'גישה למיקום נדחתה'
            : 'לא ניתן לקבל את המיקום הנוכחי'
        );
        setIsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  return { location, isLoading, error, getLocation };
}

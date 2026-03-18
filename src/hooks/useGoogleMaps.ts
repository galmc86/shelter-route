import { useState, useEffect } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

let initStarted = false;
let loadPromise: Promise<void> | null = null;

export function useGoogleMaps() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;

    if (!apiKey) {
      // No API key configured — fall back to Nominatim
      setIsLoaded(false);
      return;
    }

    if (!initStarted) {
      initStarted = true;
      setOptions({
        key: apiKey,
        v: 'weekly',
        language: 'he',
        region: 'IL',
      });
      // Only load the Places library (not full Maps SDK)
      loadPromise = importLibrary('places').then(() => {});
    }

    if (loadPromise) {
      loadPromise
        .then(() => setIsLoaded(true))
        .catch((err: Error) => {
          console.warn('Google Places API failed to load, using Nominatim fallback:', err);
          setError(err.message || 'Failed to load Google Places');
          setIsLoaded(false);
        });
    }
  }, []);

  return { isLoaded, error };
}

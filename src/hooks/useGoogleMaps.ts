import { useState, useEffect } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

let initStarted = false;
let loadPromise: Promise<void> | null = null;

/**
 * Hook to load Google Places API.
 * Returns { isLoaded } for Places autocomplete availability.
 * This is SEPARATE from the Leaflet map — the map always works.
 */
export function useGoogleMaps() {
  const [isPlacesLoaded, setIsPlacesLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;

    if (!apiKey) {
      // No API key configured — fall back to Nominatim
      // eslint-disable-next-line react-hooks/set-state-in-effect -- setting initial state from env check
      setIsPlacesLoaded(false);
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
        .then(() => setIsPlacesLoaded(true))
        .catch((err: Error) => {
          console.warn('Google Places API failed to load, using Nominatim fallback:', err);
          setError(err.message || 'Failed to load Google Places');
          setIsPlacesLoaded(false);
        });
    }
  }, []);

  // isLoaded: always true (Leaflet map doesn't depend on Google)
  // isPlacesLoaded: whether Google Places API is ready for autocomplete
  return { isLoaded: true, isPlacesLoaded, error };
}

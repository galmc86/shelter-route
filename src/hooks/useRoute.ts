import { useState, useCallback } from 'react';
import type { RouteInfo, TravelMode, LatLng } from '../types';
import { computeRoute } from '../services/routeService';

export function useRoute() {
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchRoute = useCallback(
    async (origin: LatLng, destination: LatLng, travelMode: TravelMode) => {
      setIsLoading(true);
      setError(null);
      setRouteInfo(null);

      try {
        const info = await computeRoute(origin, destination, travelMode);
        setRouteInfo(info);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'שגיאה בחיפוש מסלול');
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const clearRoute = useCallback(() => {
    setRouteInfo(null);
    setError(null);
  }, []);

  return { routeInfo, isLoading, error, searchRoute, clearRoute };
}

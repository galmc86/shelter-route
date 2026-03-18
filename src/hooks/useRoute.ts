import { useState, useCallback } from 'react';
import type { RouteInfo, TravelMode, LatLng } from '../types';
import { computeRoute } from '../services/routeService';

export function useRoute() {
  const [allRoutes, setAllRoutes] = useState<RouteInfo[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const routeInfo = allRoutes.length > 0 ? allRoutes[selectedRouteIndex] ?? null : null;

  const searchRoute = useCallback(
    async (origin: LatLng, destination: LatLng, travelMode: TravelMode) => {
      setIsLoading(true);
      setError(null);
      setAllRoutes([]);
      setSelectedRouteIndex(0);

      try {
        const routes = await computeRoute(origin, destination, travelMode);
        setAllRoutes(routes);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'שגיאה בחיפוש מסלול');
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const clearRoute = useCallback(() => {
    setAllRoutes([]);
    setSelectedRouteIndex(0);
    setError(null);
  }, []);

  return {
    routeInfo,
    allRoutes,
    selectedRouteIndex,
    setSelectedRouteIndex,
    isLoading,
    error,
    searchRoute,
    clearRoute,
  };
}

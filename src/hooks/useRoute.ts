import { useState, useCallback, useMemo } from 'react';
import type { RouteOption, RouteInfo, TravelMode, LatLng } from '../types';
import { computeRoutes } from '../services/routeService';

export function useRoute() {
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedRoute: RouteInfo | null = useMemo(
    () => (routes.length > 0 ? routes[selectedRouteIndex] ?? null : null),
    [routes, selectedRouteIndex]
  );

  const searchRoute = useCallback(
    async (origin: LatLng, destination: LatLng, travelMode: TravelMode) => {
      setIsLoading(true);
      setError(null);
      setRoutes([]);
      setSelectedRouteIndex(0);

      try {
        const result = await computeRoutes(origin, destination, travelMode);
        setRoutes(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'שגיאה בחיפוש מסלול');
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const clearRoute = useCallback(() => {
    setRoutes([]);
    setSelectedRouteIndex(0);
    setError(null);
  }, []);

  return {
    routes,
    selectedRouteIndex,
    selectedRoute,
    selectRoute: setSelectedRouteIndex,
    isLoading,
    error,
    searchRoute,
    clearRoute,
  };
}

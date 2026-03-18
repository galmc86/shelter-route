import { useState, useEffect, useCallback } from 'react';
import type { Shelter, RouteInfo, RouteWithShelters } from '../types';
import { fetchAllShelters } from '../services/shelterApi';
import { filterSheltersByProximity, getDistanceToRoute } from '../utils/geometry';

const SHELTER_BUFFER_METERS = 200;

export interface ShelterWithDistance extends Shelter {
  distanceFromRoute: number;
}

export function useShelters() {
  const [allShelters, setAllShelters] = useState<Shelter[]>([]);
  const [nearbyShelters, setNearbyShelters] = useState<ShelterWithDistance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAllShelters()
      .then((shelters) => {
        setAllShelters(shelters);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'שגיאה בטעינת מקלטים');
        setIsLoading(false);
      });
  }, []);

  const filterByRoute = useCallback(
    (routeInfo: RouteInfo | null) => {
      if (!routeInfo || !allShelters.length) {
        setNearbyShelters([]);
        return;
      }

      const filtered = filterSheltersByProximity(
        allShelters,
        routeInfo.path,
        SHELTER_BUFFER_METERS
      );

      const withDistance: ShelterWithDistance[] = filtered
        .map((shelter) => ({
          ...shelter,
          distanceFromRoute: getDistanceToRoute(shelter, routeInfo.path),
        }))
        .sort((a, b) => a.distanceFromRoute - b.distanceFromRoute);

      setNearbyShelters(withDistance);
    },
    [allShelters]
  );

  const countSheltersForRoute = useCallback(
    (routeInfo: RouteInfo): number => {
      if (!allShelters.length) return 0;
      return filterSheltersByProximity(
        allShelters,
        routeInfo.path,
        SHELTER_BUFFER_METERS
      ).length;
    },
    [allShelters]
  );

  const getRoutesWithShelters = useCallback(
    (routes: RouteInfo[]): RouteWithShelters[] => {
      return routes.map((route) => ({
        route,
        shelterCount: countSheltersForRoute(route),
      }));
    },
    [countSheltersForRoute]
  );

  return { allShelters, nearbyShelters, isLoading, error, filterByRoute, countSheltersForRoute, getRoutesWithShelters };
}

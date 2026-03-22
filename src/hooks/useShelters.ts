import { useState, useEffect, useCallback } from 'react';
import type { Shelter, RouteInfo, RouteOption, RouteWithShelters } from '../types';
import { fetchAllShelters } from '../services/shelterApi';
import { filterSheltersByProximity, getDistanceToRoute } from '../utils/geometry';
import { calculateWalkingTime } from '../utils/shelterDistance';
import type { ShelterWithDistance } from '../utils/shelterDistance';

// Re-export for backward compatibility
export { calculateWalkingTime } from '../utils/shelterDistance';
export type { ShelterWithDistance } from '../utils/shelterDistance';

const SHELTER_BUFFER_METERS = 200;

/** Derive reasonable accessibility defaults: only mark accessible if floor data is explicitly known */
export function deriveAccessibilityDefaults(shelter: Shelter): Shelter {
  const floorLevel = shelter.floorLevel ?? undefined;
  const isAccessible = shelter.isAccessible ?? (floorLevel !== undefined ? floorLevel === 0 : undefined);
  const hasElevator = shelter.hasElevator ?? false;
  return { ...shelter, floorLevel, isAccessible, hasElevator };
}

export function useShelters() {
  const [allShelters, setAllShelters] = useState<Shelter[]>([]);
  const [nearbyShelters, setNearbyShelters] = useState<ShelterWithDistance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAllShelters(() => {
      // Reverse-geocoding completed in the background — trigger re-render
      // with updated shelter names by spreading the same array reference
      setAllShelters((prev) => [...prev]);
    })
      .then((shelters) => {
        const withAccessibility = shelters.map(deriveAccessibilityDefaults);
        setAllShelters(withAccessibility);
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
        .map((shelter) => {
          const distance = getDistanceToRoute(shelter, routeInfo.path);
          return {
            ...shelter,
            distanceFromRoute: distance,
            walkingTimeMinutes: calculateWalkingTime(distance),
          };
        })
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
    (routes: RouteOption[]): RouteWithShelters[] => {
      return routes.map((route) => ({
        route,
        shelterCount: countSheltersForRoute(route),
      }));
    },
    [countSheltersForRoute]
  );

  return { allShelters, nearbyShelters, isLoading, error, filterByRoute, countSheltersForRoute, getRoutesWithShelters };
}

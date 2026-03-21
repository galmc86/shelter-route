import { useState, useCallback } from 'react';
import type { RouteOption, LocationPoint } from '../types';
import type { ShelterWithDistance } from './useShelters';
import { computeRoutes } from '../services/routeService';
import type { TranslationKey } from '../i18n';

export interface UseNavigationReturn {
  navigationRoute: RouteOption | null;
  targetShelter: ShelterWithDistance | null;
  isNavigating: boolean;
  isLoadingNav: boolean;
  navError: string | null;
  startNavigation: (
    shelter: ShelterWithDistance,
    userLocation: LocationPoint,
    t: (key: TranslationKey) => string
  ) => Promise<void>;
  stopNavigation: () => void;
}

export function useNavigation(): UseNavigationReturn {
  const [navigationRoute, setNavigationRoute] = useState<RouteOption | null>(null);
  const [targetShelter, setTargetShelter] = useState<ShelterWithDistance | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isLoadingNav, setIsLoadingNav] = useState(false);
  const [navError, setNavError] = useState<string | null>(null);

  const startNavigation = useCallback(
    async (
      shelter: ShelterWithDistance,
      userLocation: LocationPoint,
      t: (key: TranslationKey) => string
    ) => {
      setIsLoadingNav(true);
      setNavError(null);
      setTargetShelter(shelter);
      setIsNavigating(true);

      try {
        const origin = { lat: userLocation.lat, lng: userLocation.lng };
        const destination = { lat: shelter.lat, lng: shelter.lon };
        const routes = await computeRoutes(origin, destination, 'WALKING', t);
        if (routes.length > 0) {
          setNavigationRoute(routes[0]);
        } else {
          setNavError(t('nav.locationRequired'));
          setIsNavigating(false);
          setTargetShelter(null);
        }
      } catch {
        setNavError(t('nav.locationRequired'));
        setIsNavigating(false);
        setTargetShelter(null);
      } finally {
        setIsLoadingNav(false);
      }
    },
    []
  );

  const stopNavigation = useCallback(() => {
    setNavigationRoute(null);
    setTargetShelter(null);
    setIsNavigating(false);
    setIsLoadingNav(false);
    setNavError(null);
  }, []);

  return {
    navigationRoute,
    targetShelter,
    isNavigating,
    isLoadingNav,
    navError,
    startNavigation,
    stopNavigation,
  };
}

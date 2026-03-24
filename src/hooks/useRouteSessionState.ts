import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { trackRouteSearch } from '../services/safetyAnalyticsService';
import type { LatLng, RouteWithShelters, TravelMode } from '../types';

export interface InitialSharedRoute {
  origin: LatLng;
  destination: LatLng;
  travelMode: TravelMode;
}

export function getInitialSharedRoute(): InitialSharedRoute | null {
  const params = new URLSearchParams(window.location.search);
  const from = params.get('from');
  const to = params.get('to');
  const mode = params.get('mode') as TravelMode | null;

  if (!from || !to) {
    return null;
  }

  const [fromLat, fromLng] = from.split(',').map(Number);
  const [toLat, toLng] = to.split(',').map(Number);
  if ([fromLat, fromLng, toLat, toLng].some((value) => Number.isNaN(value))) {
    return null;
  }

  const isValidLat = (lat: number) => lat >= 29.0 && lat <= 34.0;
  const isValidLng = (lng: number) => lng >= 34.0 && lng <= 36.5;
  if (!isValidLat(fromLat) || !isValidLng(fromLng) || !isValidLat(toLat) || !isValidLng(toLng)) {
    console.warn('Shared route URL contains coordinates outside Israel bounds, ignoring:', { fromLat, fromLng, toLat, toLng });
    return null;
  }

  return {
    origin: { lat: fromLat, lng: fromLng },
    destination: { lat: toLat, lng: toLng },
    travelMode: mode && ['WALKING', 'BICYCLING', 'DRIVING'].includes(mode) ? mode : 'WALKING',
  };
}

interface UseRouteSessionStateArgs {
  searchRoute: (origin: LatLng, destination: LatLng, travelMode: TravelMode) => void;
  routesWithShelters: RouteWithShelters[];
  selectedRouteIndex: number;
}

interface UseRouteSessionStateResult {
  initialSharedRoute: InitialSharedRoute | null;
  shareOrigin: LatLng | null;
  shareDestination: LatLng | null;
  shareTravelMode: TravelMode;
  runRouteSearch: (origin: LatLng, destination: LatLng, travelMode: TravelMode) => void;
}

export function useRouteSessionState({
  searchRoute,
  routesWithShelters,
  selectedRouteIndex,
}: UseRouteSessionStateArgs): UseRouteSessionStateResult {
  const prevRoutesLength = useRef(0);
  const sharedRouteBootstrappedRef = useRef(false);
  const initialSharedRoute = useMemo(() => getInitialSharedRoute(), []);

  const [shareOrigin, setShareOrigin] = useState<LatLng | null>(() => initialSharedRoute?.origin ?? null);
  const [shareDestination, setShareDestination] = useState<LatLng | null>(() => initialSharedRoute?.destination ?? null);
  const [shareTravelMode, setShareTravelMode] = useState<TravelMode>(() => initialSharedRoute?.travelMode ?? 'WALKING');

  useEffect(() => {
    if (!initialSharedRoute || sharedRouteBootstrappedRef.current) {
      return;
    }

    sharedRouteBootstrappedRef.current = true;
    searchRoute(initialSharedRoute.origin, initialSharedRoute.destination, initialSharedRoute.travelMode);
    window.history.replaceState({}, '', window.location.pathname);
  }, [initialSharedRoute, searchRoute]);

  useEffect(() => {
    if (routesWithShelters.length > 0 && routesWithShelters.length !== prevRoutesLength.current) {
      const shelterCount = routesWithShelters[selectedRouteIndex]?.shelterCount ?? 0;
      trackRouteSearch(shelterCount);
    }
    prevRoutesLength.current = routesWithShelters.length;
  }, [routesWithShelters, selectedRouteIndex]);

  const runRouteSearch = useCallback((origin: LatLng, destination: LatLng, travelMode: TravelMode) => {
    setShareOrigin(origin);
    setShareDestination(destination);
    setShareTravelMode(travelMode);
    searchRoute(origin, destination, travelMode);
  }, [searchRoute]);

  return {
    initialSharedRoute,
    shareOrigin,
    shareDestination,
    shareTravelMode,
    runRouteSearch,
  };
}

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useGoogleMaps } from './useGoogleMaps';
import { useRoute } from './useRoute';
import { useShelters } from './useShelters';
import { useCurrentLocation } from './useCurrentLocation';
import { useNearestShelters } from './useNearestShelters';
import { useCapacity } from './useCapacity';
import { useOrefAlerts } from './useOrefAlerts';
import { useAlertHistory } from './useAlertHistory';
import { useNavigation } from './useNavigation';
import { useLanguage } from '../i18n';
import { useTheme } from '../theme';
import { playAlertSound, stopAlertSound } from '../utils/alertSound';
import { trackRouteSearch, trackEmergency } from '../services/safetyAnalyticsService';
import type { TravelMode, LatLng, RouteWithShelters } from '../types';
import type { ShelterWithDistance } from './useShelters';
import type { RouteContextValue } from '../contexts/RouteContext';
import type { EmergencyContextValue } from '../contexts/EmergencyContext';
import type { ShelterContextValue } from '../contexts/ShelterContext';
import type L from 'leaflet';

function isOnboardingCompleted(): boolean {
  try {
    return localStorage.getItem('shelter-route:onboarding-completed') === 'true';
  } catch {
    return false;
  }
}

function getInitialFamilyGroupCode(): string | null {
  const familyCode = new URLSearchParams(window.location.search).get('familyGroup');
  return familyCode && /^[A-Z0-9]{6}$/i.test(familyCode) ? familyCode.toUpperCase() : null;
}

interface InitialSharedRoute {
  origin: LatLng;
  destination: LatLng;
  travelMode: TravelMode;
}

function getInitialSharedRoute(): InitialSharedRoute | null {
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

export interface AppControllerState {
  language: ReturnType<typeof useLanguage>['language'];
  theme: string;
  t: ReturnType<typeof useLanguage>['t'];
  mapsError: string | null;
  routes: ReturnType<typeof useRoute>['routes'];
  currentLocation: ReturnType<typeof useCurrentLocation>['location'];
  familyGroupCode: string | null;
  panelExpanded: boolean;
  showOnboarding: boolean;
  emergencyMode: boolean;
  nearMeMode: boolean;
  isAlertActive: boolean;
  matchedRegion: ReturnType<typeof useOrefAlerts>['matchedRegion'];
  countdown: ReturnType<typeof useOrefAlerts>['countdown'];
  isNavigating: boolean;
  isLoadingNav: boolean;
  navError: string | null;
  navHookRoute: ReturnType<typeof useNavigation>['navigationRoute'];
  targetShelter: ReturnType<typeof useNavigation>['targetShelter'];
  routeContextValue: RouteContextValue;
  emergencyContextValue: EmergencyContextValue;
  shelterContextValue: ShelterContextValue;
  handleMapReady: (map: L.Map) => void;
  handleEmergencyClick: () => void;
  handleNavigateToShelter: (shelter: ShelterWithDistance) => Promise<void>;
  handleCancelNavigation: () => void;
  dismissAlert: () => void;
  stopNavigation: () => void;
  completeOnboarding: () => void;
  togglePanel: () => void;
}

export function useAppController(): AppControllerState {
  const { language, t } = useLanguage();
  const { theme } = useTheme();
  const [selectedShelterId, setSelectedShelterId] = useState<string | null>(null);
  const [emergencyMode, setEmergencyMode] = useState(false);
  const { error: mapsError } = useGoogleMaps();
  const {
    routes,
    selectedRouteIndex,
    selectedRoute,
    selectRoute,
    isLoading: isRouteLoading,
    error: routeError,
    searchRoute,
  } = useRoute();
  const { allShelters, nearbyShelters, isLoading: sheltersLoading, filterByRoute, getRoutesWithShelters } = useShelters();
  const { location: currentLocation, isLoading: isLoadingLocation, error: locationError, getLocation } = useCurrentLocation(emergencyMode);
  const { nearestShelters, isSearching: isEmergencySearching, findNearest, clear: clearNearest } = useNearestShelters();
  const capacityMap = useCapacity(allShelters);
  const { isAlertActive, matchedRegion, countdown, dismissAlert: dismissAlertBase } = useOrefAlerts(
    currentLocation?.lat ?? null,
    currentLocation?.lng ?? null
  );
  const { routeRisk, timeFilter, setTimeFilter } = useAlertHistory(selectedRoute);
  const {
    navigationRoute: navHookRoute,
    targetShelter,
    isNavigating,
    isLoadingNav,
    navError,
    startNavigation,
    stopNavigation,
  } = useNavigation();

  const prevAlertActive = useRef(false);
  const vibrationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const pendingNavShelterRef = useRef<ShelterWithDistance | null>(null);
  const prevRoutesLength = useRef(0);
  const initialSharedRoute = useMemo(() => getInitialSharedRoute(), []);
  const sharedRouteBootstrappedRef = useRef(false);

  const [shareOrigin, setShareOrigin] = useState<LatLng | null>(() => initialSharedRoute?.origin ?? null);
  const [shareDestination, setShareDestination] = useState<LatLng | null>(() => initialSharedRoute?.destination ?? null);
  const [shareTravelMode, setShareTravelMode] = useState<TravelMode>(() => initialSharedRoute?.travelMode ?? 'WALKING');
  const [showOnboarding, setShowOnboarding] = useState(() => !isOnboardingCompleted());
  const [nearMeMode, setNearMeMode] = useState(false);
  const [familyGroupCode] = useState<string | null>(() => getInitialFamilyGroupCode());
  const [panelExpanded, setPanelExpanded] = useState(() => initialSharedRoute === null);

  const dismissAlert = useCallback(() => {
    dismissAlertBase();
    stopAlertSound();
    if (vibrationInterval.current) {
      clearInterval(vibrationInterval.current);
      vibrationInterval.current = null;
    }
    if (navigator.vibrate) {
      navigator.vibrate(0);
    }
  }, [dismissAlertBase]);

  const routesWithShelters: RouteWithShelters[] = useMemo(() => {
    if (routes.length === 0) return [];
    return getRoutesWithShelters(routes);
  }, [routes, getRoutesWithShelters]);

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

  useEffect(() => {
    filterByRoute(selectedRoute);
  }, [selectedRoute, filterByRoute]);

  useEffect(() => {
    if ((emergencyMode || nearMeMode) && currentLocation && allShelters.length) {
      findNearest(allShelters, currentLocation.lat, currentLocation.lng);
    }
  }, [emergencyMode, nearMeMode, currentLocation, allShelters, findNearest]);

  const activateEmergencyFromAlert = useCallback(() => {
    setEmergencyMode(true);
    setSelectedShelterId(null);
    setPanelExpanded(false);
    getLocation();
    playAlertSound();

    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 400]);
      vibrationInterval.current = setInterval(() => {
        navigator.vibrate([200, 100, 200, 100, 400]);
      }, 1200);
    }
  }, [getLocation]);

  useEffect(() => {
    if (isAlertActive && !prevAlertActive.current) {
      setTimeout(() => {
        activateEmergencyFromAlert();
      }, 0);
    }

    if (!isAlertActive && prevAlertActive.current) {
      stopAlertSound();
      if (vibrationInterval.current) {
        clearInterval(vibrationInterval.current);
        vibrationInterval.current = null;
      }
      if (navigator.vibrate) {
        navigator.vibrate(0);
      }
    }

    prevAlertActive.current = isAlertActive;
  }, [activateEmergencyFromAlert, isAlertActive]);

  const handleSearch = useCallback((origin: LatLng, destination: LatLng, travelMode: TravelMode) => {
    setSelectedShelterId(null);
    setEmergencyMode(false);
    setNearMeMode(false);
    clearNearest();
    setPanelExpanded(false);
    setShareOrigin(origin);
    setShareDestination(destination);
    setShareTravelMode(travelMode);
    searchRoute(origin, destination, travelMode);
  }, [searchRoute, clearNearest]);

  const handleNearMeClick = useCallback(() => {
    setNearMeMode(true);
    setEmergencyMode(false);
    setSelectedShelterId(null);
    setPanelExpanded(true);
    getLocation();
  }, [getLocation]);

  const handleShelterClick = useCallback((shelter: ShelterWithDistance) => {
    setSelectedShelterId(shelter.id);
  }, []);

  const handleEmergencyClick = useCallback(() => {
    setEmergencyMode(true);
    setNearMeMode(false);
    setSelectedShelterId(null);
    setPanelExpanded(false);
    getLocation();
    trackEmergency();
  }, [getLocation]);

  const handleExitEmergency = useCallback(() => {
    setEmergencyMode(false);
    clearNearest();
    setSelectedShelterId(null);
  }, [clearNearest]);

  const handleExitNearMe = useCallback(() => {
    setNearMeMode(false);
    clearNearest();
    setSelectedShelterId(null);
  }, [clearNearest]);

  const handleRouteSelect = useCallback((index: number) => {
    selectRoute(index);
    setSelectedShelterId(null);
  }, [selectRoute]);

  const handleMapReady = useCallback((map: L.Map) => {
    leafletMapRef.current = map;
  }, []);

  const handleUseMapCenter = useCallback(() => {
    const map = leafletMapRef.current;
    if (!map || !allShelters.length) return;
    const center = map.getCenter();
    findNearest(allShelters, center.lat, center.lng);
  }, [allShelters, findNearest]);

  const displayShelters = (emergencyMode || nearMeMode) ? nearestShelters : nearbyShelters;

  const handleNavigateToShelter = useCallback(async (shelter: ShelterWithDistance) => {
    if (!currentLocation) {
      pendingNavShelterRef.current = shelter;
      getLocation();
      return;
    }
    pendingNavShelterRef.current = null;
    await startNavigation(shelter, currentLocation, t);
    setPanelExpanded(false);
  }, [currentLocation, getLocation, startNavigation, t]);

  useEffect(() => {
    if (currentLocation && pendingNavShelterRef.current) {
      const shelter = pendingNavShelterRef.current;
      pendingNavShelterRef.current = null;
      startNavigation(shelter, currentLocation, t).then(() => {
        setPanelExpanded(false);
      });
    }
  }, [currentLocation, startNavigation, t]);

  const handleCancelNavigation = useCallback(() => {
    stopNavigation();
    setPanelExpanded(true);
  }, [stopNavigation]);

  const routeContextValue: RouteContextValue = useMemo(() => ({
    routeInfo: (emergencyMode || nearMeMode) ? null : selectedRoute,
    selectedRouteIndex,
    routesWithShelters: (emergencyMode || nearMeMode) ? [] : routesWithShelters,
    nearbyShelters: displayShelters,
    sheltersLoading: sheltersLoading || isEmergencySearching,
    searchError: routeError,
    isSearching: isRouteLoading,
    onSearch: handleSearch,
    onRouteSelect: handleRouteSelect,
    shareOrigin,
    shareDestination,
    shareTravelMode,
    routeRisk: routeRisk ?? null,
    timeFilter,
    onTimeFilterChange: setTimeFilter,
  }), [
    emergencyMode, nearMeMode, selectedRoute, selectedRouteIndex,
    routesWithShelters, displayShelters, sheltersLoading, isEmergencySearching,
    routeError, isRouteLoading, handleSearch, handleRouteSelect,
    shareOrigin, shareDestination, shareTravelMode, routeRisk, timeFilter, setTimeFilter,
  ]);

  const emergencyContextValue: EmergencyContextValue = useMemo(() => ({
    emergencyMode,
    onEmergencyClick: handleEmergencyClick,
    onExitEmergency: handleExitEmergency,
    currentLocation,
    isLoadingLocation,
    locationError: locationError ?? null,
    onGetLocation: getLocation,
    nearMeMode,
    onNearMeClick: handleNearMeClick,
    onExitNearMe: handleExitNearMe,
    onUseMapCenter: handleUseMapCenter,
  }), [
    emergencyMode, handleEmergencyClick, handleExitEmergency,
    currentLocation, isLoadingLocation, locationError, getLocation,
    nearMeMode, handleNearMeClick, handleExitNearMe, handleUseMapCenter,
  ]);

  const shelterContextValue: ShelterContextValue = useMemo(() => ({
    selectedShelterId,
    onShelterClick: handleShelterClick,
    onNavigateToShelter: handleNavigateToShelter,
    capacityMap,
    isLoaded: true,
    allShelters,
  }), [selectedShelterId, handleShelterClick, handleNavigateToShelter, capacityMap, allShelters]);

  const completeOnboarding = useCallback(() => {
    setShowOnboarding(false);
  }, []);

  const togglePanel = useCallback(() => {
    setPanelExpanded((value) => !value);
  }, []);

  return {
    language,
    theme,
    t,
    mapsError,
    routes,
    currentLocation,
    familyGroupCode,
    panelExpanded,
    showOnboarding,
    emergencyMode,
    nearMeMode,
    isAlertActive,
    matchedRegion,
    countdown,
    isNavigating,
    isLoadingNav,
    navError,
    navHookRoute,
    targetShelter,
    routeContextValue,
    emergencyContextValue,
    shelterContextValue,
    handleMapReady,
    handleEmergencyClick,
    handleNavigateToShelter,
    handleCancelNavigation,
    dismissAlert,
    stopNavigation,
    completeOnboarding,
    togglePanel,
  };
}

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
import { useLookupModeState } from './useLookupModeState';
import { useEmergencyAlertEffects } from './useEmergencyAlertEffects';
import { useRouteSessionState } from './useRouteSessionState';
import { useShelterNavigationFlow } from './useShelterNavigationFlow';
import { useProximitySearchState } from './useProximitySearchState';
import { useAppControllerContexts } from './useAppControllerContexts';
import { useLanguage } from '../i18n';
import { useTheme } from '../theme';
import { trackEmergency } from '../services/safetyAnalyticsService';
import type { TravelMode, LatLng, LocationPoint, RouteWithShelters } from '../types';
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

export interface AppControllerState {
  language: ReturnType<typeof useLanguage>['language'];
  theme: string;
  t: ReturnType<typeof useLanguage>['t'];
  mapsError: string | null;
  routes: ReturnType<typeof useRoute>['routes'];
  currentLocation: ReturnType<typeof useCurrentLocation>['location'];
  mapUserLocation: LocationPoint | null;
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
  const leafletMapRef = useRef<L.Map | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(() => !isOnboardingCompleted());
  const [familyGroupCode] = useState<string | null>(() => getInitialFamilyGroupCode());
  const routesWithShelters: RouteWithShelters[] = useMemo(() => {
    if (routes.length === 0) return [];
    return getRoutesWithShelters(routes);
  }, [routes, getRoutesWithShelters]);
  const {
    initialSharedRoute,
    shareOrigin,
    shareDestination,
    shareTravelMode,
    runRouteSearch,
  } = useRouteSessionState({
    searchRoute,
    routesWithShelters,
    selectedRouteIndex,
  });
  const {
    panelExpanded,
    setPanelExpanded,
    togglePanel,
    emergencyMode,
    nearMeMode,
    savedLookupLocation,
    collapseForRouteSearch,
    enterNearMeMode,
    enterSavedLocationMode,
    enterEmergencyMode,
    enterEmergencyLocationMode,
    exitEmergencyMode,
    exitNearMeMode,
  } = useLookupModeState({
    initialPanelExpanded: initialSharedRoute === null,
  });
  const {
    location: currentLocation,
    lastKnownLocation,
    isLoading: isLoadingLocation,
    error: locationError,
    getLocation,
  } = useCurrentLocation(emergencyMode);
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

  useEffect(() => {
    filterByRoute(selectedRoute);
  }, [selectedRoute, filterByRoute]);
  const {
    activeLookupLocation,
    activeLookupLabel,
    displayShelters,
    mapUserLocation,
  } = useProximitySearchState({
    currentLocation,
    savedLookupLocation,
    emergencyMode,
    nearMeMode,
    allShelters,
    nearbyShelters,
    nearestShelters,
    isNavigating,
    myLocationLabel: t('search.myLocation'),
    findNearest,
  });

  const activateEmergencyFromAlert = useCallback(() => {
    enterEmergencyMode();
    setSelectedShelterId(null);
    getLocation();
  }, [enterEmergencyMode, getLocation]);
  const { dismissAlert } = useEmergencyAlertEffects({
    isAlertActive,
    onDismissBase: dismissAlertBase,
    onActivateEmergency: activateEmergencyFromAlert,
  });

  const handleSearch = useCallback((origin: LatLng, destination: LatLng, travelMode: TravelMode) => {
    setSelectedShelterId(null);
    collapseForRouteSearch();
    clearNearest();
    runRouteSearch(origin, destination, travelMode);
  }, [clearNearest, collapseForRouteSearch, runRouteSearch]);

  const handleNearMeClick = useCallback(() => {
    enterNearMeMode();
    setSelectedShelterId(null);
    getLocation();
  }, [enterNearMeMode, getLocation]);

  const handleSearchFromSavedLocation = useCallback((location: LocationPoint, label?: string) => {
    enterSavedLocationMode(location, label);
    setSelectedShelterId(null);
    clearNearest();
  }, [clearNearest, enterSavedLocationMode]);

  const handleShelterClick = useCallback((shelter: ShelterWithDistance) => {
    setSelectedShelterId(shelter.id);
  }, []);

  const handleEmergencyClick = useCallback(() => {
    enterEmergencyMode();
    setSelectedShelterId(null);
    getLocation();
    trackEmergency();
  }, [enterEmergencyMode, getLocation]);

  const handleUseLastKnownLocation = useCallback(() => {
    if (!lastKnownLocation) return;
    enterEmergencyLocationMode(lastKnownLocation, t('emergency.lastKnownLocationLabel'));
    setSelectedShelterId(null);
    clearNearest();
  }, [clearNearest, enterEmergencyLocationMode, lastKnownLocation, t]);

  const alertFallbackAppliedRef = useRef(false);

  useEffect(() => {
    if (!isAlertActive) {
      alertFallbackAppliedRef.current = false;
      return;
    }

    if (
      !emergencyMode ||
      alertFallbackAppliedRef.current ||
      !locationError ||
      !lastKnownLocation ||
      currentLocation ||
      activeLookupLocation
    ) {
      return;
    }

    enterEmergencyLocationMode(lastKnownLocation, t('emergency.lastKnownLocationLabel'));
    setSelectedShelterId(null);
    clearNearest();
    alertFallbackAppliedRef.current = true;
  }, [
    activeLookupLocation,
    clearNearest,
    currentLocation,
    emergencyMode,
    enterEmergencyLocationMode,
    isAlertActive,
    lastKnownLocation,
    locationError,
    t,
  ]);

  const handleExitEmergency = useCallback(() => {
    exitEmergencyMode();
    clearNearest();
    setSelectedShelterId(null);
  }, [clearNearest, exitEmergencyMode]);

  const handleExitNearMe = useCallback(() => {
    exitNearMeMode();
    clearNearest();
    setSelectedShelterId(null);
  }, [clearNearest, exitNearMeMode]);

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

  const {
    handleNavigateToShelter,
    handleCancelNavigation,
  } = useShelterNavigationFlow({
    currentLocation,
    getLocation,
    startNavigation,
    stopNavigation,
    setPanelExpanded,
    t,
  });

  const {
    routeContextValue,
    emergencyContextValue,
    shelterContextValue,
  } = useAppControllerContexts({
    emergencyMode,
    nearMeMode,
    selectedRoute,
    selectedRouteIndex,
    routesWithShelters,
    displayShelters,
    sheltersLoading,
    isEmergencySearching,
    routeError,
    isRouteLoading,
    handleSearch,
    handleRouteSelect,
    shareOrigin,
    shareDestination,
    shareTravelMode,
    routeRisk: routeRisk ?? null,
    timeFilter,
    setTimeFilter,
    handleEmergencyClick,
    handleExitEmergency,
    currentLocation,
    lastKnownLocation,
    activeLookupLocation,
    activeLookupLabel,
    isLoadingLocation,
    locationError: locationError ?? null,
    getLocation,
    handleSearchFromSavedLocation,
    handleUseLastKnownLocation,
    handleNearMeClick,
    handleExitNearMe,
    handleUseMapCenter,
    selectedShelterId,
    handleShelterClick,
    handleNavigateToShelter,
    capacityMap,
    allShelters,
  });

  const completeOnboarding = useCallback(() => {
    setShowOnboarding(false);
  }, []);

  return {
    language,
    theme,
    t,
    mapsError,
    routes,
    currentLocation,
    mapUserLocation,
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

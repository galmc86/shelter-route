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
  const pendingNavShelterRef = useRef<ShelterWithDistance | null>(null);
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
    exitEmergencyMode,
    exitNearMeMode,
  } = useLookupModeState({
    initialPanelExpanded: initialSharedRoute === null,
  });
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

  const activeLookupLocation = useMemo<LocationPoint | null>(() => {
    if (savedLookupLocation) return savedLookupLocation.location;
    return currentLocation;
  }, [currentLocation, savedLookupLocation]);

  const activeLookupLabel = useMemo(() => {
    if (savedLookupLocation?.label) return savedLookupLocation.label;
    if (nearMeMode || emergencyMode) return t('search.myLocation');
    return null;
  }, [emergencyMode, nearMeMode, savedLookupLocation, t]);

  useEffect(() => {
    filterByRoute(selectedRoute);
  }, [selectedRoute, filterByRoute]);

  useEffect(() => {
    if ((emergencyMode || nearMeMode) && activeLookupLocation && allShelters.length) {
      findNearest(allShelters, activeLookupLocation.lat, activeLookupLocation.lng);
    }
  }, [emergencyMode, nearMeMode, activeLookupLocation, allShelters, findNearest]);

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

  const displayShelters = (emergencyMode || nearMeMode) ? nearestShelters : nearbyShelters;
  const mapUserLocation = isNavigating ? currentLocation : (emergencyMode || nearMeMode ? activeLookupLocation : null);

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
    activeLookupLocation,
    activeLookupLabel,
    isLoadingLocation,
    locationError: locationError ?? null,
    onGetLocation: getLocation,
    onSearchFromSavedLocation: handleSearchFromSavedLocation,
    nearMeMode,
    onNearMeClick: handleNearMeClick,
    onExitNearMe: handleExitNearMe,
    onUseMapCenter: handleUseMapCenter,
  }), [
    emergencyMode, handleEmergencyClick, handleExitEmergency,
    currentLocation, activeLookupLocation, activeLookupLabel,
    isLoadingLocation, locationError, getLocation, handleSearchFromSavedLocation,
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

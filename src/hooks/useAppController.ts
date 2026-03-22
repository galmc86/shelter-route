import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useGoogleMaps } from './useGoogleMaps';
import { useRoute } from './useRoute';
import { useShelters } from './useShelters';
import { useCurrentLocation } from './useCurrentLocation';
import { useNearestShelters } from './useNearestShelters';
import { useCapacity } from './useCapacity';
import { useOrefAlerts } from './useOrefAlerts';
import { useAlertHistory } from './useAlertHistory';
import { useLanguage } from '../i18n';
import { useTheme } from '../theme';
import type { TravelMode, LatLng, RouteWithShelters } from '../types';
import type { ShelterWithDistance } from '../utils/shelterDistance';

export function useAppController() {
  const { language, t } = useLanguage();
  const { theme } = useTheme();
  const { isLoaded, error: mapsError } = useGoogleMaps();
  const { routes, selectedRouteIndex, selectedRoute, selectRoute, isLoading: isRouteLoading, error: routeError, searchRoute } = useRoute();
  const { allShelters, nearbyShelters, isLoading: sheltersLoading, filterByRoute, getRoutesWithShelters } = useShelters();
  const { location: currentLocation, isLoading: isLoadingLocation, error: locationError, getLocation } = useCurrentLocation();
  const { nearestShelters, isSearching: isEmergencySearching, findNearest, clear: clearNearest } = useNearestShelters();
  const capacityMap = useCapacity(allShelters);
  const {
    isAlertActive,
    matchedRegion,
    countdown,
    dismissAlert,
  } = useOrefAlerts(
    currentLocation?.lat ?? null,
    currentLocation?.lng ?? null
  );
  const {
    routeRisk,
    timeFilter,
    setTimeFilter,
  } = useAlertHistory(selectedRoute);
  const prevAlertActive = useRef(false);
  const [selectedShelterId, setSelectedShelterId] = useState<string | null>(null);
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [panelExpanded, setPanelExpanded] = useState(true);
  const [shareOrigin, setShareOrigin] = useState<LatLng | null>(null);
  const [shareDestination, setShareDestination] = useState<LatLng | null>(null);
  const [shareTravelMode, setShareTravelMode] = useState<TravelMode>('WALKING');

  // Compute routes with shelter counts
  const routesWithShelters: RouteWithShelters[] = useMemo(() => {
    if (routes.length === 0) return [];
    return getRoutesWithShelters(routes);
  }, [routes, getRoutesWithShelters]);

  // Parse URL params on mount for shared routes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const from = params.get('from');
    const to = params.get('to');
    const mode = params.get('mode') as TravelMode | null;

    if (from && to) {
      const [fromLat, fromLng] = from.split(',').map(Number);
      const [toLat, toLng] = to.split(',').map(Number);

      if (!isNaN(fromLat) && !isNaN(fromLng) && !isNaN(toLat) && !isNaN(toLng)) {
        const origin: LatLng = { lat: fromLat, lng: fromLng };
        const destination: LatLng = { lat: toLat, lng: toLng };
        const travelMode: TravelMode = (mode && ['WALKING', 'BICYCLING', 'DRIVING'].includes(mode)) ? mode : 'WALKING';

        // eslint-disable-next-line react-hooks/set-state-in-effect -- initializing from URL params on mount
        setShareOrigin(origin);
        setShareDestination(destination);
        setShareTravelMode(travelMode);

        // Auto-trigger route search
        setPanelExpanded(false);
        searchRoute(origin, destination, travelMode);

        // Clean up URL params without reload
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter shelters whenever route changes
  useEffect(() => {
    filterByRoute(selectedRoute);
  }, [selectedRoute, filterByRoute]);

  // When emergency mode activates and we get location, find nearest shelters
  useEffect(() => {
    if (emergencyMode && currentLocation && allShelters.length) {
      findNearest(allShelters, currentLocation.lat, currentLocation.lng);
    }
  }, [emergencyMode, currentLocation, allShelters, findNearest]);

  // Auto-trigger emergency mode when OREF alert activates in user's area
  useEffect(() => {
    if (isAlertActive && !prevAlertActive.current) {
      // Alert just became active - trigger emergency mode
      // eslint-disable-next-line react-hooks/set-state-in-effect -- responding to external alert system
      setEmergencyMode(true);
      setSelectedShelterId(null);
      setPanelExpanded(false);
      getLocation();

      // Vibrate device if supported (long pattern for urgency)
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 400]);
      }
    }
    prevAlertActive.current = isAlertActive;
  }, [isAlertActive, getLocation]);

  const handleSearch = useCallback(
    (origin: LatLng, destination: LatLng, travelMode: TravelMode) => {
      setSelectedShelterId(null);
      setEmergencyMode(false);
      clearNearest();
      setPanelExpanded(false);
      setShareOrigin(origin);
      setShareDestination(destination);
      setShareTravelMode(travelMode);
      searchRoute(origin, destination, travelMode);
    },
    [searchRoute, clearNearest]
  );

  const handleShelterClick = useCallback((shelter: ShelterWithDistance) => {
    setSelectedShelterId(shelter.id);
  }, []);

  const handleEmergencyClick = useCallback(() => {
    setEmergencyMode(true);
    setSelectedShelterId(null);
    setPanelExpanded(false);
    getLocation();
  }, [getLocation]);

  const handleExitEmergency = useCallback(() => {
    setEmergencyMode(false);
    clearNearest();
    setSelectedShelterId(null);
  }, [clearNearest]);

  const handleRouteSelect = useCallback((index: number) => {
    selectRoute(index);
    setSelectedShelterId(null);
  }, [selectRoute]);

  const displayShelters = emergencyMode ? nearestShelters : nearbyShelters;

  return {
    // Language / theme
    language,
    t,
    theme,
    // Maps
    isLoaded,
    mapsError,
    // Route
    routes,
    selectedRouteIndex,
    selectedRoute,
    isRouteLoading,
    routeError,
    selectRoute,
    // Shelters
    displayShelters,
    sheltersLoading,
    isEmergencySearching,
    capacityMap,
    nearbyShelters,
    // Location
    currentLocation,
    isLoadingLocation,
    locationError,
    getLocation,
    // Alert
    isAlertActive,
    matchedRegion,
    countdown,
    dismissAlert,
    // Alert history
    routeRisk,
    timeFilter,
    setTimeFilter,
    // UI state
    selectedShelterId,
    emergencyMode,
    panelExpanded,
    setPanelExpanded,
    shareOrigin,
    shareDestination,
    shareTravelMode,
    routesWithShelters,
    // Handlers
    handleSearch,
    handleShelterClick,
    handleEmergencyClick,
    handleExitEmergency,
    handleRouteSelect,
  };
}

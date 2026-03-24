import { useMemo } from 'react';
import type { TravelMode, LatLng, LocationPoint, RouteInfo, RouteWithShelters, Shelter } from '../types';
import type { ShelterWithDistance } from './useShelters';
import type { CapacityData } from '../services/capacityService';
import type { RouteContextValue } from '../contexts/RouteContext';
import type { EmergencyContextValue } from '../contexts/EmergencyContext';
import type { ShelterContextValue } from '../contexts/ShelterContext';
import type { RouteRiskAssessment } from '../services/alertHistoryService';
import type { TimeFilter } from './useAlertHistory';

interface UseAppControllerContextsArgs {
  emergencyMode: boolean;
  nearMeMode: boolean;
  selectedRoute: RouteInfo | null;
  selectedRouteIndex: number;
  routesWithShelters: RouteWithShelters[];
  displayShelters: ShelterWithDistance[];
  sheltersLoading: boolean;
  isEmergencySearching: boolean;
  routeError: string | null;
  isRouteLoading: boolean;
  handleSearch: (origin: LatLng, destination: LatLng, travelMode: TravelMode) => void;
  handleRouteSelect: (index: number) => void;
  shareOrigin: LatLng | null;
  shareDestination: LatLng | null;
  shareTravelMode: TravelMode;
  routeRisk: RouteRiskAssessment | null;
  timeFilter: TimeFilter;
  setTimeFilter: (hours: TimeFilter) => void;
  handleEmergencyClick: () => void;
  handleExitEmergency: () => void;
  currentLocation: LocationPoint | null;
  activeLookupLocation: LocationPoint | null;
  activeLookupLabel: string | null;
  isLoadingLocation: boolean;
  locationError: string | null;
  getLocation: () => void;
  handleSearchFromSavedLocation: (location: LocationPoint, label?: string) => void;
  handleNearMeClick: () => void;
  handleExitNearMe: () => void;
  handleUseMapCenter: () => void;
  selectedShelterId: string | null;
  handleShelterClick: (shelter: ShelterWithDistance) => void;
  handleNavigateToShelter: (shelter: ShelterWithDistance) => Promise<void>;
  capacityMap: Map<string, CapacityData>;
  allShelters: Shelter[];
}

interface UseAppControllerContextsResult {
  routeContextValue: RouteContextValue;
  emergencyContextValue: EmergencyContextValue;
  shelterContextValue: ShelterContextValue;
}

export function useAppControllerContexts({
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
  routeRisk,
  timeFilter,
  setTimeFilter,
  handleEmergencyClick,
  handleExitEmergency,
  currentLocation,
  activeLookupLocation,
  activeLookupLabel,
  isLoadingLocation,
  locationError,
  getLocation,
  handleSearchFromSavedLocation,
  handleNearMeClick,
  handleExitNearMe,
  handleUseMapCenter,
  selectedShelterId,
  handleShelterClick,
  handleNavigateToShelter,
  capacityMap,
  allShelters,
}: UseAppControllerContextsArgs): UseAppControllerContextsResult {
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
    displayShelters,
    emergencyMode,
    handleRouteSelect,
    handleSearch,
    isEmergencySearching,
    isRouteLoading,
    nearMeMode,
    routeError,
    routeRisk,
    routesWithShelters,
    selectedRoute,
    selectedRouteIndex,
    setTimeFilter,
    shareDestination,
    shareOrigin,
    shareTravelMode,
    sheltersLoading,
    timeFilter,
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
    activeLookupLabel,
    activeLookupLocation,
    currentLocation,
    emergencyMode,
    getLocation,
    handleEmergencyClick,
    handleExitEmergency,
    handleExitNearMe,
    handleNearMeClick,
    handleSearchFromSavedLocation,
    handleUseMapCenter,
    isLoadingLocation,
    locationError,
    nearMeMode,
  ]);

  const shelterContextValue: ShelterContextValue = useMemo(() => ({
    selectedShelterId,
    onShelterClick: handleShelterClick,
    onNavigateToShelter: handleNavigateToShelter,
    capacityMap,
    isLoaded: true,
    allShelters,
  }), [allShelters, capacityMap, handleNavigateToShelter, handleShelterClick, selectedShelterId]);

  return {
    routeContextValue,
    emergencyContextValue,
    shelterContextValue,
  };
}

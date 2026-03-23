import { useCallback, useMemo, useState } from 'react';
import type { LatLng, RouteInfo, RouteWithShelters, SavedRouteData, SearchHistoryEntry, ShelterSortMode } from '../types';
import type { ShelterWithDistance } from './useShelters';

interface UseSearchPanelSheltersOptions {
  routeInfo: RouteInfo | null;
  routesWithShelters: RouteWithShelters[];
  selectedRouteIndex: number;
  nearbyShelters: ShelterWithDistance[];
  currentOrigin: LatLng | null;
  currentDestination: LatLng | null;
  historyEntries: SearchHistoryEntry[];
  travelMode: SearchHistoryEntry['travelMode'];
  saveHistoryRoute: (id: string, routeData: SavedRouteData) => void;
  unsaveHistoryRoute: (id: string) => void;
}

export function useSearchPanelShelters({
  routeInfo,
  routesWithShelters,
  selectedRouteIndex,
  nearbyShelters,
  currentOrigin,
  currentDestination,
  historyEntries,
  travelMode,
  saveHistoryRoute,
  unsaveHistoryRoute,
}: UseSearchPanelSheltersOptions) {
  const [sortMode, setSortMode] = useState<ShelterSortMode>('distance');
  const [showAccessibleOnly, setShowAccessibleOnly] = useState(false);

  const displayedShelters = useMemo(() => {
    const shelters = [...nearbyShelters];

    const filteredShelters = showAccessibleOnly
      ? shelters.filter((shelter) => shelter.isAccessible)
      : shelters;

    filteredShelters.sort((a, b) =>
      sortMode === 'walkingTime'
        ? a.walkingTimeMinutes - b.walkingTimeMinutes
        : a.distanceFromRoute - b.distanceFromRoute
    );

    return filteredShelters;
  }, [nearbyShelters, showAccessibleOnly, sortMode]);

  const bestRouteIndex = useMemo(() => {
    if (routesWithShelters.length <= 1) return 0;

    let maxCount = -1;
    let bestIndex = 0;
    routesWithShelters.forEach((routeWithShelters, index) => {
      if (routeWithShelters.shelterCount > maxCount) {
        maxCount = routeWithShelters.shelterCount;
        bestIndex = index;
      }
    });
    return bestIndex;
  }, [routesWithShelters]);

  const currentRouteEntry = useMemo(() => {
    if (!routeInfo || !currentOrigin || !currentDestination) return null;

    return historyEntries.find((entry) =>
      Math.abs(entry.origin.lat - currentOrigin.lat) < 0.001 &&
      Math.abs(entry.origin.lng - currentOrigin.lng) < 0.001 &&
      Math.abs(entry.destination.lat - currentDestination.lat) < 0.001 &&
      Math.abs(entry.destination.lng - currentDestination.lng) < 0.001 &&
      entry.travelMode === travelMode
    ) ?? null;
  }, [routeInfo, currentOrigin, currentDestination, historyEntries, travelMode]);

  const isRouteSaved = !!currentRouteEntry?.routeData;

  const handleSaveRoute = useCallback(() => {
    if (!currentRouteEntry || !routeInfo) return;

    const selectedRoute = routesWithShelters[selectedRouteIndex]?.route;
    const routeData: SavedRouteData = {
      duration: routeInfo.duration,
      distance: routeInfo.distance,
      durationSeconds: selectedRoute?.durationSeconds ?? 0,
      distanceMeters: selectedRoute?.distanceMeters ?? 0,
      shelterCount: nearbyShelters.length,
      savedAt: Date.now(),
    };

    saveHistoryRoute(currentRouteEntry.id, routeData);
  }, [currentRouteEntry, nearbyShelters.length, routeInfo, routesWithShelters, saveHistoryRoute, selectedRouteIndex]);

  const handleUnsaveRoute = useCallback(() => {
    if (!currentRouteEntry) return;
    unsaveHistoryRoute(currentRouteEntry.id);
  }, [currentRouteEntry, unsaveHistoryRoute]);

  return {
    sortMode,
    setSortMode,
    showAccessibleOnly,
    setShowAccessibleOnly,
    displayedShelters,
    bestRouteIndex,
    currentRouteEntry,
    isRouteSaved,
    handleSaveRoute,
    handleUnsaveRoute,
  };
}

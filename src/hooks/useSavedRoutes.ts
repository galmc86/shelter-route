import { useState, useCallback } from 'react';
import type { LatLng, TravelMode } from '../types';

export interface SavedRoute {
  id: string;
  origin: LatLng;
  destination: LatLng;
  travelMode: TravelMode;
  timestamp: number;
  originName?: string;
  destName?: string;
}

const STORAGE_KEY = 'shelter-route-saved-routes';
const MAX_SAVED = 20;

function loadSaved(): SavedRoute[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persist(routes: SavedRoute[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(routes));
  } catch {
    // storage full — ignore
  }
}

function makeId(origin: LatLng, destination: LatLng, travelMode: TravelMode): string {
  return `${origin.lat.toFixed(5)},${origin.lng.toFixed(5)}-${destination.lat.toFixed(5)},${destination.lng.toFixed(5)}-${travelMode}`;
}

export function useSavedRoutes() {
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>(() => loadSaved());

  const isRouteSaved = useCallback(
    (origin: LatLng | null, destination: LatLng | null, travelMode: TravelMode): boolean => {
      if (!origin || !destination) return false;
      const id = makeId(origin, destination, travelMode);
      return savedRoutes.some((r) => r.id === id);
    },
    [savedRoutes]
  );

  const saveRoute = useCallback(
    (origin: LatLng, destination: LatLng, travelMode: TravelMode, originName?: string, destName?: string) => {
      setSavedRoutes((prev) => {
        const id = makeId(origin, destination, travelMode);
        if (prev.some((r) => r.id === id)) return prev;
        const newRoute: SavedRoute = { id, origin, destination, travelMode, timestamp: Date.now(), originName, destName };
        const updated = [newRoute, ...prev].slice(0, MAX_SAVED);
        persist(updated);
        return updated;
      });
    },
    []
  );

  const removeRoute = useCallback(
    (origin: LatLng, destination: LatLng, travelMode: TravelMode) => {
      setSavedRoutes((prev) => {
        const id = makeId(origin, destination, travelMode);
        const updated = prev.filter((r) => r.id !== id);
        persist(updated);
        return updated;
      });
    },
    []
  );

  return { savedRoutes, saveRoute, removeRoute, isRouteSaved };
}

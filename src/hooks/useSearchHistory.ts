import { useState, useCallback } from 'react';
import type { SearchHistoryEntry, SavedRouteData, LatLng, TravelMode } from '../types';
import {
  loadHistory,
  saveHistory,
  addToHistory,
  removeFromHistory,
  clearHistory as clearHistoryEntries,
  togglePin as togglePinEntry,
  renameEntry as renameEntryService,
  updateShelterCount as updateShelterCountService,
  saveRouteData as saveRouteDataService,
  unsaveRouteData as unsaveRouteDataService,
} from '../services/searchHistoryService';

export interface UseSearchHistoryReturn {
  entries: SearchHistoryEntry[];
  addEntry: (entry: Omit<SearchHistoryEntry, 'id' | 'timestamp'>) => void;
  removeEntry: (id: string) => void;
  clearAll: () => void;
  togglePin: (id: string) => void;
  renameEntry: (id: string, label: string) => void;
  updateShelterCount: (origin: LatLng, destination: LatLng, travelMode: TravelMode, shelterCount: number) => void;
  saveRoute: (id: string, routeData: SavedRouteData) => void;
  unsaveRoute: (id: string) => void;
}

export function useSearchHistory(): UseSearchHistoryReturn {
  const [entries, setEntries] = useState<SearchHistoryEntry[]>(() => loadHistory());

  const addEntry = useCallback(
    (entry: Omit<SearchHistoryEntry, 'id' | 'timestamp'>) => {
      setEntries((prev) => {
        const updated = addToHistory(prev, entry);
        saveHistory(updated);
        return updated;
      });
    },
    []
  );

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => {
      const updated = removeFromHistory(prev, id);
      saveHistory(updated);
      return updated;
    });
  }, []);

  const clearAll = useCallback(() => {
    setEntries((prev) => {
      const updated = clearHistoryEntries(prev);
      saveHistory(updated);
      return updated;
    });
  }, []);

  const togglePin = useCallback((id: string) => {
    setEntries((prev) => {
      const updated = togglePinEntry(prev, id);
      saveHistory(updated);
      return updated;
    });
  }, []);

  const renameEntry = useCallback((id: string, label: string) => {
    setEntries((prev) => {
      const updated = renameEntryService(prev, id, label);
      saveHistory(updated);
      return updated;
    });
  }, []);

  const updateShelterCount = useCallback(
    (origin: LatLng, destination: LatLng, travelMode: TravelMode, shelterCount: number) => {
      setEntries((prev) => {
        const updated = updateShelterCountService(prev, origin, destination, travelMode, shelterCount);
        saveHistory(updated);
        return updated;
      });
    },
    []
  );

  const saveRoute = useCallback((id: string, routeData: SavedRouteData) => {
    setEntries((prev) => {
      const updated = saveRouteDataService(prev, id, routeData);
      saveHistory(updated);
      return updated;
    });
  }, []);

  const unsaveRoute = useCallback((id: string) => {
    setEntries((prev) => {
      const updated = unsaveRouteDataService(prev, id);
      saveHistory(updated);
      return updated;
    });
  }, []);

  return { entries, addEntry, removeEntry, clearAll, togglePin, renameEntry, updateShelterCount, saveRoute, unsaveRoute };
}

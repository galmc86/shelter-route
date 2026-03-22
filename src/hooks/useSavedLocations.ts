import { useState, useCallback } from 'react';
import type { SavedLocation, SavedLocationLabel } from '../services/savedLocationsService';
import {
  getSavedLocations,
  saveLocation as saveLocationService,
  removeLocation as removeLocationService,
  updateLocation as updateLocationService,
  MAX_SAVED_LOCATIONS,
} from '../services/savedLocationsService';

export interface UseSavedLocationsReturn {
  locations: SavedLocation[];
  addLocation: (loc: Omit<SavedLocation, 'id'>) => void;
  removeLocation: (id: string) => void;
  updateLocation: (id: string, updates: Partial<Omit<SavedLocation, 'id'>>) => void;
  isMaxReached: boolean;
}

export function useSavedLocations(): UseSavedLocationsReturn {
  const [locations, setLocations] = useState<SavedLocation[]>(() => getSavedLocations());

  const addLocation = useCallback(
    (loc: Omit<SavedLocation, 'id'>) => {
      const updated = saveLocationService(loc);
      setLocations(updated);
    },
    []
  );

  const removeLocation = useCallback((id: string) => {
    const updated = removeLocationService(id);
    setLocations(updated);
  }, []);

  const updateLocation = useCallback(
    (id: string, updates: Partial<Omit<SavedLocation, 'id'>>) => {
      const updated = updateLocationService(id, updates);
      setLocations(updated);
    },
    []
  );

  const isMaxReached = locations.length >= MAX_SAVED_LOCATIONS;

  return { locations, addLocation, removeLocation, updateLocation, isMaxReached };
}

export type { SavedLocation, SavedLocationLabel };

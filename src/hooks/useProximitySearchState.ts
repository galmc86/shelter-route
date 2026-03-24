import { useEffect, useMemo } from 'react';
import type { LocationPoint } from '../types';
import type { Shelter } from '../types';
import type { ShelterWithDistance } from './useShelters';
import type { SavedLookupLocation } from './useLookupModeState';

interface UseProximitySearchStateArgs {
  currentLocation: LocationPoint | null;
  savedLookupLocation: SavedLookupLocation | null;
  emergencyMode: boolean;
  nearMeMode: boolean;
  allShelters: Shelter[];
  nearbyShelters: ShelterWithDistance[];
  nearestShelters: ShelterWithDistance[];
  isNavigating: boolean;
  myLocationLabel: string;
  findNearest: (shelters: Shelter[], lat: number, lng: number) => void;
}

interface UseProximitySearchStateResult {
  activeLookupLocation: LocationPoint | null;
  activeLookupLabel: string | null;
  displayShelters: ShelterWithDistance[];
  mapUserLocation: LocationPoint | null;
}

export function useProximitySearchState({
  currentLocation,
  savedLookupLocation,
  emergencyMode,
  nearMeMode,
  allShelters,
  nearbyShelters,
  nearestShelters,
  isNavigating,
  myLocationLabel,
  findNearest,
}: UseProximitySearchStateArgs): UseProximitySearchStateResult {
  const activeLookupLocation = useMemo<LocationPoint | null>(() => {
    if (savedLookupLocation) {
      return savedLookupLocation.location;
    }

    return currentLocation;
  }, [currentLocation, savedLookupLocation]);

  const activeLookupLabel = useMemo(() => {
    if (savedLookupLocation?.label) {
      return savedLookupLocation.label;
    }

    if (nearMeMode || emergencyMode) {
      return myLocationLabel;
    }

    return null;
  }, [emergencyMode, myLocationLabel, nearMeMode, savedLookupLocation]);

  useEffect(() => {
    if ((emergencyMode || nearMeMode) && activeLookupLocation && allShelters.length) {
      findNearest(allShelters, activeLookupLocation.lat, activeLookupLocation.lng);
    }
  }, [activeLookupLocation, allShelters, emergencyMode, findNearest, nearMeMode]);

  const displayShelters = (emergencyMode || nearMeMode) ? nearestShelters : nearbyShelters;
  const mapUserLocation = isNavigating ? currentLocation : (emergencyMode || nearMeMode ? activeLookupLocation : null);

  return {
    activeLookupLocation,
    activeLookupLabel,
    displayShelters,
    mapUserLocation,
  };
}

import { useCallback, useEffect, useRef } from 'react';
import type { ShelterWithDistance } from './useShelters';
import type { LocationPoint } from '../types';
import type { TranslationKey } from '../i18n';

interface UseShelterNavigationFlowArgs {
  currentLocation: LocationPoint | null;
  getLocation: () => void;
  startNavigation: (
    shelter: ShelterWithDistance,
    currentLocation: LocationPoint,
    t: (key: TranslationKey) => string,
  ) => Promise<void>;
  stopNavigation: () => void;
  setPanelExpanded: (value: boolean) => void;
  t: (key: TranslationKey) => string;
}

interface UseShelterNavigationFlowResult {
  handleNavigateToShelter: (shelter: ShelterWithDistance) => Promise<void>;
  handleCancelNavigation: () => void;
}

export function useShelterNavigationFlow({
  currentLocation,
  getLocation,
  startNavigation,
  stopNavigation,
  setPanelExpanded,
  t,
}: UseShelterNavigationFlowArgs): UseShelterNavigationFlowResult {
  const pendingNavShelterRef = useRef<ShelterWithDistance | null>(null);

  const handleNavigateToShelter = useCallback(async (shelter: ShelterWithDistance) => {
    if (!currentLocation) {
      pendingNavShelterRef.current = shelter;
      getLocation();
      return;
    }

    pendingNavShelterRef.current = null;
    await startNavigation(shelter, currentLocation, t);
    setPanelExpanded(false);
  }, [currentLocation, getLocation, setPanelExpanded, startNavigation, t]);

  useEffect(() => {
    if (!currentLocation || !pendingNavShelterRef.current) {
      return;
    }

    const shelter = pendingNavShelterRef.current;
    pendingNavShelterRef.current = null;

    startNavigation(shelter, currentLocation, t).then(() => {
      setPanelExpanded(false);
    });
  }, [currentLocation, setPanelExpanded, startNavigation, t]);

  const handleCancelNavigation = useCallback(() => {
    stopNavigation();
    setPanelExpanded(true);
  }, [setPanelExpanded, stopNavigation]);

  return {
    handleNavigateToShelter,
    handleCancelNavigation,
  };
}

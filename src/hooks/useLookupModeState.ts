import { useCallback, useState } from 'react';
import type { LocationPoint } from '../types';

export interface SavedLookupLocation {
  location: LocationPoint;
  label: string | null;
}

interface UseLookupModeStateArgs {
  initialPanelExpanded: boolean;
}

export interface UseLookupModeStateResult {
  panelExpanded: boolean;
  setPanelExpanded: (value: boolean) => void;
  togglePanel: () => void;
  emergencyMode: boolean;
  nearMeMode: boolean;
  savedLookupLocation: SavedLookupLocation | null;
  collapseForRouteSearch: () => void;
  enterNearMeMode: () => void;
  enterSavedLocationMode: (location: LocationPoint, label?: string) => void;
  enterEmergencyMode: () => void;
  enterEmergencyLocationMode: (location: LocationPoint, label?: string) => void;
  exitEmergencyMode: () => void;
  exitNearMeMode: () => void;
}

export function useLookupModeState({
  initialPanelExpanded,
}: UseLookupModeStateArgs): UseLookupModeStateResult {
  const [panelExpanded, setPanelExpanded] = useState(initialPanelExpanded);
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [nearMeMode, setNearMeMode] = useState(false);
  const [savedLookupLocation, setSavedLookupLocation] = useState<SavedLookupLocation | null>(null);

  const collapseForRouteSearch = useCallback(() => {
    setEmergencyMode(false);
    setNearMeMode(false);
    setSavedLookupLocation(null);
    setPanelExpanded(false);
  }, []);

  const enterNearMeMode = useCallback(() => {
    setNearMeMode(true);
    setEmergencyMode(false);
    setSavedLookupLocation(null);
    setPanelExpanded(true);
  }, []);

  const enterSavedLocationMode = useCallback((location: LocationPoint, label?: string) => {
    setNearMeMode(true);
    setEmergencyMode(false);
    setSavedLookupLocation({
      location: { lat: location.lat, lng: location.lng, address: location.address },
      label: label?.trim() || null,
    });
    setPanelExpanded(true);
  }, []);

  const enterEmergencyMode = useCallback(() => {
    setEmergencyMode(true);
    setNearMeMode(false);
    setSavedLookupLocation(null);
    setPanelExpanded(true);
  }, []);

  const enterEmergencyLocationMode = useCallback((location: LocationPoint, label?: string) => {
    setEmergencyMode(true);
    setNearMeMode(false);
    setSavedLookupLocation({
      location: { lat: location.lat, lng: location.lng, address: location.address },
      label: label?.trim() || null,
    });
    setPanelExpanded(true);
  }, []);

  const exitEmergencyMode = useCallback(() => {
    setEmergencyMode(false);
    setSavedLookupLocation(null);
  }, []);

  const exitNearMeMode = useCallback(() => {
    setNearMeMode(false);
    setSavedLookupLocation(null);
  }, []);

  const togglePanel = useCallback(() => {
    setPanelExpanded((value) => !value);
  }, []);

  return {
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
  };
}

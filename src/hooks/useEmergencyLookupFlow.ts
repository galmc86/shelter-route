import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import type L from 'leaflet';
import type { TranslationKey } from '../i18n';
import type { LocationPoint, Shelter } from '../types';
import { useEmergencyAlertEffects } from './useEmergencyAlertEffects';

interface UseEmergencyLookupFlowArgs {
  isAlertActive: boolean;
  emergencyMode: boolean;
  activeLookupLocation: LocationPoint | null;
  currentLocation: LocationPoint | null;
  lastKnownLocation: LocationPoint | null;
  locationError: string | null;
  allShelters: Shelter[];
  mapRef: MutableRefObject<L.Map | null>;
  getLocation: () => void;
  clearNearest: () => void;
  findNearest: (shelters: Shelter[], lat: number, lng: number) => void;
  enterNearMeMode: () => void;
  enterSavedLocationMode: (location: LocationPoint, label?: string) => void;
  enterEmergencyMode: () => void;
  enterEmergencyLocationMode: (location: LocationPoint, label?: string) => void;
  exitEmergencyMode: () => void;
  exitNearMeMode: () => void;
  onDismissBase: () => void;
  onResetSelection: () => void;
  onTrackEmergency: () => void;
  t: (key: TranslationKey) => string;
}

interface UseEmergencyLookupFlowResult {
  dismissAlert: () => void;
  handleNearMeClick: () => void;
  handleSearchFromSavedLocation: (location: LocationPoint, label?: string) => void;
  handleEmergencyClick: () => void;
  handleUseLastKnownLocation: () => void;
  handleExitEmergency: () => void;
  handleExitNearMe: () => void;
  handleUseMapCenter: () => void;
}

export function useEmergencyLookupFlow({
  isAlertActive,
  emergencyMode,
  activeLookupLocation,
  currentLocation,
  lastKnownLocation,
  locationError,
  allShelters,
  mapRef,
  getLocation,
  clearNearest,
  findNearest,
  enterNearMeMode,
  enterSavedLocationMode,
  enterEmergencyMode,
  enterEmergencyLocationMode,
  exitEmergencyMode,
  exitNearMeMode,
  onDismissBase,
  onResetSelection,
  onTrackEmergency,
  t,
}: UseEmergencyLookupFlowArgs): UseEmergencyLookupFlowResult {
  const alertFallbackAppliedRef = useRef(false);

  const resetLookupSelection = useCallback(() => {
    onResetSelection();
    clearNearest();
  }, [clearNearest, onResetSelection]);

  const activateEmergencyFromAlert = useCallback(() => {
    enterEmergencyMode();
    onResetSelection();
    getLocation();
  }, [enterEmergencyMode, getLocation, onResetSelection]);

  const { dismissAlert } = useEmergencyAlertEffects({
    isAlertActive,
    onDismissBase,
    onActivateEmergency: activateEmergencyFromAlert,
  });

  const handleNearMeClick = useCallback(() => {
    enterNearMeMode();
    onResetSelection();
    getLocation();
  }, [enterNearMeMode, getLocation, onResetSelection]);

  const handleSearchFromSavedLocation = useCallback((location: LocationPoint, label?: string) => {
    enterSavedLocationMode(location, label);
    resetLookupSelection();
  }, [enterSavedLocationMode, resetLookupSelection]);

  const handleEmergencyClick = useCallback(() => {
    enterEmergencyMode();
    onResetSelection();
    getLocation();
    onTrackEmergency();
  }, [enterEmergencyMode, getLocation, onResetSelection, onTrackEmergency]);

  const handleUseLastKnownLocation = useCallback(() => {
    if (!lastKnownLocation) return;
    enterEmergencyLocationMode(lastKnownLocation, t('emergency.lastKnownLocationLabel'));
    resetLookupSelection();
  }, [enterEmergencyLocationMode, lastKnownLocation, resetLookupSelection, t]);

  useEffect(() => {
    if (!isAlertActive) {
      alertFallbackAppliedRef.current = false;
      return;
    }

    if (
      !emergencyMode ||
      alertFallbackAppliedRef.current ||
      !locationError ||
      !lastKnownLocation ||
      currentLocation ||
      activeLookupLocation
    ) {
      return;
    }

    enterEmergencyLocationMode(lastKnownLocation, t('emergency.lastKnownLocationLabel'));
    resetLookupSelection();
    alertFallbackAppliedRef.current = true;
  }, [
    activeLookupLocation,
    currentLocation,
    emergencyMode,
    enterEmergencyLocationMode,
    isAlertActive,
    lastKnownLocation,
    locationError,
    resetLookupSelection,
    t,
  ]);

  const handleExitEmergency = useCallback(() => {
    exitEmergencyMode();
    resetLookupSelection();
  }, [exitEmergencyMode, resetLookupSelection]);

  const handleExitNearMe = useCallback(() => {
    exitNearMeMode();
    resetLookupSelection();
  }, [exitNearMeMode, resetLookupSelection]);

  const handleUseMapCenter = useCallback(() => {
    const map = mapRef.current;
    if (!map || !allShelters.length) return;
    const center = map.getCenter();
    findNearest(allShelters, center.lat, center.lng);
  }, [allShelters, findNearest, mapRef]);

  return {
    dismissAlert,
    handleNearMeClick,
    handleSearchFromSavedLocation,
    handleEmergencyClick,
    handleUseLastKnownLocation,
    handleExitEmergency,
    handleExitNearMe,
    handleUseMapCenter,
  };
}

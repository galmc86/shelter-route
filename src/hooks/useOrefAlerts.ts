import { useState, useEffect, useCallback, useRef } from 'react';
import {
  type OrefAlert,
  type AlertRegion,
  subscribeToAlerts,
  getTimeToShelter,
} from '../services/orefAlertService';

interface UseOrefAlertsResult {
  activeAlerts: OrefAlert[];
  matchedRegion: AlertRegion | null;
  isAlertActive: boolean;
  timeToShelter: number | null;
  countdown: number | null;
  alertTimestamp: number | null;
  dismissAlert: () => void;
  isEnabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

export function useOrefAlerts(
  userLat: number | null,
  userLng: number | null
): UseOrefAlertsResult {
  const [activeAlerts, setActiveAlerts] = useState<OrefAlert[]>([]);
  const [matchedRegion, setMatchedRegion] = useState<AlertRegion | null>(null);
  const [alertTimestamp, setAlertTimestamp] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isEnabled, setEnabled] = useState(() => {
    return localStorage.getItem('shelter-route:oref-alerts') !== 'disabled';
  });
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleAlerts = useCallback((alerts: OrefAlert[], region: AlertRegion | null) => {
    setActiveAlerts(alerts);

    if (region && alerts.length > 0) {
      setMatchedRegion(region);
      setAlertTimestamp(Date.now());
      setDismissed(false);
    } else if (alerts.length === 0) {
      setMatchedRegion(null);
      setAlertTimestamp(null);
      setCountdown(null);
    }
  }, []);

  // Subscribe to OREF alerts
  useEffect(() => {
    if (!isEnabled) return;

    const unsubscribe = subscribeToAlerts(userLat, userLng, handleAlerts);
    return unsubscribe;
  }, [userLat, userLng, isEnabled, handleAlerts]);

  // Countdown timer
  useEffect(() => {
    if (alertTimestamp && matchedRegion && !dismissed) {
      const totalTime = matchedRegion.timeToShelter;

      const updateCountdown = () => {
        const elapsed = Math.floor((Date.now() - alertTimestamp) / 1000);
        const remaining = Math.max(0, totalTime - elapsed);
        setCountdown(remaining);

        if (remaining <= 0 && countdownRef.current) {
          clearInterval(countdownRef.current);
        }
      };

      updateCountdown();
      countdownRef.current = setInterval(updateCountdown, 1000);

      return () => {
        if (countdownRef.current) clearInterval(countdownRef.current);
      };
    } else {
      setCountdown(null); // eslint-disable-line react-hooks/set-state-in-effect -- clearing countdown when alert dismissed
    }
  }, [alertTimestamp, matchedRegion, dismissed]);

  // Persist enabled state
  useEffect(() => {
    localStorage.setItem('shelter-route:oref-alerts', isEnabled ? 'enabled' : 'disabled');
  }, [isEnabled]);

  const dismissAlert = useCallback(() => {
    setDismissed(true);
    setCountdown(null);
  }, []);

  const timeToShelter = userLat && userLng ? getTimeToShelter(userLat, userLng) : null;

  return {
    activeAlerts,
    matchedRegion,
    isAlertActive: matchedRegion !== null && activeAlerts.length > 0 && !dismissed,
    timeToShelter,
    countdown,
    alertTimestamp,
    dismissAlert,
    isEnabled,
    setEnabled,
  };
}

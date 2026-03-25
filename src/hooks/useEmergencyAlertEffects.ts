import { useCallback, useEffect, useRef } from 'react';
import { playAlertSound, stopAlertSound } from '../utils/alertSound';

interface UseEmergencyAlertEffectsArgs {
  isAlertActive: boolean;
  onDismissBase: () => void;
  onActivateEmergency: () => void;
}

interface UseEmergencyAlertEffectsResult {
  dismissAlert: () => void;
}

export function useEmergencyAlertEffects({
  isAlertActive,
  onDismissBase,
  onActivateEmergency,
}: UseEmergencyAlertEffectsArgs): UseEmergencyAlertEffectsResult {
  const prevAlertActive = useRef(false);
  const vibrationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const activationTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPendingActivation = useCallback(() => {
    if (activationTimeout.current) {
      clearTimeout(activationTimeout.current);
      activationTimeout.current = null;
    }
  }, []);

  const stopEmergencyFeedback = useCallback(() => {
    stopAlertSound();
    if (vibrationInterval.current) {
      clearInterval(vibrationInterval.current);
      vibrationInterval.current = null;
    }
    if (navigator.vibrate) {
      navigator.vibrate(0);
    }
  }, []);

  const dismissAlert = useCallback(() => {
    clearPendingActivation();
    onDismissBase();
    stopEmergencyFeedback();
  }, [clearPendingActivation, onDismissBase, stopEmergencyFeedback]);

  const activateEmergencyFromAlert = useCallback(() => {
    activationTimeout.current = null;
    onActivateEmergency();
    playAlertSound();

    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 400]);
      vibrationInterval.current = setInterval(() => {
        navigator.vibrate([200, 100, 200, 100, 400]);
      }, 1200);
    }
  }, [onActivateEmergency]);

  useEffect(() => {
    if (isAlertActive && !prevAlertActive.current) {
      clearPendingActivation();
      activationTimeout.current = setTimeout(() => {
        activateEmergencyFromAlert();
      }, 0);
    }

    if (!isAlertActive && prevAlertActive.current) {
      clearPendingActivation();
      stopEmergencyFeedback();
    }

    prevAlertActive.current = isAlertActive;
  }, [activateEmergencyFromAlert, clearPendingActivation, isAlertActive, stopEmergencyFeedback]);

  useEffect(() => {
    return () => {
      clearPendingActivation();
      stopEmergencyFeedback();
    };
  }, [clearPendingActivation, stopEmergencyFeedback]);

  return {
    dismissAlert,
  };
}

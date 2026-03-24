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
    onDismissBase();
    stopEmergencyFeedback();
  }, [onDismissBase, stopEmergencyFeedback]);

  const activateEmergencyFromAlert = useCallback(() => {
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
      setTimeout(() => {
        activateEmergencyFromAlert();
      }, 0);
    }

    if (!isAlertActive && prevAlertActive.current) {
      stopEmergencyFeedback();
    }

    prevAlertActive.current = isAlertActive;
  }, [activateEmergencyFromAlert, isAlertActive, stopEmergencyFeedback]);

  return {
    dismissAlert,
  };
}

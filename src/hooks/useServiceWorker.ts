import { useState, useEffect, useCallback } from 'react';

const SW_UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes

interface ServiceWorkerState {
  isUpdateAvailable: boolean;
  applyUpdate: () => void;
}

export function useServiceWorker(): ServiceWorkerState {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let updateInterval: ReturnType<typeof setInterval> | undefined;
    let refreshing = false;
    let removeRegistrationListeners = () => {};

    const applyWaitingWorker = (worker: ServiceWorker) => {
      setWaitingWorker(worker);
      setIsUpdateAvailable(true);
      worker.postMessage({ type: 'SKIP_WAITING' });
    };

    function trackWaitingWorker(reg: ServiceWorkerRegistration) {
      // Check if there's already a waiting worker
      if (reg.waiting) {
        applyWaitingWorker(reg.waiting);
      }

      // Listen for new updates
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            applyWaitingWorker(newWorker);
          }
        });
      });
    }

    const refreshRegistration = (registration: ServiceWorkerRegistration) => {
      registration.update().catch(() => {
        // ignore transient update-check failures
      });
    };

    // Register the service worker
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((registration) => {
        console.log('SW registered:', registration.scope);

        trackWaitingWorker(registration);
        refreshRegistration(registration);

        // Check for updates periodically
        updateInterval = setInterval(() => {
          refreshRegistration(registration);
        }, SW_UPDATE_INTERVAL);

        const handleVisible = () => {
          if (!document.hidden) {
            refreshRegistration(registration);
          }
        };

        const handleOnline = () => {
          refreshRegistration(registration);
        };

        const handleFocus = () => {
          refreshRegistration(registration);
        };

        document.addEventListener('visibilitychange', handleVisible);
        window.addEventListener('online', handleOnline);
        window.addEventListener('focus', handleFocus);
        removeRegistrationListeners = () => {
          document.removeEventListener('visibilitychange', handleVisible);
          window.removeEventListener('online', handleOnline);
          window.removeEventListener('focus', handleFocus);
        };
      })
      .catch((error) => {
        console.log('SW registration failed:', error);
      });

    // Handle controller change (reload when new SW takes control)
    const handleControllerChange = () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    };
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    return () => {
      if (updateInterval) {
        clearInterval(updateInterval);
      }
      removeRegistrationListeners();
      navigator.serviceWorker.removeEventListener?.('controllerchange', handleControllerChange);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }
  }, [waitingWorker]);

  return { isUpdateAvailable, applyUpdate };
}

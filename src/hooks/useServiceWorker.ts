import { useState, useEffect, useCallback } from 'react';

const SW_UPDATE_INTERVAL = 60 * 60 * 1000; // 60 minutes

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

    function trackWaitingWorker(reg: ServiceWorkerRegistration) {
      // Check if there's already a waiting worker
      if (reg.waiting) {
        setWaitingWorker(reg.waiting);
        setIsUpdateAvailable(true);
      }

      // Listen for new updates
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version available
            setWaitingWorker(newWorker);
            setIsUpdateAvailable(true);
          }
        });
      });
    }

    // Register the service worker
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('SW registered:', registration.scope);

        trackWaitingWorker(registration);

        // Check for updates periodically
        updateInterval = setInterval(() => {
          registration.update();
        }, SW_UPDATE_INTERVAL);
      })
      .catch((error) => {
        console.log('SW registration failed:', error);
      });

    // Handle controller change (reload when new SW takes control)
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });

    return () => {
      if (updateInterval) {
        clearInterval(updateInterval);
      }
    };
  }, []);

  const applyUpdate = useCallback(() => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }
  }, [waitingWorker]);

  return { isUpdateAvailable, applyUpdate };
}

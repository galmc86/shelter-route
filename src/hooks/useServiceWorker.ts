import { useState, useEffect, useCallback } from 'react';

interface ServiceWorkerState {
  isUpdateAvailable: boolean;
  applyUpdate: () => void;
}

export function useServiceWorker(): ServiceWorkerState {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let registration: ServiceWorkerRegistration | undefined;

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return;
      registration = reg;

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
    });

    // Handle controller change (reload when new SW takes control)
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }, []);

  const applyUpdate = useCallback(() => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }
  }, [waitingWorker]);

  return { isUpdateAvailable, applyUpdate };
}

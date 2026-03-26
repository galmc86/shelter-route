import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useServiceWorker } from '../useServiceWorker';

describe('useServiceWorker', () => {
  const originalServiceWorker = navigator.serviceWorker;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (originalServiceWorker) {
      Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: originalServiceWorker,
      });
    }
  });

  it('registers the service worker without update cache and activates waiting updates immediately', async () => {
    const waitingWorker = {
      postMessage: vi.fn(),
    } as unknown as ServiceWorker;

    const registration = {
      scope: '/',
      waiting: waitingWorker,
      installing: null,
      update: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn(),
    } as unknown as ServiceWorkerRegistration;

    const addEventListener = vi.fn();
    const register = vi.fn().mockResolvedValue(registration);

    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        controller: {},
        register,
        addEventListener,
      },
    });

    const { result } = renderHook(() => useServiceWorker());

    await waitFor(() => {
      expect(register).toHaveBeenCalledWith('/sw.js', {
        scope: '/',
        updateViaCache: 'none',
      });
    });
    await waitFor(() => {
      expect(waitingWorker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    });

    expect(registration.update).toHaveBeenCalledTimes(1);
    expect(result.current.isUpdateAvailable).toBe(true);
    expect(addEventListener).toHaveBeenCalledWith('controllerchange', expect.any(Function));
  });

  it('refreshes the registration when the page becomes visible again', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const registration = {
      scope: '/',
      waiting: null,
      installing: null,
      update,
      addEventListener: vi.fn(),
    } as unknown as ServiceWorkerRegistration;

    const register = vi.fn().mockResolvedValue(registration);

    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        controller: {},
        register,
        addEventListener: vi.fn(),
      },
    });

    renderHook(() => useServiceWorker());

    await waitFor(() => {
      expect(register).toHaveBeenCalledTimes(1);
    });

    update.mockClear();
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: false,
    });

    document.dispatchEvent(new Event('visibilitychange'));

    await waitFor(() => {
      expect(update).toHaveBeenCalledTimes(1);
    });
  });
});

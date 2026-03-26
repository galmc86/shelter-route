import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockResilientFetch = vi.fn();
const mockGetFamilyRemoteSession = vi.fn(() => ({
  deviceId: 'device-1',
  userId: null,
  authState: 'anonymous',
}));

vi.mock('../fetchClient', () => ({
  resilientFetch: (...args: unknown[]) => mockResilientFetch(...args),
}));

vi.mock('../familyRemoteSessionService', () => ({
  getFamilyRemoteSession: () => mockGetFamilyRemoteSession(),
}));

describe('familyPushNotificationService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_FAMILY_REMOTE_URL', 'https://family.example.com');
    mockResilientFetch.mockReset();
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: {
        permission: 'granted',
      },
    });
    Object.defineProperty(window, 'PushManager', {
      configurable: true,
      value: function PushManager() {},
    });
  });

  it('registers the current push subscription for a family group', async () => {
    const subscription = {
      endpoint: 'https://push.example.com/subscription-1',
      toJSON: () => ({
        endpoint: 'https://push.example.com/subscription-1',
        expirationTime: null,
        keys: {
          p256dh: 'p256dh-key',
          auth: 'auth-key',
        },
      }),
    };
    const subscribe = vi.fn();

    Object.defineProperty(window.navigator, 'serviceWorker', {
      configurable: true,
      value: {
        ready: Promise.resolve({
          pushManager: {
            getSubscription: vi.fn().mockResolvedValue(subscription),
            subscribe,
          },
        }),
      },
    });

    mockResilientFetch
      .mockResolvedValueOnce({
        ok: true,
        data: { enabled: true, publicKey: 'BElocalExampleKey1234567890' },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: { registered: true },
      });

    const { isFamilyPushRegisteredForGroup, syncFamilyPushSubscription } = await import('../familyPushNotificationService');
    expect(await syncFamilyPushSubscription('ABC123')).toBe(true);
    expect(isFamilyPushRegisteredForGroup('ABC123')).toBe(true);
    expect(mockResilientFetch).toHaveBeenNthCalledWith(
      2,
      'https://family.example.com/ABC123/push-subscriptions',
      expect.objectContaining({
        method: 'POST',
      }),
      expect.any(Object)
    );
    expect(subscribe).not.toHaveBeenCalled();
  });

  it('subscribes with a Uint8Array VAPID key when no existing subscription is present', async () => {
    const subscribe = vi.fn().mockResolvedValue({
      endpoint: 'https://push.example.com/subscription-2',
      toJSON: () => ({
        endpoint: 'https://push.example.com/subscription-2',
        expirationTime: null,
        keys: {
          p256dh: 'p256dh-key',
          auth: 'auth-key',
        },
      }),
    });

    Object.defineProperty(window.navigator, 'serviceWorker', {
      configurable: true,
      value: {
        ready: Promise.resolve({
          pushManager: {
            getSubscription: vi.fn().mockResolvedValue(null),
            subscribe,
          },
        }),
      },
    });

    mockResilientFetch
      .mockResolvedValueOnce({
        ok: true,
        data: { enabled: true, publicKey: 'BElocalExampleKey1234567890' },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: { registered: true },
      });

    const { syncFamilyPushSubscription } = await import('../familyPushNotificationService');
    expect(await syncFamilyPushSubscription('ABC123')).toBe(true);
    expect(subscribe).toHaveBeenCalledWith(expect.objectContaining({
      userVisibleOnly: true,
      applicationServerKey: expect.any(Uint8Array),
    }));
  });

  it('unregisters the current push subscription for a family group', async () => {
    localStorage.setItem('shelter-route:family-push-group', 'ABC123');
    localStorage.setItem('shelter-route:family-push-endpoint', 'https://push.example.com/subscription-1');
    Object.defineProperty(window.navigator, 'serviceWorker', {
      configurable: true,
      value: {
        ready: Promise.resolve({
          pushManager: {
            getSubscription: vi.fn().mockResolvedValue({
              endpoint: 'https://push.example.com/subscription-1',
            }),
          },
        }),
      },
    });
    mockResilientFetch.mockResolvedValue({
      ok: true,
      data: { unregistered: true },
    });

    const { isFamilyPushRegisteredForGroup, unregisterFamilyPushSubscription } = await import('../familyPushNotificationService');
    await unregisterFamilyPushSubscription('ABC123');

    expect(isFamilyPushRegisteredForGroup('ABC123')).toBe(false);
    expect(mockResilientFetch).toHaveBeenCalledWith(
      'https://family.example.com/ABC123/push-subscriptions/unregister',
      expect.objectContaining({
        method: 'POST',
      }),
      expect.any(Object)
    );
  });
});

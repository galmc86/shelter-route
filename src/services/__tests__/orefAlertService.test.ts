import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The OREF_ALERTS_URL constant is captured at module load from import.meta.env.
// We need to mock the module so we can control that constant.
// We'll mock the module to dynamically re-export everything from the real module,
// but with OREF_ALERTS_URL properly set.

// First, mock just the subscribeToAlerts internals by providing env before import.
// Vitest transforms import.meta.env into process.env-like access; setting it
// via the test config's `env` or via globalThis before import should work.
// But since the const is already captured, we use vi.mock to intercept.

// Strategy: We'll test the pure functions directly (they don't depend on env),
// and for subscribeToAlerts, we'll mock the module to provide a version where
// OREF_ALERTS_URL is set.

import {
  haversineKm,
  matchUserToAlertRegion,
  getTimeToShelter,
  type OrefAlert,
} from '../orefAlertService';

// Helper to create a mock Response with .text() support
function mockResponse(body: string, ok = true, status = 200): Response {
  return {
    ok,
    status,
    text: () => Promise.resolve(body),
    json: () => Promise.resolve(JSON.parse(body || '{}')),
    headers: new Headers(),
    redirected: false,
    statusText: ok ? 'OK' : 'Error',
    type: 'basic' as ResponseType,
    url: '',
    clone: function () { return mockResponse(body, ok, status); },
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    bytes: () => Promise.resolve(new Uint8Array()),
  } as Response;
}

function makeAlert(overrides: Partial<OrefAlert> = {}): OrefAlert {
  return {
    id: '1',
    cat: '1',
    title: 'ירי רקטות וטילים',
    data: ['תל אביב'],
    desc: 'היכנסו למרחב המוגן',
    alertDate: new Date().toISOString(),
    ...overrides,
  };
}

// ─── haversineKm ──────────────────────────────────────────────────────────────

describe('haversineKm', () => {
  it('returns 0 for same point', () => {
    expect(haversineKm(32.085, 34.782, 32.085, 34.782)).toBe(0);
  });

  it('calculates Tel Aviv to Jerusalem ~54-62 km', () => {
    const dist = haversineKm(32.085, 34.782, 31.768, 35.214);
    expect(dist).toBeGreaterThan(50);
    expect(dist).toBeLessThan(70);
  });

  it('calculates Tel Aviv to Haifa ~80-100 km', () => {
    const dist = haversineKm(32.085, 34.782, 32.794, 34.990);
    expect(dist).toBeGreaterThan(75);
    expect(dist).toBeLessThan(105);
  });

  it('is symmetric', () => {
    const d1 = haversineKm(32.085, 34.782, 31.768, 35.214);
    const d2 = haversineKm(31.768, 35.214, 32.085, 34.782);
    expect(d1).toBeCloseTo(d2, 6);
  });

  it('handles large distances (Tel Aviv to London ~3500 km)', () => {
    const dist = haversineKm(32.085, 34.782, 51.507, -0.128);
    expect(dist).toBeGreaterThan(3400);
    expect(dist).toBeLessThan(3700);
  });
});

// ─── matchUserToAlertRegion ───────────────────────────────────────────────────

describe('matchUserToAlertRegion', () => {
  it('matches user inside an alerted region', () => {
    const result = matchUserToAlertRegion(32.085, 34.782, ['תל אביב']);
    expect(result).not.toBeNull();
    expect(result!.nameEn).toBe('Tel Aviv');
  });

  it('returns general fallback when user is outside all alerted regions', () => {
    const result = matchUserToAlertRegion(29.557, 34.952, ['תל אביב']);
    // With general alert fallback, returns a generic region instead of null
    expect(result).not.toBeNull();
    expect(result!.timeToShelter).toBe(90); // default fallback time
  });

  it('returns general fallback when no areas match any region', () => {
    const result = matchUserToAlertRegion(32.085, 34.782, ['מקום לא קיים']);
    expect(result).not.toBeNull();
    expect(result!.timeToShelter).toBe(90);
  });

  it('returns null for empty alerted areas', () => {
    const result = matchUserToAlertRegion(32.085, 34.782, []);
    expect(result).toBeNull();
  });

  it('matches when alerted area name includes region name (substring match)', () => {
    const result = matchUserToAlertRegion(31.525, 34.596, ['שדרות, אשקלון']);
    expect(result).not.toBeNull();
    expect(result!.nameEn).toBe('Sderot, Ashkelon');
  });

  it('matches when region name includes the alerted area (partial match)', () => {
    const result = matchUserToAlertRegion(31.525, 34.596, ['שדרות']);
    expect(result).not.toBeNull();
    expect(result!.nameEn).toBe('Sderot, Ashkelon');
  });

  it('returns general fallback when user is outside radius even if area matches', () => {
    // Tel Aviv region has radius 10km. Place user >10km away
    const result = matchUserToAlertRegion(32.195, 34.782, ['תל אביב']);
    // Falls back to general alert since user is outside the specific region radius
    expect(result).not.toBeNull();
    expect(result!.timeToShelter).toBe(90);
  });
});

// ─── getTimeToShelter ─────────────────────────────────────────────────────────

describe('getTimeToShelter', () => {
  it('returns 60 seconds for Tel Aviv center', () => {
    expect(getTimeToShelter(32.085, 34.782)).toBe(60);
  });

  it('returns 15 seconds for Gaza Envelope area', () => {
    expect(getTimeToShelter(31.374, 34.393)).toBe(15);
  });

  it('returns 30 seconds for Beer Sheva', () => {
    expect(getTimeToShelter(31.252, 34.791)).toBe(30);
  });

  it('returns 60 seconds for Haifa', () => {
    expect(getTimeToShelter(32.794, 34.990)).toBe(60);
  });

  it('returns 15 seconds for Kiryat Shmona (near Lebanon border)', () => {
    expect(getTimeToShelter(33.208, 35.573)).toBe(15);
  });

  it('returns default 90s for a far-away location', () => {
    // Default changed to 90s with general alert fallback
    expect(getTimeToShelter(29.557, 34.952)).toBe(90);
  });

  it('returns region time when user is within 2x radius', () => {
    expect(getTimeToShelter(31.804, 34.655)).toBe(30);
  });
});

// ─── subscribeToAlerts ────────────────────────────────────────────────────────
// Since OREF_ALERTS_URL is a module-level const captured from import.meta.env
// at load time, and vi.stubEnv doesn't reliably set it before module evaluation,
// we dynamically import a fresh copy of the module with the env var properly set.

describe('subscribeToAlerts', () => {
  let subscribeToAlerts: typeof import('../orefAlertService').subscribeToAlerts;
  let getAlertHealthStatus: typeof import('../orefAlertService').getAlertHealthStatus;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_OREF_PROXY_URL', 'https://test-proxy.example.com/alerts');
    // Reset module registry so module re-evaluates with the new env
    vi.resetModules();
    const mod = await import('../orefAlertService');
    subscribeToAlerts = mod.subscribeToAlerts;
    getAlertHealthStatus = mod.getAlertHealthStatus;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  async function flushInitialPoll() {
    await vi.advanceTimersByTimeAsync(0);
  }

  it('makes an initial fetch immediately', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockResponse('[]')
    );
    const callback = vi.fn();

    subscribeToAlerts(32.085, 34.782, callback, 5000);
    await flushInitialPoll();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith('https://test-proxy.example.com/alerts');
  });

  it('calls callback with empty alerts on empty JSON array', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse('[]'));
    const callback = vi.fn();

    subscribeToAlerts(32.085, 34.782, callback, 5000);
    await flushInitialPoll();

    expect(callback).toHaveBeenCalledWith([], null);
  });

  it('calls callback with empty alerts on empty string response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse(''));
    const callback = vi.fn();

    subscribeToAlerts(32.085, 34.782, callback, 5000);
    await flushInitialPoll();

    expect(callback).toHaveBeenCalledWith([], null);
  });

  it('calls callback with empty alerts on whitespace-only response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse('   \n  '));
    const callback = vi.fn();

    subscribeToAlerts(32.085, 34.782, callback, 5000);
    await flushInitialPoll();

    expect(callback).toHaveBeenCalledWith([], null);
  });

  it('parses alerts and matches region for user in alerted area', async () => {
    const alert = makeAlert({ data: ['תל אביב'] });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockResponse(JSON.stringify([alert]))
    );
    const callback = vi.fn();

    subscribeToAlerts(32.085, 34.782, callback, 5000);
    await flushInitialPoll();

    expect(callback).toHaveBeenCalledTimes(1);
    const [alerts, matchedRegion] = callback.mock.calls[0];
    expect(alerts).toHaveLength(1);
    expect(alerts[0].id).toBe('1');
    expect(matchedRegion).not.toBeNull();
    expect(matchedRegion.nameEn).toBe('Tel Aviv');
  });

  it('returns null matchedRegion when user coordinates are null', async () => {
    const alert = makeAlert({ data: ['תל אביב'] });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockResponse(JSON.stringify([alert]))
    );
    const callback = vi.fn();

    subscribeToAlerts(null, null, callback, 5000);
    await flushInitialPoll();

    const [alerts, matchedRegion] = callback.mock.calls[0];
    expect(alerts).toHaveLength(1);
    expect(matchedRegion).toBeNull();
  });

  it('stops polling after unsubscribe', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockResponse('[]')
    );
    const callback = vi.fn();

    const unsubscribe = subscribeToAlerts(32.085, 34.782, callback, 5000);
    await flushInitialPoll();

    const callCountAfterInitial = fetchSpy.mock.calls.length;
    unsubscribe();

    await vi.advanceTimersByTimeAsync(30000);
    expect(fetchSpy.mock.calls.length).toBe(callCountAfterInitial);
  });

  it('returns noop when OREF URL is not configured', async () => {
    vi.restoreAllMocks();
    vi.stubEnv('VITE_OREF_PROXY_URL', '');
    vi.resetModules();
    const mod = await import('../orefAlertService');

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse('[]'));
    const callback = vi.fn();
    const unsubscribe = mod.subscribeToAlerts(32.085, 34.782, callback, 5000);

    await vi.advanceTimersByTimeAsync(10000);

    // Should not have polled at all
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(callback).not.toHaveBeenCalled();
    expect(() => unsubscribe()).not.toThrow();
  });

  describe('exponential backoff on failures', () => {
    it('applies backoff on HTTP error responses', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(mockResponse('', false, 503))
        .mockResolvedValueOnce(mockResponse('', false, 503))
        .mockResolvedValue(mockResponse('[]'));

      const callback = vi.fn();
      const healthCallback = vi.fn();

      subscribeToAlerts(32.085, 34.782, callback, 5000, healthCallback);

      // Initial poll fails
      await flushInitialPoll();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(healthCallback).toHaveBeenCalledWith('degraded');

      // After 1 failure, backoff = 5000 * 2^0 = 5000ms
      await vi.advanceTimersByTimeAsync(5000);
      expect(fetchSpy).toHaveBeenCalledTimes(2);

      // After 2 failures, backoff = 5000 * 2^1 = 10000ms
      await vi.advanceTimersByTimeAsync(10000);
      expect(fetchSpy).toHaveBeenCalledTimes(3);
      expect(healthCallback).toHaveBeenCalledWith('connected');
    });

    it('applies backoff on network exceptions', async () => {
      vi.spyOn(globalThis, 'fetch')
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue(mockResponse('[]'));

      const healthCallback = vi.fn();
      subscribeToAlerts(32.085, 34.782, vi.fn(), 5000, healthCallback);

      await flushInitialPoll();
      expect(healthCallback).toHaveBeenCalledWith('degraded');

      await vi.advanceTimersByTimeAsync(5000);
      expect(healthCallback).toHaveBeenCalledWith('connected');
    });

    it('caps backoff at 60000ms', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(mockResponse('', false, 503)) // fail 1: backoff 5000
        .mockResolvedValueOnce(mockResponse('', false, 503)) // fail 2: backoff 10000
        .mockResolvedValueOnce(mockResponse('', false, 503)) // fail 3: backoff 20000
        .mockResolvedValueOnce(mockResponse('', false, 503)) // fail 4: backoff 40000
        .mockResolvedValueOnce(mockResponse('', false, 503)) // fail 5: backoff 60000 (capped)
        .mockResolvedValue(mockResponse('[]'));

      subscribeToAlerts(32.085, 34.782, vi.fn(), 5000);

      await flushInitialPoll();                  // fail 1
      await vi.advanceTimersByTimeAsync(5000);   // fail 2
      await vi.advanceTimersByTimeAsync(10000);  // fail 3
      await vi.advanceTimersByTimeAsync(20000);  // fail 4
      await vi.advanceTimersByTimeAsync(40000);  // fail 5

      // After 5 failures: 5000 * 2^4 = 80000, capped at 60000
      await vi.advanceTimersByTimeAsync(60000);  // success
      expect(fetchSpy).toHaveBeenCalledTimes(6);
    });

    it('resets backoff after successful poll', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(mockResponse('', false, 503)) // fail
        .mockResolvedValueOnce(mockResponse('[]'))            // success
        .mockResolvedValueOnce(mockResponse('[]'));           // success

      const callback = vi.fn();
      subscribeToAlerts(32.085, 34.782, callback, 5000);

      await flushInitialPoll();
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // After 1 failure, backoff = 5000ms
      await vi.advanceTimersByTimeAsync(5000);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenCalledWith([], null);

      // Backoff reset to intervalMs (5000)
      await vi.advanceTimersByTimeAsync(5000);
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe('health status transitions', () => {
    it('reports connected on successful poll', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse('[]'));
      const healthCallback = vi.fn();

      subscribeToAlerts(32.085, 34.782, vi.fn(), 5000, healthCallback);
      await flushInitialPoll();

      expect(healthCallback).toHaveBeenCalledWith('connected');
    });

    it('reports degraded after 1-2 consecutive failures', async () => {
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(mockResponse('', false, 500))
        .mockResolvedValueOnce(mockResponse('', false, 500))
        .mockResolvedValue(mockResponse('[]'));

      const healthCallback = vi.fn();
      subscribeToAlerts(32.085, 34.782, vi.fn(), 5000, healthCallback);

      await flushInitialPoll();
      expect(healthCallback).toHaveBeenCalledWith('degraded');

      await vi.advanceTimersByTimeAsync(5000);
      expect(healthCallback).toHaveBeenLastCalledWith('degraded');
    });

    it('reports reconnecting after 3+ consecutive failures', async () => {
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(mockResponse('', false, 500))
        .mockResolvedValueOnce(mockResponse('', false, 500))
        .mockResolvedValueOnce(mockResponse('', false, 500))
        .mockResolvedValue(mockResponse('[]'));

      const healthCallback = vi.fn();
      subscribeToAlerts(32.085, 34.782, vi.fn(), 5000, healthCallback);

      await flushInitialPoll();                  // fail 1 -> degraded
      await vi.advanceTimersByTimeAsync(5000);   // fail 2 -> degraded
      await vi.advanceTimersByTimeAsync(10000);  // fail 3 -> reconnecting

      expect(healthCallback).toHaveBeenCalledWith('reconnecting');
    });

    it('transitions from reconnecting back to connected on recovery', async () => {
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(mockResponse('', false, 500))
        .mockResolvedValueOnce(mockResponse('', false, 500))
        .mockResolvedValueOnce(mockResponse('', false, 500))
        .mockResolvedValueOnce(mockResponse('[]'));

      const healthCallback = vi.fn();
      subscribeToAlerts(32.085, 34.782, vi.fn(), 5000, healthCallback);

      await flushInitialPoll();                  // fail 1
      await vi.advanceTimersByTimeAsync(5000);   // fail 2
      await vi.advanceTimersByTimeAsync(10000);  // fail 3 -> reconnecting

      expect(healthCallback).toHaveBeenCalledWith('reconnecting');

      await vi.advanceTimersByTimeAsync(20000);  // success -> connected

      expect(healthCallback).toHaveBeenLastCalledWith('connected');
    });

    it('getAlertHealthStatus returns module-level current status', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse('[]'));

      subscribeToAlerts(32.085, 34.782, vi.fn(), 5000);
      await flushInitialPoll();

      expect(getAlertHealthStatus()).toBe('connected');
    });
  });

  describe('malformed response handling', () => {
    it('handles malformed JSON gracefully (triggers backoff)', async () => {
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(mockResponse('not valid json'))
        .mockResolvedValue(mockResponse('[]'));

      const callback = vi.fn();
      const healthCallback = vi.fn();

      subscribeToAlerts(32.085, 34.782, callback, 5000, healthCallback);
      await flushInitialPoll();

      expect(healthCallback).toHaveBeenCalledWith('degraded');
      expect(callback).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(5000);
      expect(callback).toHaveBeenCalledWith([], null);
      expect(healthCallback).toHaveBeenCalledWith('connected');
    });

  });
});

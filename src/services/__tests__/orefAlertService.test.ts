import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock import.meta.env
vi.stubEnv('VITE_OREF_PROXY_URL', 'https://proxy.example.com');

describe('subscribeToAlerts', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls callback with alerts on successful fetch', async () => {
    const mockAlerts = [
      { id: '1', cat: '1', title: 'Alert', data: ['תל אביב'], desc: '', alertDate: '2024-01-01T00:00:00Z' },
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockAlerts),
      clone: () => ({ ok: true, status: 200, json: () => Promise.resolve(mockAlerts) }),
      headers: new Headers(),
      statusText: 'OK',
    } as unknown as Response);

    const { subscribeToAlerts } = await import('../orefAlertService');
    const callback = vi.fn();

    const cleanup = subscribeToAlerts(32.085, 34.782, callback, 5000);

    // Wait for first check
    await vi.advanceTimersByTimeAsync(100);

    expect(callback).toHaveBeenCalledWith(
      mockAlerts,
      expect.anything() // matchedRegion
    );

    cleanup();
  });

  it('calls callback with empty array when response is empty', async () => {
    // Empty response body - will cause PARSE error in resilientFetch
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.reject(new SyntaxError('Unexpected end of JSON input')),
      clone: () => ({ ok: true, status: 200, json: () => Promise.reject(new SyntaxError('Unexpected end of JSON input')) }),
      headers: new Headers(),
      statusText: 'OK',
    } as unknown as Response);

    const { subscribeToAlerts } = await import('../orefAlertService');
    const callback = vi.fn();

    const cleanup = subscribeToAlerts(null, null, callback, 5000);
    await vi.advanceTimersByTimeAsync(100);

    expect(callback).toHaveBeenCalledWith([], null);

    cleanup();
  });

  it('increments consecutive failures on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    const { subscribeToAlerts } = await import('../orefAlertService');
    const callback = vi.fn();

    const cleanup = subscribeToAlerts(null, null, callback, 1000);

    // First check fails
    await vi.advanceTimersByTimeAsync(100);
    expect(callback).not.toHaveBeenCalled();

    // Second check
    await vi.advanceTimersByTimeAsync(1000);
    expect(callback).not.toHaveBeenCalled();

    // Third check
    await vi.advanceTimersByTimeAsync(1000);
    expect(callback).not.toHaveBeenCalled();

    // After 3 consecutive failures, polling stops
    await vi.advanceTimersByTimeAsync(1000);
    expect(callback).not.toHaveBeenCalled();

    cleanup();
  });

  it('increments consecutive failures on HTTP error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: () => Promise.resolve({}),
      clone: () => ({ ok: false, status: 500, json: () => Promise.resolve({}) }),
      headers: new Headers(),
    } as unknown as Response);

    const { subscribeToAlerts } = await import('../orefAlertService');
    const callback = vi.fn();

    const cleanup = subscribeToAlerts(null, null, callback, 1000);

    // Let failures accumulate
    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);

    // Should not have called callback with alerts
    expect(callback).not.toHaveBeenCalled();

    cleanup();
  });

  it('returns noop cleanup when no proxy URL configured', async () => {
    vi.stubEnv('VITE_OREF_PROXY_URL', '');

    const { subscribeToAlerts } = await import('../orefAlertService');
    const callback = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const cleanup = subscribeToAlerts(null, null, callback, 1000);

    await vi.advanceTimersByTimeAsync(5000);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(callback).not.toHaveBeenCalled();

    cleanup();
  });

  it('cleans up interval on unsubscribe', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve([]),
      clone: () => ({ ok: true, status: 200, json: () => Promise.resolve([]) }),
      headers: new Headers(),
      statusText: 'OK',
    } as unknown as Response);

    const { subscribeToAlerts } = await import('../orefAlertService');
    const callback = vi.fn();

    const cleanup = subscribeToAlerts(null, null, callback, 1000);

    await vi.advanceTimersByTimeAsync(100);
    const callCount = callback.mock.calls.length;

    cleanup();

    await vi.advanceTimersByTimeAsync(5000);
    // No additional calls after cleanup
    expect(callback.mock.calls.length).toBe(callCount);
  });
});

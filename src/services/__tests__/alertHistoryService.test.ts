import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock import.meta.env
vi.stubEnv('VITE_OREF_PROXY_URL', 'https://proxy.example.com');

describe('fetchAlertHistory', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('returns alert data on successful fetch', async () => {
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

    const { fetchAlertHistory } = await import('../alertHistoryService');
    const result = await fetchAlertHistory();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('returns empty array on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    const { fetchAlertHistory } = await import('../alertHistoryService');
    const result = await fetchAlertHistory();

    expect(result).toEqual([]);
  });

  it('returns empty array on HTTP error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: () => Promise.resolve({}),
      clone: () => ({ ok: false, status: 500, json: () => Promise.resolve({}) }),
      headers: new Headers(),
    } as unknown as Response);

    const { fetchAlertHistory } = await import('../alertHistoryService');
    const result = await fetchAlertHistory();

    expect(result).toEqual([]);
  });

  it('returns empty array on timeout', async () => {
    vi.useFakeTimers();

    vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => {
      return new Promise((_resolve, reject) => {
        if (init?.signal) {
          init.signal.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        }
      });
    });

    const { fetchAlertHistory } = await import('../alertHistoryService');
    const promise = fetchAlertHistory();
    // Advance past timeout (10000ms) + retry delay (1000ms) + second timeout
    await vi.advanceTimersByTimeAsync(25000);
    const result = await promise;

    expect(result).toEqual([]);

    vi.useRealTimers();
  });

  it('returns empty array when no proxy URL configured', async () => {
    vi.stubEnv('VITE_OREF_PROXY_URL', '');

    const { fetchAlertHistory } = await import('../alertHistoryService');
    const result = await fetchAlertHistory();

    expect(result).toEqual([]);
  });
});

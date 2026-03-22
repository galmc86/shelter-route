import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchPlaces } from '../nominatimService';

describe('searchPlaces (Nominatim)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns parsed places on successful search', async () => {
    const mockData = [
      { lat: '32.0853', lon: '34.7818', display_name: 'תל אביב' },
      { lat: '31.7683', lon: '35.2137', display_name: 'ירושלים' },
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockData),
      clone: () => ({ ok: true, status: 200, json: () => Promise.resolve(mockData) }),
      headers: new Headers(),
      statusText: 'OK',
    } as unknown as Response);

    const result = await searchPlaces('תל אביב');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      lat: 32.0853,
      lng: 34.7818,
      displayName: 'תל אביב',
    });
  });

  it('returns empty array for short queries', async () => {
    const result = await searchPlaces('a');
    expect(result).toEqual([]);
  });

  it('returns empty array for empty queries', async () => {
    const result = await searchPlaces('');
    expect(result).toEqual([]);
  });

  it('returns empty array on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await searchPlaces('תל אביב');

    expect(result).toEqual([]);
  });

  it('returns empty array on HTTP error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: () => Promise.resolve({}),
      clone: () => ({ ok: false, status: 503, json: () => Promise.resolve({}) }),
      headers: new Headers(),
    } as unknown as Response);

    const result = await searchPlaces('תל אביב');

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

    const promise = searchPlaces('תל אביב');
    await vi.advanceTimersByTimeAsync(6000);
    const result = await promise;

    expect(result).toEqual([]);

    vi.useRealTimers();
  });

  it('passes through AbortSignal', async () => {
    const controller = new AbortController();

    vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => {
      return new Promise((_resolve, reject) => {
        if (init?.signal) {
          init.signal.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        }
      });
    });

    const promise = searchPlaces('תל אביב', controller.signal);
    controller.abort();
    const result = await promise;

    expect(result).toEqual([]);
  });
});

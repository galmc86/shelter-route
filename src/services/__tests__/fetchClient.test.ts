import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resilientFetch } from '../fetchClient';
import { ServiceError } from '../serviceResult';

describe('resilientFetch', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function mockFetchResponse(data: unknown, ok = true, status = 200): Response {
    return {
      ok,
      status,
      statusText: ok ? 'OK' : 'Error',
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(JSON.stringify(data)),
      headers: new Headers(),
      redirected: false,
      type: 'basic' as ResponseType,
      url: '',
      clone: () => mockFetchResponse(data, ok, status),
      body: null,
      bodyUsed: false,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      blob: () => Promise.resolve(new Blob()),
      formData: () => Promise.resolve(new FormData()),
      bytes: () => Promise.resolve(new Uint8Array()),
    } as Response;
  }

  it('returns ok:true with data on successful fetch', async () => {
    const payload = { foo: 'bar' };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockFetchResponse(payload));

    const result = await resilientFetch<{ foo: string }>('https://example.com/api');

    expect(result).toEqual({ ok: true, data: payload });
  });

  it('returns TIMEOUT error when fetch exceeds timeout', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => {
      return new Promise((_resolve, reject) => {
        // Simulate AbortController behavior
        if (init?.signal) {
          init.signal.addEventListener('abort', () => {
            const err = new DOMException('The operation was aborted.', 'AbortError');
            reject(err);
          });
        }
      });
    });

    const promise = resilientFetch('https://example.com/slow', {}, { timeout: 1000, retries: 0 });
    await vi.advanceTimersByTimeAsync(1100);
    const result = await promise;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ServiceError);
      expect(result.error.code).toBe('TIMEOUT');
      expect(result.error.retryable).toBe(true);
    }
  });

  it('returns NETWORK error on fetch failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await resilientFetch('https://example.com/down', {}, { retries: 0 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ServiceError);
      expect(result.error.code).toBe('NETWORK');
      expect(result.error.retryable).toBe(true);
    }
  });

  it('returns HTTP error with status 404', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchResponse({ message: 'Not found' }, false, 404)
    );

    const result = await resilientFetch('https://example.com/missing', {}, { retries: 0 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ServiceError);
      expect(result.error.code).toBe('HTTP');
      expect(result.error.statusCode).toBe(404);
      expect(result.error.retryable).toBe(false);
    }
  });

  it('returns HTTP error with status 500', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchResponse({ message: 'Server error' }, false, 500)
    );

    const result = await resilientFetch('https://example.com/error', {}, { retries: 0 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ServiceError);
      expect(result.error.code).toBe('HTTP');
      expect(result.error.statusCode).toBe(500);
    }
  });

  it('returns PARSE error on malformed JSON', async () => {
    const badResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () => Promise.reject(new SyntaxError('Unexpected token')),
      text: () => Promise.resolve('not json'),
      headers: new Headers(),
      redirected: false,
      type: 'basic' as ResponseType,
      url: '',
      clone: () => badResponse,
      body: null,
      bodyUsed: false,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      blob: () => Promise.resolve(new Blob()),
      formData: () => Promise.resolve(new FormData()),
      bytes: () => Promise.resolve(new Uint8Array()),
    } as Response;

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(badResponse);

    const result = await resilientFetch('https://example.com/bad-json', {}, { retries: 0 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ServiceError);
      expect(result.error.code).toBe('PARSE');
    }
  });

  it('retries on network error up to configured retry count', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(mockFetchResponse({ success: true }));

    const promise = resilientFetch('https://example.com/flaky', {}, {
      retries: 2,
      retryDelay: 100,
      retryFactor: 2,
    });

    // First retry delay: 100ms
    await vi.advanceTimersByTimeAsync(150);
    // Second retry delay: 200ms
    await vi.advanceTimersByTimeAsync(250);

    const result = await promise;

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ ok: true, data: { success: true } });
  });

  it('retries on HTTP 429', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(mockFetchResponse({ error: 'rate limited' }, false, 429))
      .mockResolvedValueOnce(mockFetchResponse({ data: 'ok' }));

    const promise = resilientFetch('https://example.com/rate-limited', {}, {
      retries: 1,
      retryDelay: 100,
    });

    await vi.advanceTimersByTimeAsync(150);

    const result = await promise;

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ ok: true, data: { data: 'ok' } });
  });

  it('retries on HTTP 503', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(mockFetchResponse({ error: 'unavailable' }, false, 503))
      .mockResolvedValueOnce(mockFetchResponse({ ok: true }));

    const promise = resilientFetch('https://example.com/unavailable', {}, {
      retries: 1,
      retryDelay: 100,
    });

    await vi.advanceTimersByTimeAsync(150);

    const result = await promise;

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ ok: true, data: { ok: true } });
  });

  it('does not retry on non-retryable HTTP errors (e.g., 404)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValue(mockFetchResponse({ error: 'not found' }, false, 404));

    const result = await resilientFetch('https://example.com/missing', {}, {
      retries: 2,
      retryDelay: 100,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
  });

  it('respects external AbortSignal cancellation', async () => {
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

    const promise = resilientFetch('https://example.com/cancelable', {}, {
      signal: controller.signal,
      timeout: 30000,
      retries: 0,
    });

    controller.abort();

    const result = await promise;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ServiceError);
      // External abort is treated as NETWORK since it's user-initiated
      expect(result.error.code).toBe('NETWORK');
    }
  });

  it('returns error after exhausting all retries', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockRejectedValue(new TypeError('Failed to fetch'));

    const promise = resilientFetch('https://example.com/down', {}, {
      retries: 2,
      retryDelay: 100,
      retryFactor: 2,
    });

    // Advance through all retry delays
    await vi.advanceTimersByTimeAsync(100); // first retry
    await vi.advanceTimersByTimeAsync(200); // second retry
    await vi.advanceTimersByTimeAsync(100); // settle

    const result = await promise;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NETWORK');
    }
  });

  it('passes RequestInit options through to fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchResponse({ ok: true })
    );

    await resilientFetch('https://example.com/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'value' }),
    });

    const callInit = fetchSpy.mock.calls[0][1];
    expect(callInit?.method).toBe('POST');
    expect((callInit?.headers as Record<string, string>)?.['Content-Type']).toBe('application/json');
  });
});

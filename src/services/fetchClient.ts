import { ServiceError, type ServiceResult } from './serviceResult';

export interface ResilientFetchConfig {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  retryFactor?: number;
  signal?: AbortSignal;
}

const RETRYABLE_STATUS_CODES = new Set([429, 503]);

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function resilientFetch<T>(
  url: string,
  options: RequestInit = {},
  config: ResilientFetchConfig = {}
): Promise<ServiceResult<T>> {
  const {
    timeout = 10000,
    retries = 0,
    retryDelay = 1000,
    retryFactor = 2,
    signal: externalSignal,
  } = config;

  let lastError: ServiceError | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    // Wait before retry (not on first attempt)
    if (attempt > 0) {
      const delay = retryDelay * Math.pow(retryFactor, attempt - 1);
      await sleep(delay);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // If external signal is already aborted, abort immediately
    if (externalSignal?.aborted) {
      clearTimeout(timeoutId);
      return {
        ok: false,
        error: new ServiceError('NETWORK', 'Request was aborted', undefined, false, externalSignal.reason),
      };
    }

    // Link external signal to our controller
    const onExternalAbort = () => controller.abort();
    externalSignal?.addEventListener('abort', onExternalAbort);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      externalSignal?.removeEventListener('abort', onExternalAbort);

      if (!response.ok) {
        const isRetryable = RETRYABLE_STATUS_CODES.has(response.status);

        // Try to extract error message from response body
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorBody = await response.clone().json();
          const bodyMessage =
            (typeof errorBody?.error === 'string' ? errorBody.error : undefined)
            ?? errorBody?.error?.message
            ?? errorBody?.message;
          if (typeof bodyMessage === 'string') {
            errorMessage = bodyMessage;
          }
        } catch {
          // Ignore parse errors for error body
        }

        lastError = new ServiceError(
          'HTTP',
          errorMessage,
          response.status,
          isRetryable
        );

        // Only retry on retryable status codes
        if (isRetryable && attempt < retries) {
          continue;
        }

        return { ok: false, error: lastError };
      }

      // Parse JSON
      try {
        const data = (await response.json()) as T;
        return { ok: true, data };
      } catch (parseErr) {
        return {
          ok: false,
          error: new ServiceError('PARSE', 'Failed to parse response JSON', undefined, false, parseErr),
        };
      }
    } catch (err) {
      clearTimeout(timeoutId);
      externalSignal?.removeEventListener('abort', onExternalAbort);

      if (isAbortError(err)) {
        // Distinguish timeout from external abort
        if (externalSignal?.aborted) {
          return {
            ok: false,
            error: new ServiceError('NETWORK', 'Request was aborted', undefined, false, err),
          };
        }
        // Internal timeout
        lastError = new ServiceError('TIMEOUT', `Request timed out after ${timeout}ms`, undefined, true, err);
        if (attempt < retries) {
          continue;
        }
        return { ok: false, error: lastError };
      }

      // Network error
      lastError = new ServiceError('NETWORK', 'Network request failed', undefined, true, err);
      if (attempt < retries) {
        continue;
      }
      return { ok: false, error: lastError };
    }
  }

  // Should not reach here, but just in case
  return {
    ok: false,
    error: lastError ?? new ServiceError('UNKNOWN', 'Unknown error occurred'),
  };
}

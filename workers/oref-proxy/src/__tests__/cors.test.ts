// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { getCorsHeaders, parseAllowedOrigins, type Env } from '../index';
import worker from '../index';

// --- parseAllowedOrigins ---

describe('parseAllowedOrigins', () => {
  it('parses comma-separated ALLOWED_ORIGINS', () => {
    const env: Env = { ALLOWED_ORIGINS: 'https://a.com,https://b.com' };
    expect(parseAllowedOrigins(env)).toEqual(['https://a.com', 'https://b.com']);
  });

  it('trims whitespace from origins', () => {
    const env: Env = { ALLOWED_ORIGINS: ' https://a.com , https://b.com ' };
    expect(parseAllowedOrigins(env)).toEqual(['https://a.com', 'https://b.com']);
  });

  it('falls back to ALLOWED_ORIGIN (singular) if ALLOWED_ORIGINS is not set', () => {
    const env: Env = { ALLOWED_ORIGIN: 'https://legacy.com' };
    expect(parseAllowedOrigins(env)).toEqual(['https://legacy.com']);
  });

  it('prefers ALLOWED_ORIGINS over ALLOWED_ORIGIN', () => {
    const env: Env = {
      ALLOWED_ORIGINS: 'https://new.com',
      ALLOWED_ORIGIN: 'https://old.com',
    };
    expect(parseAllowedOrigins(env)).toEqual(['https://new.com']);
  });

  it('returns empty array when neither is set', () => {
    const env: Env = {};
    expect(parseAllowedOrigins(env)).toEqual([]);
  });
});

// --- getCorsHeaders ---

describe('getCorsHeaders', () => {
  const env: Env = {
    ALLOWED_ORIGINS: 'https://shelter-route.pages.dev,http://localhost:5173',
  };

  it('returns CORS headers for a known origin', () => {
    const headers = getCorsHeaders('https://shelter-route.pages.dev', env);
    expect(headers['Access-Control-Allow-Origin']).toBe('https://shelter-route.pages.dev');
    expect(headers['Access-Control-Allow-Methods']).toBe('GET, OPTIONS');
  });

  it('returns CORS headers for a second known origin', () => {
    const headers = getCorsHeaders('http://localhost:5173', env);
    expect(headers['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
  });

  it('returns empty headers for an unknown origin', () => {
    const headers = getCorsHeaders('https://evil.com', env);
    expect(headers).toEqual({});
    expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
  });

  it('returns empty headers for empty origin', () => {
    const headers = getCorsHeaders('', env);
    expect(headers).toEqual({});
  });
});

// --- Worker fetch handler ---

describe('worker fetch handler', () => {
  const env: Env = {
    ALLOWED_ORIGINS: 'https://shelter-route.pages.dev,http://localhost:5173',
  };

  function makeRequest(method: string, origin: string, path = '/'): Request {
    return new Request(`https://proxy.example.com${path}`, {
      method,
      headers: origin ? { Origin: origin } : {},
    });
  }

  describe('OPTIONS preflight', () => {
    it('returns 204 with CORS headers for a known origin', async () => {
      const req = makeRequest('OPTIONS', 'https://shelter-route.pages.dev');
      const res = await worker.fetch(req, env);

      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
        'https://shelter-route.pages.dev'
      );
      expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS');
    });

    it('returns 403 for an unknown origin', async () => {
      const req = makeRequest('OPTIONS', 'https://evil.com');
      const res = await worker.fetch(req, env);

      expect(res.status).toBe(403);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });

    it('returns 403 when no Origin header is sent', async () => {
      const req = makeRequest('OPTIONS', '');
      const res = await worker.fetch(req, env);

      expect(res.status).toBe(403);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });
  });

  describe('GET requests', () => {
    it('does NOT include Access-Control-Allow-Origin for unknown origin', async () => {
      const req = makeRequest('GET', 'https://evil.com');
      const res = await worker.fetch(req, env);

      // The response should still be 200 (it's the browser that blocks),
      // but the CORS header should be absent
      expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });

    it('includes Access-Control-Allow-Origin for known origin on GET /', async () => {
      const req = makeRequest('GET', 'https://shelter-route.pages.dev');
      const res = await worker.fetch(req, env);

      expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
        'https://shelter-route.pages.dev'
      );
      expect(res.headers.get('Content-Type')).toContain('application/json');
    });

    it('includes Access-Control-Allow-Origin for known origin on GET /history', async () => {
      const req = makeRequest('GET', 'http://localhost:5173', '/history');
      const res = await worker.fetch(req, env);

      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    });
  });

  describe('backward compatibility', () => {
    it('works with ALLOWED_ORIGIN (singular) only', async () => {
      const legacyEnv: Env = { ALLOWED_ORIGIN: 'https://legacy.example.com' };
      const req = makeRequest('OPTIONS', 'https://legacy.example.com');
      const res = await worker.fetch(req, legacyEnv);

      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
        'https://legacy.example.com'
      );
    });
  });

  describe('method restrictions', () => {
    it('returns 405 for POST requests', async () => {
      const req = makeRequest('POST', 'https://shelter-route.pages.dev');
      const res = await worker.fetch(req, env);

      expect(res.status).toBe(405);
    });
  });
});

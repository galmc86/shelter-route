import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeRoutes } from '../routeService';

// Mock import.meta.env
vi.stubEnv('VITE_ORS_API_KEY', 'test-api-key');

// Helper to create a mock response
function mockResponse(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(data),
    headers: new Headers(),
    redirected: false,
    statusText: ok ? 'OK' : 'Error',
    type: 'basic' as ResponseType,
    url: '',
    clone: () => mockResponse(data, ok, status),
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve(''),
    bytes: () => Promise.resolve(new Uint8Array()),
  } as Response;
}

// Minimal encoded polyline for a short path
// This encodes a simple 2-point polyline
const SIMPLE_POLYLINE = '_p~iF~ps|U_ulLnnqC';

const SINGLE_ROUTE_RESPONSE = {
  routes: [
    {
      geometry: SIMPLE_POLYLINE,
      summary: { duration: 600, distance: 1000 },
    },
  ],
};

const ALT_ROUTES_RESPONSE = {
  routes: [
    {
      geometry: SIMPLE_POLYLINE,
      summary: { duration: 700, distance: 1100 },
    },
    {
      geometry: SIMPLE_POLYLINE,
      summary: { duration: 800, distance: 1200 },
    },
  ],
};

describe('computeRoutes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls ORS API with correct parameters for WALKING mode', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockResponse(SINGLE_ROUTE_RESPONSE)
    );

    const origin = { lat: 32.0853, lng: 34.7818 };
    const destination = { lat: 32.09, lng: 34.79 };

    await computeRoutes(origin, destination, 'WALKING');

    // Two parallel calls: direct (no alternatives) + alternatives
    expect(fetchSpy.mock.calls.length).toBeGreaterThanOrEqual(2);

    // Find the direct call (without alternative_routes in body)
    const directCall = fetchSpy.mock.calls.find((call) => {
      const body = JSON.parse(call[1]?.body as string);
      return !body.alternative_routes;
    });
    expect(directCall).toBeDefined();
    expect(directCall![0]).toContain('foot-walking');
    expect(directCall![1]?.method).toBe('POST');
    expect(directCall![1]?.headers).toEqual(
      expect.objectContaining({
        'Content-Type': 'application/json',
        Authorization: 'test-api-key',
      })
    );

    const body = JSON.parse(directCall![1]?.body as string);
    expect(body.coordinates).toEqual([
      [origin.lng, origin.lat],
      [destination.lng, destination.lat],
    ]);

    // Find the alternatives call
    const altCall = fetchSpy.mock.calls.find((call) => {
      const b = JSON.parse(call[1]?.body as string);
      return !!b.alternative_routes;
    });
    expect(altCall).toBeDefined();
  });

  it('uses correct ORS profile for each travel mode', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockResponse(SINGLE_ROUTE_RESPONSE)
    );

    const origin = { lat: 32.0, lng: 34.0 };
    const dest = { lat: 32.1, lng: 34.1 };

    await computeRoutes(origin, dest, 'BICYCLING');
    expect(fetchSpy.mock.calls[0][0]).toContain('cycling-regular');

    fetchSpy.mockClear();
    await computeRoutes(origin, dest, 'DRIVING');
    expect(fetchSpy.mock.calls[0][0]).toContain('driving-car');
  });

  it('returns parsed route data with path, bounds, duration, and distance', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockResponse(SINGLE_ROUTE_RESPONSE)
    );

    const result = await computeRoutes(
      { lat: 32.0, lng: 34.0 },
      { lat: 32.1, lng: 34.1 },
      'WALKING'
    );

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]).toHaveProperty('path');
    expect(result[0]).toHaveProperty('bounds');
    expect(result[0]).toHaveProperty('duration');
    expect(result[0]).toHaveProperty('distance');
    expect(result[0]).toHaveProperty('durationSeconds');
    expect(result[0]).toHaveProperty('distanceMeters');
    expect(result[0].path.length).toBeGreaterThan(0);
    expect(result[0].bounds).toHaveProperty('southWest');
    expect(result[0].bounds).toHaveProperty('northEast');
  });

  it('marks the first route as fastest', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockResponse(SINGLE_ROUTE_RESPONSE)
    );

    const result = await computeRoutes(
      { lat: 32.0, lng: 34.0 },
      { lat: 32.1, lng: 34.1 },
      'WALKING'
    );

    expect(result[0].isFastest).toBe(true);
  });

  it('combines direct route with alternatives, deduplicating similar routes', async () => {
    // Use durations that pass the sanitize check (walking ≤ 1.39 m/s)
    // 500m / 1.39 = 360s min, so 400s is fine
    const directResponse = mockResponse({
      routes: [
        { geometry: SIMPLE_POLYLINE, summary: { duration: 400, distance: 500 } },
      ],
    });
    const altResponse = mockResponse({
      routes: [
        // This one is ~same as direct (within 5%) — should be deduped
        { geometry: SIMPLE_POLYLINE, summary: { duration: 410, distance: 510 } },
        // This one is different — should be kept
        { geometry: SIMPLE_POLYLINE, summary: { duration: 600, distance: 800 } },
      ],
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation((_url, options) => {
      const body = JSON.parse(options?.body as string);
      if (body.alternative_routes) return Promise.resolve(altResponse);
      return Promise.resolve(directResponse);
    });

    const result = await computeRoutes(
      { lat: 32.0, lng: 34.0 },
      { lat: 32.1, lng: 34.1 },
      'WALKING'
    );

    // Direct + 1 unique alt (the similar one deduped)
    expect(result).toHaveLength(2);
    expect(result[0].isFastest).toBe(true);
    expect(result[0].durationSeconds).toBe(400);
    expect(result[1].durationSeconds).toBe(600);
  });

  it('falls back to alternatives only when direct route fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((_url, options) => {
      const body = JSON.parse(options?.body as string);
      if (body.alternative_routes) {
        return Promise.resolve(mockResponse(ALT_ROUTES_RESPONSE));
      }
      // Direct route fails
      return Promise.resolve(mockResponse({}, false, 500));
    });

    const result = await computeRoutes(
      { lat: 32.0, lng: 34.0 },
      { lat: 32.1, lng: 34.1 },
      'WALKING'
    );

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].isFastest).toBe(true);
  });

  it('falls back to a final single-route request when both parallel calls fail', async () => {
    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      callCount++;
      // First two calls (parallel) fail, subsequent calls succeed
      if (callCount <= 4) {
        return Promise.reject(new Error('Network error'));
      }
      return Promise.resolve(mockResponse(SINGLE_ROUTE_RESPONSE));
    });

    const result = await computeRoutes(
      { lat: 32.0, lng: 34.0 },
      { lat: 32.1, lng: 34.1 },
      'WALKING'
    );

    expect(result).toHaveLength(1);
  });

  it('throws error when all requests fail', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    await expect(
      computeRoutes(
        { lat: 32.0, lng: 34.0 },
        { lat: 32.1, lng: 34.1 },
        'WALKING'
      )
    ).rejects.toThrow();
  });

  it('throws error when response has no routes', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockResponse({ routes: [] })
    );

    await expect(
      computeRoutes(
        { lat: 32.0, lng: 34.0 },
        { lat: 32.1, lng: 34.1 },
        'WALKING'
      )
    ).rejects.toThrow('לא נמצא מסלול');
  });

  it('throws API error message when final response is not ok', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockResponse(
        { error: { message: 'Rate limit exceeded' } },
        false,
        429
      )
    );

    await expect(
      computeRoutes(
        { lat: 32.0, lng: 34.0 },
        { lat: 32.1, lng: 34.1 },
        'WALKING'
      )
    ).rejects.toThrow('Rate limit exceeded');
  });
});

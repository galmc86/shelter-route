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

describe('computeRoutes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls ORS API with correct parameters for WALKING mode', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockResponse({
        routes: [
          {
            geometry: SIMPLE_POLYLINE,
            summary: { duration: 600, distance: 1000 },
          },
        ],
      })
    );

    const origin = { lat: 32.0853, lng: 34.7818 };
    const destination = { lat: 32.09, lng: 34.79 };

    await computeRoutes(origin, destination, 'WALKING');

    // First call should be with alternatives
    const firstCall = fetchSpy.mock.calls[0];
    expect(firstCall[0]).toContain('foot-walking');
    expect(firstCall[1]?.method).toBe('POST');
    expect(firstCall[1]?.headers).toEqual(
      expect.objectContaining({
        'Content-Type': 'application/json',
        Authorization: 'test-api-key',
      })
    );

    const body = JSON.parse(firstCall[1]?.body as string);
    expect(body.coordinates).toEqual([
      [origin.lng, origin.lat],
      [destination.lng, destination.lat],
    ]);
    expect(body.alternative_routes).toBeDefined();
  });

  it('uses correct ORS profile for each travel mode', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockResponse({
        routes: [
          {
            geometry: SIMPLE_POLYLINE,
            summary: { duration: 300, distance: 500 },
          },
        ],
      })
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
      mockResponse({
        routes: [
          {
            geometry: SIMPLE_POLYLINE,
            summary: { duration: 600, distance: 1500 },
          },
        ],
      })
    );

    const result = await computeRoutes(
      { lat: 32.0, lng: 34.0 },
      { lat: 32.1, lng: 34.1 },
      'WALKING'
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty('path');
    expect(result[0]).toHaveProperty('bounds');
    expect(result[0]).toHaveProperty('duration');
    expect(result[0]).toHaveProperty('distance');
    expect(result[0]).toHaveProperty('durationSeconds', 600);
    expect(result[0]).toHaveProperty('distanceMeters', 1500);
    expect(result[0].path.length).toBeGreaterThan(0);
    expect(result[0].bounds).toHaveProperty('southWest');
    expect(result[0].bounds).toHaveProperty('northEast');
  });

  it('falls back to single route when alternatives request fails with HTTP error', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(mockResponse({}, false, 400)) // alternatives fail
      .mockResolvedValueOnce(
        mockResponse({
          routes: [
            {
              geometry: SIMPLE_POLYLINE,
              summary: { duration: 300, distance: 500 },
            },
          ],
        })
      );

    const result = await computeRoutes(
      { lat: 32.0, lng: 34.0 },
      { lat: 32.1, lng: 34.1 },
      'WALKING'
    );

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(1);
  });

  it('falls back to single route when alternatives request throws network error', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('Network error')) // first attempt (with retry inside)
      .mockRejectedValueOnce(new Error('Network error')) // retry inside fetchRoutes
      .mockResolvedValueOnce(
        mockResponse({
          routes: [
            {
              geometry: SIMPLE_POLYLINE,
              summary: { duration: 300, distance: 500 },
            },
          ],
        })
      );

    const result = await computeRoutes(
      { lat: 32.0, lng: 34.0 },
      { lat: 32.1, lng: 34.1 },
      'WALKING'
    );

    expect(result).toHaveLength(1);
  });

  it('throws network error when all requests fail', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    await expect(
      computeRoutes(
        { lat: 32.0, lng: 34.0 },
        { lat: 32.1, lng: 34.1 },
        'WALKING'
      )
    ).rejects.toThrow('שגיאת רשת');
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

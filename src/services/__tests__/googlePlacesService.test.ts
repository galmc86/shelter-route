import { beforeEach, describe, expect, it, vi } from 'vitest';

interface GoogleMockOptions {
  predictions?: Array<{ description: string; place_id: string }>;
  status?: string;
  fetchFieldsError?: Error;
  location?: { lat: number; lng: number } | null;
}

function installGoogleMock(options: GoogleMockOptions = {}) {
  const {
    predictions = [
      { description: 'תל אביב, ישראל', place_id: 'place-1' },
      { description: 'תל אביב יפו, ישראל', place_id: 'place-2' },
    ],
    status = 'OK',
    fetchFieldsError,
    location = { lat: 32.0853, lng: 34.7818 },
  } = options;

  const getPlacePredictions = vi.fn(
    (_request: unknown, callback: (results: typeof predictions | null, status: string) => void) => {
      callback(predictions, status);
    }
  );
  const fetchFields = fetchFieldsError
    ? vi.fn().mockRejectedValue(fetchFieldsError)
    : vi.fn().mockResolvedValue(undefined);
  const Place = vi.fn(function Place() {
    return {
      fetchFields,
      location: location
        ? {
            lat: () => location.lat,
            lng: () => location.lng,
          }
        : null,
    };
  });
  const AutocompleteSessionToken = vi.fn(function AutocompleteSessionToken() {
    return { token: Symbol('session-token') };
  });
  const AutocompleteService = vi.fn(function AutocompleteService() {
    return {
      getPlacePredictions,
    };
  });

  vi.stubGlobal('google', {
    maps: {
      places: {
        AutocompleteService,
        AutocompleteSessionToken,
        Place,
        PlacesServiceStatus: {
          OK: 'OK',
          ZERO_RESULTS: 'ZERO_RESULTS',
        },
      },
    },
  });

  return {
    getPlacePredictions,
    fetchFields,
    Place,
    AutocompleteService,
    AutocompleteSessionToken,
  };
}

describe('googlePlacesService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
    vi.resetModules();
  });

  it('returns empty results when Google Places is unavailable', async () => {
    const { searchPlaces, isAvailable } = await import('../googlePlacesService');

    expect(isAvailable()).toBe(false);
    await expect(searchPlaces('תל אביב')).resolves.toEqual([]);
  });

  it('maps Google autocomplete predictions into place results', async () => {
    const googleMock = installGoogleMock();
    const { searchPlaces, isAvailable } = await import('../googlePlacesService');

    expect(isAvailable()).toBe(true);
    await expect(searchPlaces('תל אביב')).resolves.toEqual([
      {
        lat: 0,
        lng: 0,
        displayName: 'תל אביב, ישראל',
        placeId: 'place-1',
      },
      {
        lat: 0,
        lng: 0,
        displayName: 'תל אביב יפו, ישראל',
        placeId: 'place-2',
      },
    ]);
    expect(googleMock.AutocompleteService).toHaveBeenCalledTimes(1);
    expect(googleMock.getPlacePredictions).toHaveBeenCalledTimes(1);
  });

  it('falls back to empty results when the daily local rate limit is exhausted', async () => {
    installGoogleMock();
    localStorage.setItem(
      'shelter-route:places-usage',
      JSON.stringify({ date: '2026-03-23', count: 500 })
    );
    const { searchPlaces } = await import('../googlePlacesService');

    await expect(searchPlaces('תל אביב')).resolves.toEqual([]);
  });

  it('returns place coordinates from Place.fetchFields()', async () => {
    const googleMock = installGoogleMock({
      location: { lat: 31.7683, lng: 35.2137 },
    });
    const { getPlaceDetails } = await import('../googlePlacesService');

    await expect(getPlaceDetails('place-123')).resolves.toEqual({
      lat: 31.7683,
      lng: 35.2137,
    });
    expect(googleMock.Place).toHaveBeenCalledWith({ id: 'place-123' });
    expect(googleMock.fetchFields).toHaveBeenCalledWith({ fields: ['location'] });
  });

  it('returns null and logs when place details fetch fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    installGoogleMock({
      fetchFieldsError: new Error('places failed'),
    });
    const { getPlaceDetails } = await import('../googlePlacesService');

    await expect(getPlaceDetails('bad-place')).resolves.toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      '[GooglePlaces] Failed to get place details:',
      'Place details fetch failed'
    );
  });
});

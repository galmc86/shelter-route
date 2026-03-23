import { describe, it, expect, vi, beforeEach } from 'vitest';
// fetchAllShelters is imported dynamically in each test via import('../shelterApi')

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn(() => null),
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Helper to create a properly mocked Response for progressive loading
function mockFetchResponse(data: unknown, ok = true, status = 200): Response {
  const jsonStr = JSON.stringify(data);
  return {
    ok,
    status,
    headers: new Headers({ 'content-length': String(jsonStr.length) }),
    body: null, // null body forces fallback to response.json()
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(jsonStr),
    clone: () => mockFetchResponse(data, ok, status),
  } as unknown as Response;
}

describe('fetchAllShelters', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorageMock.clear();

    // Reset cached shelters by re-importing - we need to clear module cache
    vi.resetModules();
  });

  it('fetches and parses shelters from API', async () => {
    const { fetchAllShelters } = await import('../shelterApi');

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockFetchResponse({
      shelters: [
        { id: 1, name: 'Shelter A', lat: 32.0, lng: 34.8, description: 'Desc A' },
        { id: 2, name: 'Shelter B', lat: 31.5, lng: 35.0, description: 'Desc B' },
      ],
    }));

    const shelters = await fetchAllShelters();
    expect(shelters).toHaveLength(2);
    expect(shelters[0]).toMatchObject({
      id: '1',
      name: 'Shelter A',
      lat: 32.0,
      lon: 34.8,
    });
  });

  it('filters out shelters outside Israel bounds (lat 29-34, lng 34-36)', async () => {
    const { fetchAllShelters } = await import('../shelterApi');

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockFetchResponse({
      shelters: [
        { id: 1, name: 'In Israel', lat: 32.0, lng: 34.8 },
        { id: 2, name: 'Too North', lat: 35.0, lng: 34.8 },
        { id: 3, name: 'Too South', lat: 28.0, lng: 34.8 },
        { id: 4, name: 'Too East', lat: 32.0, lng: 37.0 },
        { id: 5, name: 'Too West', lat: 32.0, lng: 33.0 },
        { id: 6, name: 'NaN lat', lat: NaN, lng: 34.8 },
      ],
    }));

    const shelters = await fetchAllShelters();
    expect(shelters).toHaveLength(1);
    expect(shelters[0].id).toBe('1');
  });

  it('enriches generic shelter names with description hints', async () => {
    const { fetchAllShelters } = await import('../shelterApi');

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockFetchResponse({
      shelters: [
        { id: 1, name: 'Shelter 42', lat: 32.0, lng: 34.8, description: 'פסטלוצי 34' },
        { id: 2, name: 'מקלט', lat: 31.5, lng: 35.0, description: 'רחוב הרצל 10' },
        { id: 3, name: 'Specific Name', lat: 32.5, lng: 35.0, description: 'Some address' },
      ],
    }));

    const shelters = await fetchAllShelters();
    // Generic names should be enriched
    expect(shelters[0].name).toContain('מקלט —');
    expect(shelters[0].name).toContain('פסטלוצי 34');
    // "מקלט" matches GENERIC_NAME_RE
    expect(shelters[1].name).toContain('מקלט —');
    // Non-generic name should be preserved
    expect(shelters[2].name).toBe('Specific Name');
  });

  it('saves to localStorage after successful fetch', async () => {
    const { fetchAllShelters } = await import('../shelterApi');

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockFetchResponse({
      shelters: [
        { id: 1, name: 'Test', lat: 32.0, lng: 34.8 },
      ],
    }));

    await fetchAllShelters();
    expect(localStorageMock.setItem).toHaveBeenCalled();
  });

  it('falls back to localStorage cache when fetch fails', async () => {
    const { fetchAllShelters } = await import('../shelterApi');

    // Pre-populate localStorage cache
    const cachedData = {
      version: 2,
      data: [
        { id: '1', name: 'Cached Shelter', lat: 32.0, lon: 34.8, city: '' },
      ],
    };
    localStorageMock.setItem(
      'shelter-route:shelters',
      JSON.stringify(cachedData)
    );

    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
      new Error('Network error')
    );

    const shelters = await fetchAllShelters();
    expect(shelters).toHaveLength(1);
    expect(shelters[0].name).toBe('Cached Shelter');
  });

  it('throws error when fetch fails and no cache exists', async () => {
    const { fetchAllShelters } = await import('../shelterApi');

    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
      new Error('Network error')
    );

    await expect(fetchAllShelters()).rejects.toThrow(
      'שגיאה בטעינת מקלטים'
    );
  });

  it('throws error when shelter payload is malformed and no cache exists', async () => {
    const { fetchAllShelters } = await import('../shelterApi');

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      mockFetchResponse({ shelters: null })
    );

    await expect(fetchAllShelters()).rejects.toThrow(
      'שגיאה בטעינת מקלטים'
    );
  });

  it('maps lng to lon in parsed shelters', async () => {
    const { fetchAllShelters } = await import('../shelterApi');

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockFetchResponse({
      shelters: [
        { id: 1, name: 'Test', lat: 32.0, lng: 34.8 },
      ],
    }));

    const shelters = await fetchAllShelters();
    expect(shelters[0].lat).toBe(32.0);
    expect(shelters[0].lon).toBe(34.8);
  });

  it('preserves explicit shelter kind from the dataset', async () => {
    const { fetchAllShelters } = await import('../shelterApi');

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockFetchResponse({
      shelters: [
        { id: 1, name: 'מיגונית פיקוד העורף', lat: 32.0, lng: 34.8, kind: 'migunit' },
      ],
    }));

    const shelters = await fetchAllShelters();
    expect(shelters[0].kind).toBe('migunit');
  });

  it('infers migunit kind from name when raw kind is missing', async () => {
    const { fetchAllShelters } = await import('../shelterApi');

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockFetchResponse({
      shelters: [
        { id: 1, name: 'מיגונית פיקוד העורף', lat: 32.0, lng: 34.8, description: 'חב"ד 26' },
      ],
    }));

    const shelters = await fetchAllShelters();
    expect(shelters[0].kind).toBe('migunit');
  });

  it('returns cached shelters even when the background refresh payload is malformed', async () => {
    const { fetchAllShelters } = await import('../shelterApi');

    localStorageMock.setItem(
      'shelter-route:shelters',
      JSON.stringify({
        version: 2,
        data: [
          { id: '1', name: 'Cached Shelter', lat: 32.0, lon: 34.8, city: '' },
        ],
      })
    );

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      mockFetchResponse({ shelters: null })
    );

    const shelters = await fetchAllShelters();

    expect(shelters).toHaveLength(1);
    expect(shelters[0].name).toBe('Cached Shelter');
  });
});

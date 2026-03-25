import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getSavedLocations,
  MAX_SAVED_LOCATIONS,
  removeLocation,
  saveRoutePreset,
  saveLocation,
  touchLocation,
  updateLocation,
} from '../savedLocationsService';

describe('savedLocationsService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('saves, updates, and removes a location', () => {
    const [saved] = saveLocation({
      name: 'Home',
      label: 'home',
      lat: 32.1,
      lng: 34.8,
    });

    expect(saved.name).toBe('Home');
    expect(getSavedLocations()).toHaveLength(1);

    const [updated] = updateLocation(saved.id, { name: 'Updated Home' });
    expect(updated.name).toBe('Updated Home');

    expect(removeLocation(saved.id)).toEqual([]);
    expect(getSavedLocations()).toEqual([]);
  });

  it('enforces the max saved locations limit', () => {
    for (let index = 0; index < MAX_SAVED_LOCATIONS + 2; index += 1) {
      saveLocation({
        name: `Place ${index}`,
        label: 'other',
        lat: 32 + index * 0.001,
        lng: 34.8 + index * 0.001,
      });
    }

    expect(getSavedLocations()).toHaveLength(MAX_SAVED_LOCATIONS);
  });

  it('replaces singleton profiles instead of consuming another slot', () => {
    const [home] = saveLocation({
      name: 'Home',
      label: 'home',
      lat: 32.1,
      lng: 34.8,
    });

    const updated = saveLocation({
      name: 'Apartment',
      label: 'home',
      lat: 32.11,
      lng: 34.81,
    });

    expect(updated).toHaveLength(1);
    expect(updated[0]).toEqual({
      ...home,
      name: 'Apartment',
      lat: 32.11,
      lng: 34.81,
    });
  });

  it('allows replacing a singleton profile even when the list is full', () => {
    saveLocation({ name: 'Home', label: 'home', lat: 32.1, lng: 34.8 });
    saveLocation({ name: 'Work', label: 'work', lat: 32.11, lng: 34.81 });
    saveLocation({ name: 'School', label: 'school', lat: 32.12, lng: 34.82 });
    saveLocation({ name: 'Gym', label: 'other', lat: 32.13, lng: 34.83 });
    saveLocation({ name: 'Parents', label: 'other', lat: 32.14, lng: 34.84 });

    const updated = saveLocation({
      name: 'HQ',
      label: 'work',
      lat: 32.15,
      lng: 34.85,
    });

    expect(updated).toHaveLength(MAX_SAVED_LOCATIONS);
    expect(updated.find((location) => location.label === 'work')).toEqual(
      expect.objectContaining({
        name: 'HQ',
        lat: 32.15,
        lng: 34.85,
      })
    );
  });

  it('reads persisted locations after a reload', () => {
    saveLocation({
      name: 'Work',
      label: 'work',
      lat: 32.09,
      lng: 34.77,
    });

    expect(getSavedLocations()).toEqual([
      expect.objectContaining({
        name: 'Work',
        label: 'work',
        lat: 32.09,
        lng: 34.77,
      }),
    ]);
  });

  it('tracks last used time when a location is touched', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_710_000_000_000);

    const [saved] = saveLocation({
      name: 'Work',
      label: 'work',
      lat: 32.09,
      lng: 34.77,
    });

    const [touched] = touchLocation(saved.id);

    expect(touched.lastUsedAt).toBe(1_710_000_000_000);
    expect(getSavedLocations()[0].lastUsedAt).toBe(1_710_000_000_000);
  });

  it('persists route presets for saved profiles', () => {
    const [saved] = saveLocation({
      name: 'Home',
      label: 'home',
      lat: 32.1,
      lng: 34.8,
    });

    const [updated] = saveRoutePreset(saved.id, {
      destination: { lat: 32.07, lng: 34.79 },
      destinationName: 'Shelter Hub',
      travelMode: 'WALKING',
      savedAt: 1_710_000_000_500,
    });

    expect(updated.routePreset).toEqual({
      destination: { lat: 32.07, lng: 34.79 },
      destinationName: 'Shelter Hub',
      travelMode: 'WALKING',
      savedAt: 1_710_000_000_500,
    });
    expect(getSavedLocations()[0].routePreset?.destinationName).toBe('Shelter Hub');
  });

  it('drops legacy nearestShelters data when loading persisted entries', () => {
    localStorage.setItem(
      'shelter-route:saved-locations',
      JSON.stringify({
        version: 1,
        locations: [
          {
            id: 'legacy-home',
            name: 'Legacy Home',
            label: 'home',
            lat: 32.07,
            lng: 34.79,
            nearestShelters: [
              { id: 'shelter-1', name: 'Shelter', lat: 32.08, lon: 34.8, address: 'Test' },
            ],
          },
        ],
      })
    );

    expect(getSavedLocations()).toEqual([
      {
        id: 'legacy-home',
        name: 'Legacy Home',
        label: 'home',
        lat: 32.07,
        lng: 34.79,
        lastUsedAt: undefined,
      },
    ]);
  });

  it('migrates legacy version 1 data and preserves last used metadata when available', () => {
    localStorage.setItem(
      'shelter-route:saved-locations',
      JSON.stringify({
        version: 1,
        locations: [
          {
            id: 'legacy-work',
            name: 'Legacy Work',
            label: 'work',
            lat: 32.08,
            lng: 34.78,
            lastUsedAt: 1234,
          },
        ],
      })
    );

    expect(getSavedLocations()).toEqual([
      {
        id: 'legacy-work',
        name: 'Legacy Work',
        label: 'work',
        lat: 32.08,
        lng: 34.78,
        lastUsedAt: 1234,
      },
    ]);

    expect(JSON.parse(localStorage.getItem('shelter-route:saved-locations') ?? '{}')).toEqual({
      version: 3,
      locations: [
        {
          id: 'legacy-work',
          name: 'Legacy Work',
          label: 'work',
          lat: 32.08,
          lng: 34.78,
          lastUsedAt: 1234,
        },
      ],
    });
  });
});

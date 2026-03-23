import { beforeEach, describe, expect, it } from 'vitest';
import {
  getSavedLocations,
  MAX_SAVED_LOCATIONS,
  removeLocation,
  saveLocation,
  updateLocation,
} from '../savedLocationsService';

describe('savedLocationsService', () => {
  beforeEach(() => {
    localStorage.clear();
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
      },
    ]);
  });
});

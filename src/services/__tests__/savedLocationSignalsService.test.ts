import { describe, expect, it } from 'vitest';
import { buildSavedLocationSignals } from '../savedLocationSignalsService';
import type { SavedLocation } from '../savedLocationsService';
import type { Shelter } from '../../types';

describe('savedLocationSignalsService', () => {
  const locations: SavedLocation[] = [
    {
      id: 'home-1',
      name: 'Home',
      label: 'home',
      lat: 32.0853,
      lng: 34.7818,
    },
  ];

  it('builds nearest-shelter and accessibility signals for a saved profile', () => {
    const shelters: Shelter[] = [
      {
        id: 'near-accessible',
        name: 'Accessible shelter',
        lat: 32.0855,
        lon: 34.7819,
        city: 'Tel Aviv',
        isAccessible: true,
      },
      {
        id: 'near-2',
        name: 'Nearby shelter',
        lat: 32.086,
        lon: 34.7822,
        city: 'Tel Aviv',
      },
      {
        id: 'far',
        name: 'Far shelter',
        lat: 32.12,
        lon: 34.82,
        city: 'Tel Aviv',
      },
    ];

    expect(buildSavedLocationSignals(locations, shelters)).toEqual({
      'home-1': {
        closestShelterMinutes: 1,
        nearbyShelterCount: 2,
        hasAccessibleNearby: true,
      },
    });
  });

  it('returns empty output when shelter data is not loaded', () => {
    expect(buildSavedLocationSignals(locations, [])).toEqual({});
  });
});

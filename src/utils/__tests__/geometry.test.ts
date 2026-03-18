import { describe, it, expect } from 'vitest';
import {
  isPointNearRoute,
  filterSheltersByProximity,
  getDistanceToRoute,
} from '../geometry';
import type { Shelter, LatLng } from '../../types';

function makeShelter(overrides: Partial<Shelter> & { lat: number; lon: number }): Shelter {
  return {
    id: '1',
    name: 'Test Shelter',
    city: '',
    ...overrides,
  };
}

describe('isPointNearRoute', () => {
  const routePath: LatLng[] = [
    { lat: 32.0853, lng: 34.7818 }, // Tel Aviv
    { lat: 32.09, lng: 34.79 },
  ];

  it('returns true for a point within buffer distance', () => {
    // A point very close to the first route point
    const point: LatLng = { lat: 32.0854, lng: 34.7819 };
    expect(isPointNearRoute(point, routePath, 200)).toBe(true);
  });

  it('returns false for a point outside buffer distance', () => {
    // A point far from the route
    const point: LatLng = { lat: 31.7683, lng: 35.2137 }; // Jerusalem
    expect(isPointNearRoute(point, routePath, 200)).toBe(false);
  });

  it('returns false for an empty route', () => {
    const point: LatLng = { lat: 32.0853, lng: 34.7818 };
    expect(isPointNearRoute(point, [], 200)).toBe(false);
  });

  it('returns true when point is exactly on a route point', () => {
    const point: LatLng = { lat: 32.0853, lng: 34.7818 };
    expect(isPointNearRoute(point, routePath, 0)).toBe(true);
  });
});

describe('filterSheltersByProximity', () => {
  const routePath: LatLng[] = [
    { lat: 32.0853, lng: 34.7818 }, // Tel Aviv
    { lat: 32.09, lng: 34.79 },
  ];

  it('returns empty array for empty route', () => {
    const shelters = [makeShelter({ lat: 32.0853, lon: 34.7818 })];
    expect(filterSheltersByProximity(shelters, [], 200)).toEqual([]);
  });

  it('filters shelters within proximity of route', () => {
    const shelters = [
      makeShelter({ id: 'near', lat: 32.0855, lon: 34.782 }), // Very close to route
      makeShelter({ id: 'far', lat: 31.0, lon: 34.0 }), // Far away
    ];
    const result = filterSheltersByProximity(shelters, routePath, 200);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('near');
  });

  it('excludes shelters outside the bounding box', () => {
    const shelters = [
      makeShelter({ id: 'outside-bounds', lat: 40.0, lon: 35.0 }), // Way outside bounds
    ];
    const result = filterSheltersByProximity(shelters, routePath, 200);
    expect(result).toHaveLength(0);
  });

  it('returns shelters that pass both bounds check and distance check', () => {
    const shelters = [
      makeShelter({ id: 'close', lat: 32.0854, lon: 34.7819 }),
      makeShelter({ id: 'in-bounds-but-far', lat: 32.087, lon: 34.785 }), // In bounds but > 200m
    ];
    const result = filterSheltersByProximity(shelters, routePath, 50);
    // Only the very close one should pass
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('close');
  });

  it('returns empty array when no shelters provided', () => {
    expect(filterSheltersByProximity([], routePath, 200)).toEqual([]);
  });
});

describe('getDistanceToRoute', () => {
  const routePath: LatLng[] = [
    { lat: 32.0853, lng: 34.7818 }, // Tel Aviv
    { lat: 31.7683, lng: 35.2137 }, // Jerusalem
  ];

  it('returns minimum distance from shelter to any route point (checks points, not segments)', () => {
    // Shelter at Tel Aviv - should be 0 distance to first point
    const shelter = makeShelter({ lat: 32.0853, lon: 34.7818 });
    expect(getDistanceToRoute(shelter, routePath)).toBe(0);
  });

  it('returns rounded distance in meters', () => {
    // Shelter slightly offset from Tel Aviv
    const shelter = makeShelter({ lat: 32.086, lon: 34.782 });
    const distance = getDistanceToRoute(shelter, routePath);
    expect(Number.isInteger(distance)).toBe(true);
    expect(distance).toBeGreaterThan(0);
    expect(distance).toBeLessThan(200); // Should be very close
  });

  it('returns distance to nearest route point, not interpolated segment', () => {
    // A point midway between Tel Aviv and Jerusalem but off the line
    // Due to the known behavior of checking only route points (not segments),
    // the distance will be to whichever route point is closer
    const midLat = (32.0853 + 31.7683) / 2;
    const midLng = (34.7818 + 35.2137) / 2;
    const shelter = makeShelter({ lat: midLat, lon: midLng });
    const distance = getDistanceToRoute(shelter, routePath);
    // Should be approximately half the Tel Aviv-Jerusalem distance (~27km)
    expect(distance).toBeGreaterThan(20000);
    expect(distance).toBeLessThan(35000);
  });

  it('returns Infinity for empty route', () => {
    const shelter = makeShelter({ lat: 32.0853, lon: 34.7818 });
    expect(getDistanceToRoute(shelter, [])).toBe(Infinity);
  });

  it('computes approximate Tel Aviv to Jerusalem distance correctly', () => {
    // Tel Aviv to Jerusalem is approximately 54km
    const shelter = makeShelter({ lat: 31.7683, lon: 35.2137 }); // Jerusalem
    const routeWithSinglePoint: LatLng[] = [{ lat: 32.0853, lng: 34.7818 }]; // Tel Aviv
    const distance = getDistanceToRoute(shelter, routeWithSinglePoint);
    // Should be approximately 54km (within 5km tolerance)
    expect(distance).toBeGreaterThan(49000);
    expect(distance).toBeLessThan(59000);
  });
});

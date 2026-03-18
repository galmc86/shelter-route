import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNearestShelters } from '../useNearestShelters';
import type { Shelter } from '../../types';

function makeShelter(
  id: string,
  lat: number,
  lon: number
): Shelter {
  return {
    id,
    name: `Shelter ${id}`,
    lat,
    lon,
    city: '',
  };
}

describe('useNearestShelters', () => {
  it('returns empty array initially', () => {
    const { result } = renderHook(() => useNearestShelters());
    expect(result.current.nearestShelters).toEqual([]);
    expect(result.current.isSearching).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('returns shelters sorted by distance from given location', () => {
    const shelters = [
      makeShelter('far', 32.1, 34.9),     // Farther from origin
      makeShelter('close', 32.001, 34.781), // Close to origin
      makeShelter('mid', 32.05, 34.82),    // Mid distance
    ];

    const { result } = renderHook(() => useNearestShelters());

    act(() => {
      result.current.findNearest(shelters, 32.0, 34.78);
    });

    expect(result.current.nearestShelters).toHaveLength(3);
    expect(result.current.nearestShelters[0].id).toBe('close');
    expect(result.current.nearestShelters[1].id).toBe('mid');
    expect(result.current.nearestShelters[2].id).toBe('far');
  });

  it('respects count parameter', () => {
    const shelters = [
      makeShelter('s1', 32.001, 34.781),
      makeShelter('s2', 32.002, 34.782),
      makeShelter('s3', 32.003, 34.783),
      makeShelter('s4', 32.004, 34.784),
      makeShelter('s5', 32.005, 34.785),
    ];

    const { result } = renderHook(() => useNearestShelters());

    act(() => {
      result.current.findNearest(shelters, 32.0, 34.78, 3);
    });

    expect(result.current.nearestShelters).toHaveLength(3);
  });

  it('returns error when no shelters are provided', () => {
    const { result } = renderHook(() => useNearestShelters());

    act(() => {
      result.current.findNearest([], 32.0, 34.78);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.nearestShelters).toEqual([]);
  });

  it('includes distanceFromRoute and walkingTimeMinutes in results', () => {
    const shelters = [makeShelter('s1', 32.001, 34.781)];

    const { result } = renderHook(() => useNearestShelters());

    act(() => {
      result.current.findNearest(shelters, 32.0, 34.78);
    });

    const shelter = result.current.nearestShelters[0];
    expect(shelter.distanceFromRoute).toBeGreaterThan(0);
    expect(shelter.walkingTimeMinutes).toBeGreaterThanOrEqual(1);
  });

  it('clears shelters and error on clear()', () => {
    const shelters = [makeShelter('s1', 32.001, 34.781)];

    const { result } = renderHook(() => useNearestShelters());

    act(() => {
      result.current.findNearest(shelters, 32.0, 34.78);
    });

    expect(result.current.nearestShelters).toHaveLength(1);

    act(() => {
      result.current.clear();
    });

    expect(result.current.nearestShelters).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('defaults to 10 shelters when count is not specified', () => {
    const shelters = Array.from({ length: 15 }, (_, i) =>
      makeShelter(`s${i}`, 32.0 + i * 0.001, 34.78 + i * 0.001)
    );

    const { result } = renderHook(() => useNearestShelters());

    act(() => {
      result.current.findNearest(shelters, 32.0, 34.78);
    });

    expect(result.current.nearestShelters).toHaveLength(10);
  });
});

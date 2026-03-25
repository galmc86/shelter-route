import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSearchPanelShelters } from '../useSearchPanelShelters';

vi.mock('../../services/shelterReportsService', () => ({
  getAggregatedStatus: (shelterId: string) => shelterId === 'trusted' ? 'open' : null,
}));

describe('useSearchPanelShelters', () => {
  it('defaults to recommended sorting for proximity lookups and resets to distance for route mode', async () => {
    const view = renderHook(
      ({ preferRecommendedSort }) => useSearchPanelShelters({
        routeInfo: null,
        routesWithShelters: [],
        selectedRouteIndex: 0,
        nearbyShelters: [
          {
            id: 'closest',
            name: 'Closest Shelter',
            city: 'Tel Aviv',
            lat: 32.1,
            lon: 34.8,
            distanceFromRoute: 70,
            walkingTimeMinutes: 1,
          },
          {
            id: 'trusted',
            name: 'Trusted Shelter',
            city: 'Tel Aviv',
            lat: 32.101,
            lon: 34.801,
            isAccessible: true,
            distanceFromRoute: 120,
            walkingTimeMinutes: 2,
          },
        ],
        capacityMap: new Map([
          ['trusted', { capacity: 100, currentOccupancy: 18, lastUpdated: '2026-03-24T11:58:00.000Z' }],
        ]),
        preferRecommendedSort,
        currentOrigin: null,
        currentDestination: null,
        historyEntries: [],
        travelMode: 'WALKING',
        saveHistoryRoute: vi.fn(),
        unsaveHistoryRoute: vi.fn(),
      }),
      {
        initialProps: {
          preferRecommendedSort: true,
        },
      }
    );

    expect(view.result.current.sortMode).toBe('recommended');
    expect(view.result.current.displayedShelters[0].id).toBe('trusted');

    act(() => {
      view.result.current.setSortMode('walkingTime');
    });

    expect(view.result.current.displayedShelters[0].id).toBe('closest');

    view.rerender({ preferRecommendedSort: false });

    await waitFor(() => {
      expect(view.result.current.sortMode).toBe('distance');
    });

    expect(view.result.current.displayedShelters[0].id).toBe('closest');
  });
});

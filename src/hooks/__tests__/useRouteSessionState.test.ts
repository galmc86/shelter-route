import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRouteSessionState } from '../useRouteSessionState';
import type { RouteWithShelters, RouteOption } from '../../types';

const mockTrackRouteSearch = vi.fn();

vi.mock('../../services/safetyAnalyticsService', () => ({
  trackRouteSearch: (...args: unknown[]) => mockTrackRouteSearch(...args),
}));

describe('useRouteSessionState', () => {
  beforeEach(() => {
    mockTrackRouteSearch.mockReset();
    window.history.replaceState({}, '', '/');
  });

  it('bootstraps a shared route from the URL once and strips query params', async () => {
    const searchRoute = vi.fn();
    window.history.replaceState({}, '', '/?from=32.1,34.8&to=32.2,34.9&mode=DRIVING');

    renderHook(() => useRouteSessionState({
      searchRoute,
      routesWithShelters: [],
      selectedRouteIndex: 0,
    }));

    await waitFor(() => {
      expect(searchRoute).toHaveBeenCalledWith(
        { lat: 32.1, lng: 34.8 },
        { lat: 32.2, lng: 34.9 },
        'DRIVING'
      );
    });

    expect(window.location.search).toBe('');
  });

  it('updates share metadata and analytics when a route search runs', () => {
    const searchRoute = vi.fn();
    const { result, rerender } = renderHook(
      ({ routesWithShelters }) => useRouteSessionState({
        searchRoute,
        routesWithShelters,
        selectedRouteIndex: 0,
      }),
      {
        initialProps: {
          routesWithShelters: [] as RouteWithShelters[],
        },
      }
    );

    act(() => {
      result.current.runRouteSearch(
        { lat: 31.7, lng: 35.2 },
        { lat: 32.08, lng: 34.78 },
        'WALKING'
      );
    });

    expect(result.current.shareOrigin).toEqual({ lat: 31.7, lng: 35.2 });
    expect(result.current.shareDestination).toEqual({ lat: 32.08, lng: 34.78 });
    expect(result.current.shareTravelMode).toBe('WALKING');
    expect(searchRoute).toHaveBeenCalledWith(
      { lat: 31.7, lng: 35.2 },
      { lat: 32.08, lng: 34.78 },
      'WALKING'
    );

    rerender({
      routesWithShelters: [
        {
          route: {
            path: [],
            bounds: {
              southWest: { lat: 31.7, lng: 35.2 },
              northEast: { lat: 32.08, lng: 34.78 },
            },
            distance: '1 km',
            duration: '10 min',
            durationSeconds: 600,
            distanceMeters: 1000,
            isFastest: true,
          } satisfies RouteOption,
          shelterCount: 4,
        },
      ],
    });

    expect(mockTrackRouteSearch).toHaveBeenCalledWith(4);
  });
});

import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useShelterNavigationFlow } from '../useShelterNavigationFlow';
import type { ShelterWithDistance } from '../useShelters';
import type { LocationPoint } from '../../types';

const mockShelter: ShelterWithDistance = {
  id: 'shelter-1',
  name: 'Shelter 1',
  address: 'Test Address',
  lat: 32.11,
  lon: 34.81,
  city: 'Tel Aviv',
  distanceFromRoute: 120,
  walkingTimeMinutes: 2,
  isAccessible: true,
  capacity: 20,
  currentOccupancy: 3,
};

describe('useShelterNavigationFlow', () => {
  it('starts navigation immediately when current location is available', async () => {
    const getLocation = vi.fn();
    const startNavigation = vi.fn(() => Promise.resolve());
    const stopNavigation = vi.fn();
    const setPanelExpanded = vi.fn();
    const currentLocation: LocationPoint = { lat: 32.12, lng: 34.82 };

    const { result } = renderHook(() => useShelterNavigationFlow({
      currentLocation,
      getLocation,
      startNavigation,
      stopNavigation,
      setPanelExpanded,
      t: (key) => key,
    }));

    await act(async () => {
      await result.current.handleNavigateToShelter(mockShelter);
    });

    expect(getLocation).not.toHaveBeenCalled();
    expect(startNavigation).toHaveBeenCalledWith(mockShelter, currentLocation, expect.any(Function));
    expect(setPanelExpanded).toHaveBeenCalledWith(false);
  });

  it('requests location first and resumes navigation once location becomes available', async () => {
    const getLocation = vi.fn();
    const startNavigation = vi.fn(() => Promise.resolve());
    const stopNavigation = vi.fn();
    const setPanelExpanded = vi.fn();

    const view = renderHook(
      ({ currentLocation }) => useShelterNavigationFlow({
        currentLocation,
        getLocation,
        startNavigation,
        stopNavigation,
        setPanelExpanded,
        t: (key) => key,
      }),
      {
        initialProps: {
          currentLocation: null as LocationPoint | null,
        },
      }
    );

    await act(async () => {
      await view.result.current.handleNavigateToShelter(mockShelter);
    });

    expect(getLocation).toHaveBeenCalledTimes(1);
    expect(startNavigation).not.toHaveBeenCalled();

    view.rerender({
      currentLocation: { lat: 32.12, lng: 34.82 },
    });

    await waitFor(() => {
      expect(startNavigation).toHaveBeenCalledWith(
        mockShelter,
        { lat: 32.12, lng: 34.82 },
        expect.any(Function)
      );
    });

    expect(setPanelExpanded).toHaveBeenCalledWith(false);
  });

  it('reopens the panel when navigation is cancelled', () => {
    const getLocation = vi.fn();
    const startNavigation = vi.fn(() => Promise.resolve());
    const stopNavigation = vi.fn();
    const setPanelExpanded = vi.fn();

    const { result } = renderHook(() => useShelterNavigationFlow({
      currentLocation: { lat: 32.12, lng: 34.82 },
      getLocation,
      startNavigation,
      stopNavigation,
      setPanelExpanded,
      t: (key) => key,
    }));

    act(() => {
      result.current.handleCancelNavigation();
    });

    expect(stopNavigation).toHaveBeenCalledTimes(1);
    expect(setPanelExpanded).toHaveBeenCalledWith(true);
  });
});

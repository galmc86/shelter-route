import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SavedLocations } from '../SavedLocations';
import type { SavedLocation } from '../../hooks/useSavedLocations';

vi.mock('../../i18n', () => ({
  useLanguage: () => ({
    language: 'en' as const,
    t: (key: string) => {
      const translations: Record<string, string> = {
        'savedLocations.title': 'Saved Places',
        'savedLocations.tapToFind': 'Tap to find nearby shelters',
        'savedLocations.remove': 'Remove',
        'savedLocations.addCurrent': 'Add current location',
        'savedLocations.namePlaceholder': 'Location name...',
        'savedLocations.save': 'Save',
        'savedLocations.lastUsed': 'Last used',
        'savedLocations.startRoute': 'Use as route start',
        'savedLocations.startPresetRoute': 'Start saved route',
        'savedLocations.closestShelter': '~{{minutes}} min to shelter',
        'savedLocations.accessibleNearby': 'Accessible nearby',
        'savedLocations.routePreset': 'Saved route to {{destination}}',
        'savedLocations.label.home': 'Home',
        'savedLocations.label.work': 'Work',
        'savedLocations.label.school': 'School',
        'savedLocations.label.other': 'Other',
        'savedLocations.maxReached': 'Maximum 5 saved locations',
      };
      return translations[key] ?? key;
    },
  }),
}));

describe('SavedLocations', () => {
  const baseLocation = {
    id: 'home-1',
    name: 'Home',
    label: 'home',
    lat: 32.1,
    lng: 34.8,
  } satisfies SavedLocation;
  const workLocation = {
    id: 'work-1',
    name: 'Work',
    label: 'work',
    lat: 32.2,
    lng: 34.9,
    lastUsedAt: 1_710_000_000_000,
  } satisfies SavedLocation;

  const renderComponent = (props: Partial<ComponentProps<typeof SavedLocations>> = {}) => {
    const onSelectLocation = vi.fn();
    const onStartRouteFromLocation = vi.fn();
    const onAddLocation = vi.fn();
    const onRemoveLocation = vi.fn();

    render(
      <SavedLocations
        locations={[baseLocation]}
        locationSignals={{}}
        onSelectLocation={onSelectLocation}
        onStartRouteFromLocation={onStartRouteFromLocation}
        onAddLocation={onAddLocation}
        onRemoveLocation={onRemoveLocation}
        isMaxReached={false}
        currentLocation={{ lat: 32.1, lng: 34.8 }}
        {...props}
      />
    );

    return { onSelectLocation, onStartRouteFromLocation, onAddLocation, onRemoveLocation };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls onSelectLocation with the saved location when a chip is tapped', () => {
    const { onSelectLocation } = renderComponent();

    fireEvent.click(screen.getByRole('button', { name: 'Home - Tap to find nearby shelters' }));

    expect(onSelectLocation).toHaveBeenCalledWith(baseLocation);
  });

  it('removes a saved location', () => {
    const { onRemoveLocation } = renderComponent();

    fireEvent.click(screen.getByRole('button', { name: /Remove Home/i }));

    expect(onRemoveLocation).toHaveBeenCalledWith('home-1');
  });

  it('starts route mode from a saved location', () => {
    const { onStartRouteFromLocation } = renderComponent();

    fireEvent.click(screen.getByRole('button', { name: 'Use as route start Home' }));

    expect(onStartRouteFromLocation).toHaveBeenCalledWith(baseLocation);
  });

  it('shows saved route details and uses the preset route action label when available', () => {
    const { onStartRouteFromLocation } = renderComponent({
      locations: [
        {
          ...workLocation,
          routePreset: {
            destination: { lat: 32.3, lng: 34.95 },
            destinationName: 'Safe Room',
            travelMode: 'WALKING',
            savedAt: 1_710_000_000_500,
          },
        },
      ],
      locationSignals: {
        'work-1': {
          closestShelterMinutes: 2,
          nearbyShelterCount: 3,
          hasAccessibleNearby: true,
        },
      },
    });

    expect(screen.getByText('Saved route to Safe Room')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Start saved route Work' }));

    expect(onStartRouteFromLocation).toHaveBeenCalled();
  });

  it('opens the add form and saves the current location', () => {
    const { onAddLocation } = renderComponent({ locations: [] });

    fireEvent.click(screen.getByRole('button', { name: 'Add current location' }));
    fireEvent.click(screen.getByRole('button', { name: /Work/i }));
    fireEvent.change(screen.getByDisplayValue('Work'), {
      target: { value: 'Office' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onAddLocation).toHaveBeenCalledWith({
      name: 'Office',
      label: 'work',
      lat: 32.1,
      lng: 34.8,
    });
  });

  it('shows a last used badge on the most recently used chip', () => {
    renderComponent({ locations: [baseLocation, workLocation] });

    expect(screen.getByText('Last used')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Work - Tap to find nearby shelters' })).toBeInTheDocument();
  });

  it('shows the closest shelter summary and accessible badge when signals exist', () => {
    renderComponent({
      locations: [workLocation],
      locationSignals: {
        'work-1': {
          closestShelterMinutes: 2,
          nearbyShelterCount: 3,
          hasAccessibleNearby: true,
        },
      },
    });

    expect(screen.getByText('~2 min to shelter')).toBeInTheDocument();
    expect(screen.getByText('Accessible nearby')).toBeInTheDocument();
  });

  it('allows replacing a singleton profile when the list is full', () => {
    const { onAddLocation } = renderComponent({
      locations: [
        baseLocation,
        workLocation,
        { id: 'school-1', name: 'School', label: 'school', lat: 32.21, lng: 34.91 },
        { id: 'other-1', name: 'Gym', label: 'other', lat: 32.22, lng: 34.92 },
        { id: 'other-2', name: 'Parents', label: 'other', lat: 32.23, lng: 34.93 },
      ],
      isMaxReached: true,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add current location' }));
    fireEvent.click(screen.getByRole('button', { name: 'Home', pressed: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onAddLocation).toHaveBeenCalledWith({
      name: 'Home',
      label: 'home',
      lat: 32.1,
      lng: 34.8,
    });
  });

  it('blocks adding a new "other" location when the list is full', () => {
    const { onAddLocation } = renderComponent({
      locations: [
        baseLocation,
        workLocation,
        { id: 'school-1', name: 'School', label: 'school', lat: 32.21, lng: 34.91 },
        { id: 'other-1', name: 'Gym', label: 'other', lat: 32.22, lng: 34.92 },
        { id: 'other-2', name: 'Parents', label: 'other', lat: 32.23, lng: 34.93 },
      ],
      isMaxReached: true,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add current location' }));
    fireEvent.click(screen.getByRole('button', { name: /Other/i }));

    expect(screen.getByText('Maximum 5 saved locations')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onAddLocation).not.toHaveBeenCalled();
  });
});

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
        'savedLocations.label.home': 'Home',
        'savedLocations.label.work': 'Work',
        'savedLocations.label.school': 'School',
        'savedLocations.label.other': 'Other',
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

  const renderComponent = (props: Partial<ComponentProps<typeof SavedLocations>> = {}) => {
    const onSelectLocation = vi.fn();
    const onAddLocation = vi.fn();
    const onRemoveLocation = vi.fn();

    render(
      <SavedLocations
        locations={[baseLocation]}
        onSelectLocation={onSelectLocation}
        onAddLocation={onAddLocation}
        onRemoveLocation={onRemoveLocation}
        isMaxReached={false}
        currentLocation={{ lat: 32.1, lng: 34.8 }}
        {...props}
      />
    );

    return { onSelectLocation, onAddLocation, onRemoveLocation };
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

  it('opens the add form and saves the current location', () => {
    const { onAddLocation } = renderComponent({ locations: [] });

    fireEvent.click(screen.getByRole('button', { name: 'Add current location' }));
    fireEvent.click(screen.getByRole('button', { name: /Work/i }));
    fireEvent.change(screen.getByPlaceholderText('Location name...'), {
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
});

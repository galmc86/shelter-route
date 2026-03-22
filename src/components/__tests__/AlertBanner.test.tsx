import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AlertBanner } from '../AlertBanner';
import type { AlertRegion } from '../../services/orefAlertService';

// Mock useLanguage to return English translations
vi.mock('../../i18n', () => ({
  useLanguage: () => ({
    language: 'en' as const,
    t: (key: string) => {
      const translations: Record<string, string> = {
        'alert.title': 'Rocket Alert!',
        'alert.region': 'Region:',
        'alert.countdown': 'Time to shelter',
        'alert.seconds': 'seconds',
        'alert.findShelter': 'Find Shelter',
        'alert.dismiss': 'Dismiss',
        'alert.staySheltered': 'Stay Sheltered',
        'alert.remainInShelter': 'Remain in shelter',
        'alert.minutesRemaining': 'minutes remaining',
        'alert.imSafe': "I'm Safe",
        'alert.needHelp': 'Need Help?',
        'alert.police': 'Police',
        'alert.mda': 'Ambulance / MDA',
        'alert.fire': 'Fire',
        'alert.homeFrontCommand': 'Home Front Command',
      };
      return translations[key] ?? key;
    },
  }),
}));

// Mock IntersectionObserver
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();

class MockIntersectionObserver {
  constructor(_cb: IntersectionObserverCallback, _opts?: IntersectionObserverInit) { void _cb; void _opts; }
  observe = mockObserve;
  disconnect = mockDisconnect;
  unobserve = vi.fn();
  root = null;
  rootMargin = '';
  thresholds = [0];
  takeRecords = vi.fn(() => []);
}

vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

const mockRegion: AlertRegion = {
  name: 'תל אביב',
  nameEn: 'Tel Aviv',
  timeToShelter: 15,
  lat: 32.0853,
  lng: 34.7818,
  radius: 10,
};

describe('AlertBanner', () => {
  let onFindShelter: () => void;
  let onDismiss: () => void;

  beforeEach(() => {
    onFindShelter = vi.fn() as unknown as () => void;
    onDismiss = vi.fn() as unknown as () => void;
  });

  it('renders countdown when countdown > 0', () => {
    render(
      <AlertBanner
        matchedRegion={mockRegion}
        countdown={10}
        onFindShelter={onFindShelter}
        onDismiss={onDismiss}
        isAlertActive={true}
      />
    );

    const countdownNumbers = screen.getAllByText('10');
    expect(countdownNumbers.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('seconds')).toBeInTheDocument();
  });

  it('shows Find Shelter button during countdown', () => {
    render(
      <AlertBanner
        matchedRegion={mockRegion}
        countdown={10}
        onFindShelter={onFindShelter}
        onDismiss={onDismiss}
        isAlertActive={true}
      />
    );

    expect(screen.getByText('Find Shelter')).toBeInTheDocument();
  });

  it('does not show Dismiss button during active countdown (isExpired=false)', () => {
    render(
      <AlertBanner
        matchedRegion={mockRegion}
        countdown={10}
        onFindShelter={onFindShelter}
        onDismiss={onDismiss}
        isAlertActive={true}
      />
    );

    // The Dismiss button should not be present during active countdown
    expect(screen.queryByText('Dismiss')).not.toBeInTheDocument();
  });

  it('shows debrief screen with I\'m Safe button after expiry (isExpired=true)', () => {
    render(
      <AlertBanner
        matchedRegion={mockRegion}
        countdown={0}
        onFindShelter={onFindShelter}
        onDismiss={onDismiss}
        isAlertActive={true}
      />
    );

    // When countdown is 0, the debrief screen should appear with I'm Safe button
    expect(screen.getByText("I'm Safe")).toBeInTheDocument();
  });

  it('calls onFindShelter when Find Shelter is clicked', () => {
    render(
      <AlertBanner
        matchedRegion={mockRegion}
        countdown={10}
        onFindShelter={onFindShelter}
        onDismiss={onDismiss}
        isAlertActive={true}
      />
    );

    fireEvent.click(screen.getByText('Find Shelter'));
    expect(onFindShelter).toHaveBeenCalledTimes(1);
  });
});

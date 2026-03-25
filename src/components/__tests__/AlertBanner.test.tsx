import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AlertBanner } from '../AlertBanner';
import type { AlertRegion } from '../../services/orefAlertService';
const mockMarkFamilySafe = vi.fn();
const mockMarkNeedsCheckIn = vi.fn();
const mockUseFamilyGroupState = vi.fn();

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
        'alert.openShelter': 'Open shelter guidance now',
        'alert.refreshShelter': 'Refresh shelter guidance',
        'alert.actionHintFallback': 'Uses your current location, or the last known location if needed.',
        'alert.actionHintActive': 'Shelter mode is already open and updating below.',
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
        'family.alertCheckInNeeded': 'Check in with your family once you reach shelter.',
        'family.alertSafeShared': 'Your safe status was shared with the local family group.',
        'family.markedSafe': 'Marked as Safe',
      };
      return translations[key] ?? key;
    },
  }),
}));

vi.mock('../../hooks/useFamilyGroupState', () => ({
  useFamilyGroupState: () => mockUseFamilyGroupState(),
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
    mockMarkFamilySafe.mockClear();
    mockMarkNeedsCheckIn.mockClear();
    mockUseFamilyGroupState.mockReset();
    mockUseFamilyGroupState.mockReturnValue({
      group: null,
      currentMember: null,
      hasGroup: false,
      isCurrentMemberSafe: false,
      safeMembersCount: 0,
      waitingMembersCount: 0,
      shareLink: null,
      createFamilyGroup: vi.fn(),
      joinFamilyGroup: vi.fn(),
      markFamilySafe: mockMarkFamilySafe,
      markNeedsCheckIn: mockMarkNeedsCheckIn,
      leaveFamilyGroup: vi.fn(),
    });
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

    expect(screen.getByText('Open shelter guidance now')).toBeInTheDocument();
    expect(screen.getByText('Uses your current location, or the last known location if needed.')).toBeInTheDocument();
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

    fireEvent.click(screen.getByText('Open shelter guidance now'));
    expect(onFindShelter).toHaveBeenCalledTimes(1);
  });

  it('switches the CTA copy once emergency mode is already active', () => {
    render(
      <AlertBanner
        matchedRegion={mockRegion}
        countdown={10}
        onFindShelter={onFindShelter}
        onDismiss={onDismiss}
        isAlertActive={true}
        emergencyMode={true}
      />
    );

    expect(screen.getByText('Refresh shelter guidance')).toBeInTheDocument();
    expect(screen.getByText('Shelter mode is already open and updating below.')).toBeInTheDocument();
  });

  it('shows a family check-in action and marks the user safe when clicked', () => {
    mockUseFamilyGroupState.mockReturnValue({
      group: { groupCode: 'ABC123', memberName: 'Dana', members: [] },
      currentMember: { id: '1', name: 'Dana', isSafe: false },
      hasGroup: true,
      isCurrentMemberSafe: false,
      safeMembersCount: 0,
      waitingMembersCount: 2,
      shareLink: 'https://example.com/?familyGroup=ABC123',
      createFamilyGroup: vi.fn(),
      joinFamilyGroup: vi.fn(),
      markFamilySafe: mockMarkFamilySafe,
      markNeedsCheckIn: mockMarkNeedsCheckIn,
      leaveFamilyGroup: vi.fn(),
    });

    render(
      <AlertBanner
        matchedRegion={mockRegion}
        countdown={10}
        onFindShelter={onFindShelter}
        onDismiss={onDismiss}
        isAlertActive={true}
      />
    );

    expect(screen.getByText('Check in with your family once you reach shelter.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: "I'm Safe" }));

    expect(mockMarkFamilySafe).toHaveBeenCalledTimes(1);
  });

  it('resets the local family status when a new alert starts', () => {
    mockUseFamilyGroupState.mockReturnValue({
      group: { groupCode: 'ABC123', memberName: 'Dana', members: [] },
      currentMember: { id: '1', name: 'Dana', isSafe: true },
      hasGroup: true,
      isCurrentMemberSafe: true,
      safeMembersCount: 1,
      waitingMembersCount: 0,
      shareLink: 'https://example.com/?familyGroup=ABC123',
      createFamilyGroup: vi.fn(),
      joinFamilyGroup: vi.fn(),
      markFamilySafe: mockMarkFamilySafe,
      markNeedsCheckIn: mockMarkNeedsCheckIn,
      leaveFamilyGroup: vi.fn(),
    });

    render(
      <AlertBanner
        matchedRegion={mockRegion}
        countdown={10}
        onFindShelter={onFindShelter}
        onDismiss={onDismiss}
        isAlertActive={true}
      />
    );

    expect(mockMarkNeedsCheckIn).toHaveBeenCalledTimes(1);
  });
});

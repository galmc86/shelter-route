import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ShelterResults } from '../ShelterResults';
import type { RankedShelter } from '../../services/shelterRankingService';

const translations: Record<string, string> = {
  'shelters.nearYou': 'Shelters near you',
  'shelters.alongRoute': 'Shelters along route',
  'shelters.noSheltersFound': 'No shelters found',
  'shelters.loading': 'Loading shelters',
  'search.idleTitle': 'Start a search to see shelters',
  'search.idleBody': 'Plan a route, use your current location, or choose a saved place to get shelter guidance.',
  'shelters.walkingTime': '~{{minutes}} min walk',
  'shelters.meters': 'meters',
  'shelters.meter': 'm',
  'sort.label': 'Sort by',
  'sort.recommended': 'Recommended',
  'sort.distance': 'Distance',
  'sort.walkingTime': 'Walking time',
  'recommendation.label': 'Recommended: {{reason}}',
  'recommendation.reportedOpen': 'community reports say it is open',
  'accessibility.filterLabel': 'Accessible only',
  'accessibility.accessible': 'Accessible',
  'accessibility.groundFloor': 'Ground floor',
  'accessibility.floor': 'Floor {{level}}',
  'capacity.occupancy': 'Occupancy',
  'capacity.low': 'Low occupancy',
  'capacity.medium': 'Medium occupancy',
  'capacity.high': 'High occupancy',
  'capacity.unknown': 'Unknown',
  'capacity.legend': 'Capacity legend',
  'capacity.legendLow': 'Low',
  'capacity.legendMedium': 'Medium',
  'capacity.legendHigh': 'High',
  'capacity.legendUnknown': 'Unknown',
  'capacity.estimated': 'Estimated',
  'capacity.estimatedTooltip': 'Estimated only',
  'report.open': 'Open',
};

vi.mock('../../i18n', () => ({
  useLanguage: () => ({
    language: 'en' as const,
    t: (key: string) => translations[key] ?? key,
  }),
}));

describe('ShelterResults', () => {
  it('shows a neutral idle state before any route search', () => {
    render(
      <ShelterResults
        emergencyMode={false}
        proximityMode={false}
        showIdleState={true}
        nearbyShelters={[]}
        displayedShelters={[]}
        sheltersLoading={false}
        showAccessibleOnly={false}
        onShowAccessibleOnlyChange={vi.fn()}
        sortMode="distance"
        onSortModeChange={vi.fn()}
        selectedShelterId={null}
        onShelterClick={vi.fn()}
      />
    );

    expect(screen.getByText('Start a search to see shelters')).toBeInTheDocument();
    expect(screen.getByText('Plan a route, use your current location, or choose a saved place to get shelter guidance.')).toBeInTheDocument();
    expect(screen.queryByText('No shelters found')).not.toBeInTheDocument();
  });

  it('shows a recommendation reason for the top result in proximity flows', () => {
    const displayedShelters: RankedShelter[] = [
      {
        id: 'recommended-shelter',
        name: 'Recommended Shelter',
        city: 'Tel Aviv',
        lat: 32.1,
        lon: 34.8,
        distanceFromRoute: 120,
        walkingTimeMinutes: 2,
        recommendationScore: 250,
        recommendationReasonKey: 'recommendation.reportedOpen',
        communityStatus: 'open',
        occupancyPercent: 22,
      },
      {
        id: 'other-shelter',
        name: 'Other Shelter',
        city: 'Tel Aviv',
        lat: 32.101,
        lon: 34.801,
        distanceFromRoute: 150,
        walkingTimeMinutes: 3,
        recommendationScore: 180,
        recommendationReasonKey: 'recommendation.shortestWalk',
        communityStatus: null,
      },
    ];

    render(
      <ShelterResults
        emergencyMode={true}
        nearbyShelters={displayedShelters}
        displayedShelters={displayedShelters}
        sheltersLoading={false}
        showAccessibleOnly={false}
        onShowAccessibleOnlyChange={vi.fn()}
        sortMode="recommended"
        onSortModeChange={vi.fn()}
        selectedShelterId={null}
        onShelterClick={vi.fn()}
        capacityMap={new Map([
          ['recommended-shelter', { capacity: 100, currentOccupancy: 22, lastUpdated: '2026-03-24T11:58:00.000Z' }],
        ])}
      />
    );

    expect(screen.getByRole('button', { name: 'Recommended' })).toBeInTheDocument();
    expect(screen.getAllByText('Recommended: community reports say it is open')).toHaveLength(2);
    expect(screen.getAllByText('~2 min walk')).toHaveLength(2);
    expect(screen.getAllByText('Low occupancy · 22%')).toHaveLength(2);
  });

  it('does not show the recommended sort in regular route mode', () => {
    const displayedShelters: RankedShelter[] = [
      {
        id: 'route-shelter',
        name: 'Route Shelter',
        city: 'Haifa',
        lat: 32.8,
        lon: 34.9,
        distanceFromRoute: 90,
        walkingTimeMinutes: 1,
        recommendationScore: 220,
        recommendationReasonKey: 'recommendation.shortestWalk',
        communityStatus: null,
      },
    ];

    render(
      <ShelterResults
        emergencyMode={false}
        proximityMode={false}
        nearbyShelters={displayedShelters}
        displayedShelters={displayedShelters}
        sheltersLoading={false}
        showAccessibleOnly={false}
        onShowAccessibleOnlyChange={vi.fn()}
        sortMode="distance"
        onSortModeChange={vi.fn()}
        selectedShelterId={null}
        onShelterClick={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: 'Recommended' })).not.toBeInTheDocument();
  });

  it('renders a detail card for the selected shelter', () => {
    const displayedShelters: RankedShelter[] = [
      {
        id: 'selected-shelter',
        name: 'Selected Shelter',
        city: 'Haifa',
        address: '123 Main Street',
        lat: 32.8,
        lon: 34.9,
        distanceFromRoute: 90,
        walkingTimeMinutes: 1,
        recommendationScore: 220,
        recommendationReasonKey: 'recommendation.reportedOpen',
        communityStatus: 'open',
        occupancyPercent: 16,
        isAccessible: true,
      },
    ];

    const { container } = render(
      <ShelterResults
        emergencyMode={false}
        proximityMode={true}
        nearbyShelters={displayedShelters}
        displayedShelters={displayedShelters}
        sheltersLoading={false}
        showAccessibleOnly={false}
        onShowAccessibleOnlyChange={vi.fn()}
        sortMode="recommended"
        onSortModeChange={vi.fn()}
        selectedShelterId="selected-shelter"
        onShelterClick={vi.fn()}
      />
    );

    const detailCard = container.querySelector('.shelter-detail-card');
    expect(detailCard).not.toBeNull();
    expect(detailCard?.textContent).toContain('Selected Shelter');
    expect(detailCard?.textContent).toContain('123 Main Street');
    expect(detailCard?.textContent).toContain('~1 min walk');
  });
});

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ShelterResults } from '../ShelterResults';
import type { RankedShelter } from '../../services/shelterRankingService';

const translations: Record<string, string> = {
  'shelters.nearYou': 'Shelters near you',
  'shelters.alongRoute': 'Shelters along route',
  'shelters.noSheltersFound': 'No shelters found',
  'shelters.loading': 'Loading shelters',
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
    expect(screen.getByText('Recommended: community reports say it is open')).toBeInTheDocument();
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
});

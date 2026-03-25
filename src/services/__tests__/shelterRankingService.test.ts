import { describe, expect, it } from 'vitest';
import { rankSheltersByRecommendation } from '../shelterRankingService';

describe('rankSheltersByRecommendation', () => {
  it('prioritizes trust and availability over raw proximity', () => {
    const shelters = [
      {
        id: 'locked-close',
        name: 'Locked Close',
        city: 'Tel Aviv',
        lat: 32.1,
        lon: 34.8,
        distanceFromRoute: 60,
        walkingTimeMinutes: 1,
      },
      {
        id: 'open-accessible',
        name: 'Open Accessible',
        city: 'Tel Aviv',
        lat: 32.101,
        lon: 34.801,
        isAccessible: true,
        distanceFromRoute: 120,
        walkingTimeMinutes: 2,
      },
    ];

    const ranked = rankSheltersByRecommendation(shelters, {
      capacityMap: new Map([
        ['open-accessible', { capacity: 120, currentOccupancy: 24, lastUpdated: '2026-03-24T11:55:00.000Z' }],
      ]),
      communityStatusMap: new Map([
        ['locked-close', 'locked'],
        ['open-accessible', 'open'],
      ]),
      now: Date.parse('2026-03-24T12:00:00.000Z'),
    });

    expect(ranked[0].id).toBe('open-accessible');
    expect(ranked[0].recommendationReasonKey).toBe('recommendation.reportedOpen');
    expect(ranked[1].id).toBe('locked-close');
  });

  it('falls back to the shortest walk when no trust signals are available', () => {
    const shelters = [
      {
        id: 'farther',
        name: 'Farther',
        city: 'Jerusalem',
        lat: 31.7,
        lon: 35.2,
        distanceFromRoute: 180,
        walkingTimeMinutes: 3,
      },
      {
        id: 'closest',
        name: 'Closest',
        city: 'Jerusalem',
        lat: 31.7005,
        lon: 35.2005,
        distanceFromRoute: 80,
        walkingTimeMinutes: 1,
      },
    ];

    const ranked = rankSheltersByRecommendation(shelters);

    expect(ranked[0].id).toBe('closest');
    expect(ranked[0].recommendationReasonKey).toBe('recommendation.shortestWalk');
  });
});

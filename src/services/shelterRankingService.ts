import type { ShelterWithDistance } from '../hooks/useShelters';
import type { CapacityData } from './capacityService';
import type { ShelterReportStatus } from './shelterReportsService';

export type ShelterRecommendationReasonKey =
  | 'recommendation.reportedOpen'
  | 'recommendation.accessibleAndAvailable'
  | 'recommendation.accessible'
  | 'recommendation.spaceAvailable'
  | 'recommendation.freshData'
  | 'recommendation.shortestWalk';

export interface RankedShelter extends ShelterWithDistance {
  recommendationScore: number;
  recommendationReasonKey: ShelterRecommendationReasonKey;
  communityStatus: ShelterReportStatus | null;
  occupancyPercent?: number;
}

interface RankSheltersOptions {
  capacityMap?: Map<string, CapacityData>;
  communityStatusMap?: Map<string, ShelterReportStatus | null>;
  now?: number;
}

function getOccupancyPercent(capacityData: CapacityData | undefined): number | undefined {
  if (!capacityData || capacityData.capacity <= 0) {
    return undefined;
  }

  return Math.round((capacityData.currentOccupancy / capacityData.capacity) * 100);
}

function getFreshnessMinutes(lastUpdated: string | undefined, now: number): number | undefined {
  if (!lastUpdated) {
    return undefined;
  }

  const parsed = Date.parse(lastUpdated);
  if (Number.isNaN(parsed)) {
    return undefined;
  }

  return Math.max(0, (now - parsed) / 60_000);
}

function getCommunityScore(status: ShelterReportStatus | null): number {
  switch (status) {
    case 'open':
      return 20;
    case 'empty':
      return 10;
    case 'crowded':
      return -18;
    case 'key-required':
      return -20;
    case 'locked':
      return -36;
    case 'damaged':
      return -40;
    default:
      return 0;
  }
}

function getCapacityScore(occupancyPercent: number | undefined): number {
  if (occupancyPercent === undefined) {
    return 0;
  }

  if (occupancyPercent < 50) {
    return 16;
  }

  if (occupancyPercent <= 80) {
    return 4;
  }

  return -14;
}

function getFreshnessScore(freshnessMinutes: number | undefined): number {
  if (freshnessMinutes === undefined) {
    return 0;
  }

  if (freshnessMinutes <= 15) {
    return 6;
  }

  if (freshnessMinutes <= 60) {
    return 3;
  }

  if (freshnessMinutes <= 180) {
    return -2;
  }

  return -8;
}

function getDistanceScore(shelter: ShelterWithDistance): number {
  return 220 - shelter.walkingTimeMinutes * 24 - shelter.distanceFromRoute * 0.07;
}

function getRecommendationReasonKey(
  shelter: ShelterWithDistance,
  occupancyPercent: number | undefined,
  communityStatus: ShelterReportStatus | null,
  freshnessMinutes: number | undefined
): ShelterRecommendationReasonKey {
  if (communityStatus === 'open') {
    return 'recommendation.reportedOpen';
  }

  if (shelter.isAccessible && occupancyPercent !== undefined && occupancyPercent < 50) {
    return 'recommendation.accessibleAndAvailable';
  }

  if (shelter.isAccessible) {
    return 'recommendation.accessible';
  }

  if (occupancyPercent !== undefined && occupancyPercent < 50) {
    return 'recommendation.spaceAvailable';
  }

  if (freshnessMinutes !== undefined && freshnessMinutes <= 15) {
    return 'recommendation.freshData';
  }

  return 'recommendation.shortestWalk';
}

export function rankSheltersByRecommendation(
  shelters: ShelterWithDistance[],
  { capacityMap, communityStatusMap, now = Date.now() }: RankSheltersOptions = {}
): RankedShelter[] {
  return shelters
    .map((shelter) => {
      const capacityData = capacityMap?.get(shelter.id);
      const occupancyPercent = getOccupancyPercent(capacityData);
      const communityStatus = communityStatusMap?.get(shelter.id) ?? null;
      const freshnessMinutes = getFreshnessMinutes(capacityData?.lastUpdated ?? shelter.lastUpdated, now);

      const recommendationScore =
        getDistanceScore(shelter) +
        (shelter.isAccessible ? 12 : 0) +
        getCapacityScore(occupancyPercent) +
        getCommunityScore(communityStatus) +
        getFreshnessScore(freshnessMinutes);

      return {
        ...shelter,
        recommendationScore,
        recommendationReasonKey: getRecommendationReasonKey(
          shelter,
          occupancyPercent,
          communityStatus,
          freshnessMinutes
        ),
        communityStatus,
        occupancyPercent,
      };
    })
    .sort((a, b) =>
      b.recommendationScore - a.recommendationScore ||
      a.walkingTimeMinutes - b.walkingTimeMinutes ||
      a.distanceFromRoute - b.distanceFromRoute ||
      a.name.localeCompare(b.name)
    );
}

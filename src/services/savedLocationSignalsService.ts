import type { Shelter } from '../types';
import { haversineDistance } from '../utils/geometry';
import { calculateWalkingTime } from '../utils/shelterDistance';
import type { SavedLocation } from './savedLocationsService';

const PROFILE_SIGNAL_NEARBY_MINUTES = 5;

export interface SavedLocationSignal {
  closestShelterMinutes: number | null;
  nearbyShelterCount: number;
  hasAccessibleNearby: boolean;
}

export function buildSavedLocationSignals(
  locations: SavedLocation[],
  shelters: Shelter[]
): Record<string, SavedLocationSignal> {
  if (!locations.length || !shelters.length) {
    return {};
  }

  return locations.reduce<Record<string, SavedLocationSignal>>((signals, location) => {
    let closestShelterMinutes: number | null = null;
    let nearbyShelterCount = 0;
    let hasAccessibleNearby = false;

    shelters.forEach((shelter) => {
      const distanceMeters = haversineDistance(
        { lat: location.lat, lng: location.lng },
        { lat: shelter.lat, lng: shelter.lon }
      );
      const walkingMinutes = calculateWalkingTime(distanceMeters);

      if (closestShelterMinutes === null || walkingMinutes < closestShelterMinutes) {
        closestShelterMinutes = walkingMinutes;
      }

      if (walkingMinutes <= PROFILE_SIGNAL_NEARBY_MINUTES) {
        nearbyShelterCount += 1;
        if (shelter.isAccessible) {
          hasAccessibleNearby = true;
        }
      }
    });

    signals[location.id] = {
      closestShelterMinutes,
      nearbyShelterCount,
      hasAccessibleNearby,
    };

    return signals;
  }, {});
}

import type { Shelter } from '../types';

/** Average walking speed ~5 km/h = 83.33 m/min, with 20% overhead for non-straight paths */
export const WALKING_SPEED_M_PER_MIN = 83.33;
export const WALKING_OVERHEAD_FACTOR = 1.2;

export interface ShelterWithDistance extends Shelter {
  distanceFromRoute: number;
  walkingTimeMinutes: number;
}

export function calculateWalkingTime(distanceMeters: number): number {
  const adjustedDistance = distanceMeters * WALKING_OVERHEAD_FACTOR;
  return Math.max(1, Math.round(adjustedDistance / WALKING_SPEED_M_PER_MIN));
}

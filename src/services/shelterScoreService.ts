import type { Shelter } from '../types';
import { haversineDistance } from '../utils/geometry';

export interface ShelterScoreResult {
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  score: number;
  sheltersNearby: number;
  nearestDistance: number;
  nearestWalkTime: number;
  accessibleCount: number;
  color: string;
}

/** Average walking speed ~5 km/h = 83.33 m/min, with 20% overhead for non-straight paths */
const WALKING_SPEED_M_PER_SEC = 83.33 / 60;
const WALKING_OVERHEAD_FACTOR = 1.2;

const RADIUS_METERS = 200;

const GRADE_COLORS: Record<ShelterScoreResult['grade'], string> = {
  A: '#4CAF50',
  B: '#8BC34A',
  C: '#FFC107',
  D: '#FF9800',
  F: '#F44336',
};

function getGrade(score: number): ShelterScoreResult['grade'] {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 50) return 'C';
  if (score >= 30) return 'D';
  return 'F';
}

/**
 * Compute a shelter accessibility score (0-100) for a given location.
 *
 * Factors:
 *   - Number of shelters within 200m (40%)
 *   - Walking time to nearest shelter (30%)
 *   - Number of accessible shelters (15%)
 *   - Shelter diversity/spread (15%)
 */
export function computeShelterScore(
  lat: number,
  lng: number,
  shelters: Shelter[],
): ShelterScoreResult {
  const point = { lat, lng };

  // Compute distances to all shelters
  const distances = shelters.map((s) => ({
    shelter: s,
    distance: haversineDistance(point, { lat: s.lat, lng: s.lon }),
  }));

  // Shelters within the radius
  const nearby = distances.filter((d) => d.distance <= RADIUS_METERS);
  const sheltersNearby = nearby.length;

  // Nearest shelter distance and walk time
  const sorted = [...distances].sort((a, b) => a.distance - b.distance);
  const nearestDistance = sorted.length > 0 ? Math.round(sorted[0].distance) : 9999;
  const nearestWalkTimeSec = sorted.length > 0
    ? Math.round((sorted[0].distance * WALKING_OVERHEAD_FACTOR) / WALKING_SPEED_M_PER_SEC)
    : 9999;

  // Accessible shelters within radius
  const accessibleCount = nearby.filter((d) => d.shelter.isAccessible).length;

  // --- Factor 1: Shelter count (40%) ---
  // 5+ shelters = perfect score, scales linearly
  const countScore = Math.min(100, (sheltersNearby / 5) * 100);

  // --- Factor 2: Walking time to nearest (30%) ---
  // 0s = 100, 180s (3min) = 0, linear scale
  const walkScore = nearestWalkTimeSec >= 180
    ? 0
    : Math.round(100 * (1 - nearestWalkTimeSec / 180));

  // --- Factor 3: Accessible shelter count (15%) ---
  // 2+ accessible = perfect score
  const accessScore = Math.min(100, (accessibleCount / 2) * 100);

  // --- Factor 4: Diversity/spread (15%) ---
  // Measures how well-spread shelters are around the point (different directions)
  let spreadScore = 0;
  if (nearby.length >= 2) {
    // Calculate bearing quadrants occupied (N, E, S, W)
    const quadrants = new Set<number>();
    for (const d of nearby) {
      const dLat = d.shelter.lat - lat;
      const dLng = d.shelter.lon - lng;
      const angle = Math.atan2(dLng, dLat) * (180 / Math.PI);
      const normalized = ((angle % 360) + 360) % 360;
      quadrants.add(Math.floor(normalized / 90));
    }
    // 4 quadrants = 100, 3 = 75, 2 = 50, 1 = 25
    spreadScore = (quadrants.size / 4) * 100;
  } else if (nearby.length === 1) {
    spreadScore = 25;
  }

  // Weighted total
  const score = Math.round(
    countScore * 0.4 +
    walkScore * 0.3 +
    accessScore * 0.15 +
    spreadScore * 0.15
  );

  const grade = getGrade(score);

  return {
    grade,
    score,
    sheltersNearby,
    nearestDistance,
    nearestWalkTime: nearestWalkTimeSec,
    accessibleCount,
    color: GRADE_COLORS[grade],
  };
}

import type { Shelter, LatLng } from '../types';

export function haversineDistance(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinLng *
      sinLng;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function isPointNearRoute(
  point: LatLng,
  routePath: LatLng[],
  bufferMeters: number
): boolean {
  for (const pathPoint of routePath) {
    if (haversineDistance(point, pathPoint) <= bufferMeters) return true;
  }
  return false;
}

export function filterSheltersByProximity(
  shelters: Shelter[],
  routePath: LatLng[],
  bufferMeters: number
): Shelter[] {
  if (!routePath.length) return [];

  // Compute route bounds
  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;
  for (const p of routePath) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }

  // ~0.002 degrees per 200m at Israel's latitude
  const degBuffer = bufferMeters / 111000;
  const expandedMinLat = minLat - degBuffer;
  const expandedMaxLat = maxLat + degBuffer;
  const expandedMinLng = minLng - degBuffer;
  const expandedMaxLng = maxLng + degBuffer;

  return shelters.filter((shelter) => {
    const point: LatLng = { lat: shelter.lat, lng: shelter.lon };
    // Fast bounds check first
    if (
      point.lat < expandedMinLat ||
      point.lat > expandedMaxLat ||
      point.lng < expandedMinLng ||
      point.lng > expandedMaxLng
    )
      return false;
    // Then precise distance check
    return isPointNearRoute(point, routePath, bufferMeters);
  });
}

export function getDistanceToRoute(
  shelter: Shelter,
  routePath: LatLng[]
): number {
  const point: LatLng = { lat: shelter.lat, lng: shelter.lon };
  let minDistance = Infinity;

  for (const pathPoint of routePath) {
    const distance = haversineDistance(point, pathPoint);
    if (distance < minDistance) minDistance = distance;
  }

  return Math.round(minDistance);
}

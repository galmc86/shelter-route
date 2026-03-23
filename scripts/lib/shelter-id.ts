import { createHash } from 'crypto';
import type { MiklatShelter } from './shelters-schema';
import { canonicalSourceKey } from './source-keys';

const EARTH_RADIUS_METERS = 6371000;
export const EXISTING_ID_MATCH_DISTANCE_METERS = 5;

export interface ExistingShelterIndexEntry {
  id: number;
  source: string;
  lat: number;
  lng: number;
}

export interface ExistingShelterIndex {
  byCanonicalSource: Map<string, ExistingShelterIndexEntry[]>;
}

export type SeenShelterIds = Map<number, string>;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function shelterFingerprint(source: string, lat: number, lng: number): string {
  return `${canonicalSourceKey(source)}:${lat.toFixed(6)}:${lng.toFixed(6)}`;
}

export function deterministicShelterId(source: string, lat: number, lng: number): number {
  const fingerprint = shelterFingerprint(source, lat, lng);
  const digest = createHash('sha256').update(fingerprint).digest();
  const id = digest.readUInt32BE(0) & 0x7fffffff;
  return id === 0 ? 1 : id;
}

export function buildExistingShelterIndex(existingShelters: MiklatShelter[]): ExistingShelterIndex {
  const byCanonicalSource = new Map<string, ExistingShelterIndexEntry[]>();

  for (const shelter of existingShelters) {
    const key = canonicalSourceKey(shelter.source);
    const entries = byCanonicalSource.get(key) ?? [];
    entries.push({
      id: shelter.id,
      source: shelter.source,
      lat: shelter.lat,
      lng: shelter.lng,
    });
    byCanonicalSource.set(key, entries);
  }

  return { byCanonicalSource };
}

export function findExistingShelterMatch(
  source: string,
  lat: number,
  lng: number,
  index: ExistingShelterIndex,
  maxDistanceMeters: number = EXISTING_ID_MATCH_DISTANCE_METERS
): ExistingShelterIndexEntry | null {
  const candidates = index.byCanonicalSource.get(canonicalSourceKey(source)) ?? [];
  let bestMatch: ExistingShelterIndexEntry | null = null;
  let bestDistance = Infinity;

  for (const candidate of candidates) {
    const distance = haversineMeters(lat, lng, candidate.lat, candidate.lng);
    if (distance <= maxDistanceMeters && distance < bestDistance) {
      bestMatch = candidate;
      bestDistance = distance;
    }
  }

  return bestMatch;
}

export function reserveShelterId(
  id: number,
  fingerprint: string,
  seenShelterIds: SeenShelterIds
): void {
  const existingFingerprint = seenShelterIds.get(id);
  if (existingFingerprint && existingFingerprint !== fingerprint) {
    throw new Error(
      `Shelter ID collision for id=${id}: ${fingerprint} conflicts with ${existingFingerprint}`
    );
  }
  seenShelterIds.set(id, fingerprint);
}

export function resolveStableShelterId(
  source: string,
  lat: number,
  lng: number,
  existingIndex: ExistingShelterIndex,
  seenShelterIds: SeenShelterIds
): number {
  const fingerprint = shelterFingerprint(source, lat, lng);
  const existingMatch = findExistingShelterMatch(source, lat, lng, existingIndex);
  const id = existingMatch?.id ?? deterministicShelterId(source, lat, lng);
  reserveShelterId(id, fingerprint, seenShelterIds);
  return id;
}

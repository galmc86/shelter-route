import type { MiklatShelter } from './shelters-schema';
import {
  canonicalSourceKey,
  compareCanonicalSourcePriority,
  sortSourcesByPriority,
} from './source-keys';
import { haversineMeters } from './shelter-id';

const GENERIC_NAME_RE = /^Shelter\s+\d+$|^מקלט(?:\s*\d+)?$|^מקלט ציבורי$/;

export interface DedupResult {
  shelters: MiklatShelter[];
  duplicatesRemoved: number;
  crossSourceGenericMerges: number;
}

interface GridPoint {
  shelter: MiklatShelter;
}

function isGenericName(name: string): boolean {
  return GENERIC_NAME_RE.test(name.trim());
}

function cellKey(lat: number, lng: number, cellSizeDeg: number): string {
  return `${Math.floor(lat / cellSizeDeg)},${Math.floor(lng / cellSizeDeg)}`;
}

function upsertGrid(grid: Map<string, GridPoint[]>, shelter: MiklatShelter, cellSizeDeg: number): void {
  const key = cellKey(shelter.lat, shelter.lng, cellSizeDeg);
  const bucket = grid.get(key) ?? [];
  bucket.push({ shelter });
  grid.set(key, bucket);
}

function removeFromGrid(grid: Map<string, GridPoint[]>, shelter: MiklatShelter, cellSizeDeg: number): void {
  const key = cellKey(shelter.lat, shelter.lng, cellSizeDeg);
  const bucket = grid.get(key);
  if (!bucket) {
    return;
  }
  const next = bucket.filter((point) => point.shelter !== shelter);
  if (next.length === 0) {
    grid.delete(key);
    return;
  }
  grid.set(key, next);
}

function nearbyShelters(
  grid: Map<string, GridPoint[]>,
  shelter: MiklatShelter,
  cellSizeDeg: number
): MiklatShelter[] {
  const baseLat = Math.floor(shelter.lat / cellSizeDeg);
  const baseLng = Math.floor(shelter.lng / cellSizeDeg);
  const matches: MiklatShelter[] = [];

  for (let latOffset = -1; latOffset <= 1; latOffset++) {
    for (let lngOffset = -1; lngOffset <= 1; lngOffset++) {
      const bucket = grid.get(`${baseLat + latOffset},${baseLng + lngOffset}`);
      if (!bucket) {
        continue;
      }
      matches.push(...bucket.map((point) => point.shelter));
    }
  }

  return matches;
}

function chooseRepresentative(left: MiklatShelter, right: MiklatShelter): MiklatShelter {
  const sourceOrder = compareCanonicalSourcePriority(
    canonicalSourceKey(left.source),
    canonicalSourceKey(right.source)
  );
  if (sourceOrder !== 0) {
    return sourceOrder <= 0 ? left : right;
  }

  const leftGeneric = isGenericName(left.name);
  const rightGeneric = isGenericName(right.name);
  if (leftGeneric !== rightGeneric) {
    return leftGeneric ? right : left;
  }

  return left.id <= right.id ? left : right;
}

function mergeShelters(primary: MiklatShelter, secondary: MiklatShelter): MiklatShelter {
  const primaryGeneric = isGenericName(primary.name);
  const secondaryGeneric = isGenericName(secondary.name);
  const descriptiveWinner = primaryGeneric && !secondaryGeneric ? secondary : primary;

  return {
    ...primary,
    name: descriptiveWinner.name,
    description: descriptiveWinner.description || primary.description || secondary.description,
    sources: sortSourcesByPriority(
      Array.from(new Set([...primary.sources, ...secondary.sources]))
    ),
  };
}

export function deduplicateShelters(
  shelters: MiklatShelter[],
  sameSourceDistMeters: number = 10,
  crossSourceDistMeters: number = 20
): DedupResult {
  const grid = new Map<string, GridPoint[]>();
  const deduped: MiklatShelter[] = [];
  const cellSizeDeg = 0.001;
  let duplicatesRemoved = 0;
  let crossSourceGenericMerges = 0;

  for (const shelter of shelters) {
    const candidates = nearbyShelters(grid, shelter, cellSizeDeg);
    let merged = false;

    for (const candidate of candidates) {
      const sameSource =
        canonicalSourceKey(candidate.source) === canonicalSourceKey(shelter.source);
      const threshold = sameSource ? sameSourceDistMeters : crossSourceDistMeters;
      const distance = haversineMeters(
        shelter.lat,
        shelter.lng,
        candidate.lat,
        candidate.lng
      );

      if (distance > threshold) {
        continue;
      }

      const representative = chooseRepresentative(candidate, shelter);
      const other = representative === candidate ? shelter : candidate;
      const mergedShelter = mergeShelters(representative, other);

      if (!sameSource) {
        const hadGenericName = isGenericName(candidate.name) || isGenericName(shelter.name);
        const hasDescriptiveName = !isGenericName(mergedShelter.name);
        if (hadGenericName && hasDescriptiveName) {
          crossSourceGenericMerges++;
        }
      }

      removeFromGrid(grid, candidate, cellSizeDeg);
      const candidateIndex = deduped.indexOf(candidate);
      if (candidateIndex >= 0) {
        deduped[candidateIndex] = mergedShelter;
      }
      upsertGrid(grid, mergedShelter, cellSizeDeg);
      duplicatesRemoved++;
      merged = true;
      break;
    }

    if (!merged) {
      deduped.push(shelter);
      upsertGrid(grid, shelter, cellSizeDeg);
    }
  }

  return {
    shelters: deduped,
    duplicatesRemoved,
    crossSourceGenericMerges,
  };
}

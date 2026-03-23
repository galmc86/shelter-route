import fs from 'fs';
import path from 'path';
import type { MiklatShelter, SheltersJson } from './lib/shelters-schema';
import { haversineMeters } from './lib/shelter-id';
import type { TelAvivCandidateFile } from './lib/tel-aviv-arcgis';

const CURRENT_SHELTERS_PATH = path.resolve(process.cwd(), 'public/shelters.json');
const DEFAULT_CANDIDATE_PATH = path.resolve(process.cwd(), 'tmp/tel-aviv-shelters.candidate.json');

interface MatchInfo {
  shelter: MiklatShelter;
  distanceMeters: number;
}

function loadJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function telAvivSubset(shelters: MiklatShelter[]): MiklatShelter[] {
  return shelters.filter((shelter) => shelter.source.includes('miklat-tlv'));
}

function findNearestShelter(
  target: MiklatShelter,
  candidates: MiklatShelter[]
): MatchInfo | null {
  let bestMatch: MatchInfo | null = null;

  for (const candidate of candidates) {
    const distanceMeters = haversineMeters(
      target.lat,
      target.lng,
      candidate.lat,
      candidate.lng
    );
    if (!bestMatch || distanceMeters < bestMatch.distanceMeters) {
      bestMatch = { shelter: candidate, distanceMeters };
    }
  }

  return bestMatch;
}

async function main() {
  const candidatePath = process.argv[2]
    ? path.resolve(process.cwd(), process.argv[2])
    : DEFAULT_CANDIDATE_PATH;

  try {
    const current = loadJson<SheltersJson>(CURRENT_SHELTERS_PATH);
    const candidate = loadJson<TelAvivCandidateFile>(candidatePath);
    const currentTelAviv = telAvivSubset(current.shelters);

    let idReuseCount = 0;
    let within5m = 0;
    let within20m = 0;
    let within50m = 0;

    const added: Array<{ id: number; name: string; nearestMeters: number }> = [];
    const shifted: Array<{ id: number; name: string; distanceMeters: number; nearestCurrentId: number }> = [];

    for (const shelter of candidate.shelters) {
      if (currentTelAviv.some((existing) => existing.id === shelter.id)) {
        idReuseCount++;
      }

      const nearest = findNearestShelter(shelter, currentTelAviv);
      if (!nearest) {
        continue;
      }

      if (nearest.distanceMeters <= 5) {
        within5m++;
      }
      if (nearest.distanceMeters <= 20) {
        within20m++;
      }
      if (nearest.distanceMeters <= 50) {
        within50m++;
      }

      if (nearest.distanceMeters > 20) {
        added.push({
          id: shelter.id,
          name: shelter.name,
          nearestMeters: Number(nearest.distanceMeters.toFixed(1)),
        });
      } else if (nearest.distanceMeters > 1) {
        shifted.push({
          id: shelter.id,
          name: shelter.name,
          distanceMeters: Number(nearest.distanceMeters.toFixed(1)),
          nearestCurrentId: nearest.shelter.id,
        });
      }
    }

    const missing = currentTelAviv
      .map((existing) => ({
        existing,
        nearest: findNearestShelter(existing, candidate.shelters),
      }))
      .filter((entry) => !entry.nearest || entry.nearest.distanceMeters > 20)
      .map((entry) => ({
        id: entry.existing.id,
        name: entry.existing.name,
        nearestMeters: entry.nearest ? Number(entry.nearest.distanceMeters.toFixed(1)) : null,
      }));

    console.log(`Current Tel Aviv shelters: ${currentTelAviv.length}`);
    console.log(`Candidate Tel Aviv shelters: ${candidate.shelters.length}`);
    console.log(`ID reuse count: ${idReuseCount}`);
    console.log(`Spatial matches <=5m: ${within5m}`);
    console.log(`Spatial matches <=20m: ${within20m}`);
    console.log(`Spatial matches <=50m: ${within50m}`);
    console.log(`Potentially added shelters (>20m from current): ${added.length}`);
    console.log(`Potentially missing current shelters (>20m from candidate): ${missing.length}`);

    if (added.length > 0) {
      console.log(`Added sample: ${JSON.stringify(added.slice(0, 10), null, 2)}`);
    }
    if (missing.length > 0) {
      console.log(`Missing sample: ${JSON.stringify(missing.slice(0, 10), null, 2)}`);
    }
    if (shifted.length > 0) {
      console.log(`Shift sample: ${JSON.stringify(shifted.slice(0, 10), null, 2)}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`ERROR: ${message}`);
    process.exit(1);
  }
}

void main();

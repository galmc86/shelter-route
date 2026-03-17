#!/usr/bin/env node

/**
 * Offline reverse-geocode shelters using OpenStreetMap data.
 *
 * Strategy:
 * 1. Download all named streets in Israel from Overpass API (single query)
 * 2. Build a spatial grid for fast nearest-street lookup
 * 3. Assign the nearest street name to each generic shelter
 * 4. Save updated shelters.json
 *
 * Usage:
 *   node scripts/reverse-geocode-shelters.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHELTERS_PATH = resolve(__dirname, '../public/shelters.json');
const STREETS_CACHE = resolve(__dirname, 'israel-streets.json');

const GENERIC_RE = /^Shelter\s+\d+$/;

// Haversine distance in meters
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Simple spatial grid for fast nearest-point lookup
class SpatialGrid {
  constructor(cellSizeDeg = 0.005) {
    this.cellSize = cellSizeDeg; // ~500m cells
    this.grid = new Map();
  }

  _key(lat, lon) {
    return `${Math.floor(lat / this.cellSize)},${Math.floor(lon / this.cellSize)}`;
  }

  insert(point) {
    const key = this._key(point.lat, point.lon);
    if (!this.grid.has(key)) this.grid.set(key, []);
    this.grid.get(key).push(point);
  }

  findNearest(lat, lon, maxDistM = 200) {
    const cellLat = Math.floor(lat / this.cellSize);
    const cellLon = Math.floor(lon / this.cellSize);
    let best = null;
    let bestDist = Infinity;

    // Check 5x5 cells around the target
    for (let di = -2; di <= 2; di++) {
      for (let dj = -2; dj <= 2; dj++) {
        const key = `${cellLat + di},${cellLon + dj}`;
        const points = this.grid.get(key);
        if (!points) continue;
        for (const p of points) {
          const d = haversine(lat, lon, p.lat, p.lon);
          if (d < bestDist) {
            bestDist = d;
            best = p;
          }
        }
      }
    }

    return bestDist <= maxDistM ? { point: best, distance: bestDist } : null;
  }
}

async function downloadStreets() {
  if (existsSync(STREETS_CACHE)) {
    console.log('Loading cached street data...');
    return JSON.parse(readFileSync(STREETS_CACHE, 'utf-8'));
  }

  console.log('Downloading street data from Overpass API (this may take 1-2 minutes)...');

  // Query all named streets/roads in Israel with their center points
  const query = `
    [out:json][timeout:300];
    area["name:en"="Israel"]->.searchArea;
    (
      way["highway"]["name"](area.searchArea);
    );
    out center;
  `;

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!res.ok) throw new Error(`Overpass API error: HTTP ${res.status}`);

  const data = await res.json();
  console.log(`Downloaded ${data.elements.length} street segments.`);

  // Extract street points with names
  const streets = [];
  for (const el of data.elements) {
    if (!el.center || !el.tags?.name) continue;
    streets.push({
      lat: el.center.lat,
      lon: el.center.lon,
      name: el.tags.name,
      city: el.tags['addr:city'] || null,
    });
  }

  console.log(`Extracted ${streets.length} named street points.`);
  writeFileSync(STREETS_CACHE, JSON.stringify(streets));
  return streets;
}

async function main() {
  const sheltersData = JSON.parse(readFileSync(SHELTERS_PATH, 'utf-8'));
  const shelters = sheltersData.shelters;

  const needGeocoding = shelters.filter(
    (s) => GENERIC_RE.test(s.name) && !s.description?.trim()
  );
  console.log(`Total shelters: ${shelters.length}`);
  console.log(`Need geocoding: ${needGeocoding.length}`);

  // Step 1: Download streets
  const streets = await downloadStreets();

  // Step 2: Build spatial grid
  console.log('Building spatial index...');
  const grid = new SpatialGrid(0.005);
  for (const street of streets) {
    grid.insert(street);
  }
  console.log(`Grid built with ${grid.grid.size} cells.`);

  // Step 3: Match shelters to nearest streets
  console.log('Matching shelters to streets...');
  let matched = 0;
  let unmatched = 0;

  for (const shelter of needGeocoding) {
    const result = grid.findNearest(shelter.lat, shelter.lng, 500);
    if (result) {
      shelter.description = result.point.name;
      if (result.point.city) {
        shelter.city = result.point.city;
      }
      matched++;
    } else {
      unmatched++;
    }
  }

  console.log(`\nResults:`);
  console.log(`  Matched to street: ${matched}`);
  console.log(`  No street within 200m: ${unmatched}`);

  // Step 4: Save
  writeFileSync(SHELTERS_PATH, JSON.stringify(sheltersData, null, 2));
  console.log(`\nUpdated shelters.json`);
  console.log('Done! Restart the dev server to see the changes.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

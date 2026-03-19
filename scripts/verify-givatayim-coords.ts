/**
 * Verify and fix Givatayim shelter coordinates by re-geocoding via Google
 *
 * Usage: npx tsx scripts/verify-givatayim-coords.ts [--dry-run]
 *
 * Reads Givatayim shelters from shelters.json, re-geocodes each address
 * via Google Geocoding API, and fixes coordinates where the discrepancy
 * exceeds 100m.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read .env manually
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
}

const SHELTERS_JSON = path.join(__dirname, '..', 'public', 'shelters.json');
const GOOGLE_API_KEY = process.env.VITE_GOOGLE_PLACES_API_KEY || '';
const DRY_RUN = process.argv.includes('--dry-run');
const THRESHOLD_METERS = 100;

// Approximate bounding box for Givatayim
const GIVATAYIM_BOUNDS = {
  minLat: 32.055,
  maxLat: 32.085,
  minLng: 34.795,
  maxLng: 34.825,
};

function isInGivatayim(lat: number, lng: number): boolean {
  return (
    lat >= GIVATAYIM_BOUNDS.minLat &&
    lat <= GIVATAYIM_BOUNDS.maxLat &&
    lng >= GIVATAYIM_BOUNDS.minLng &&
    lng <= GIVATAYIM_BOUNDS.maxLng
  );
}

interface MiklatShelter {
  id: number;
  name: string;
  lat: number;
  lng: number;
  description: string;
  source: string;
  sources: string[];
}

interface SheltersJson {
  shelters: MiklatShelter[];
  metadata: {
    count: number;
    raw_count: number;
    duplicates_removed: number;
    generated: string;
    sources: string[];
  };
}

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Known street name corrections for better geocoding
const STREET_NAME_FIXES: Record<string, string> = {
  'בן צבי': 'שמעון בן צבי',
  'שינקין': 'שנקין גבעתיים',
};

function extractAddress(shelter: MiklatShelter): { street: string; number: string } | null {
  // Try to extract from name: "מקלט ציבורי — {street} {number}"
  const nameMatch = shelter.name.match(/מקלט ציבורי — (.+)/);
  if (nameMatch) {
    const addr = nameMatch[1].trim();
    // Split into street and number - number is usually the last part
    const parts = addr.match(/^(.+?)\s+(\d+\S*)$/);
    if (parts) {
      return { street: parts[1], number: parts[2] };
    }
    return { street: addr, number: '' };
  }

  // Try from description: "{street} {number}, גבעתיים"
  const descMatch = shelter.description.match(/^(.+?)\s+(\d+\S*),\s*גבעתיים/);
  if (descMatch) {
    return { street: descMatch[1], number: descMatch[2] };
  }

  return null;
}

async function geocodeGoogle(
  street: string,
  number: string
): Promise<{ lat: number; lng: number } | null> {
  if (!GOOGLE_API_KEY) return null;

  const address = `${street} ${number}, גבעתיים, ישראל`;
  const params = new URLSearchParams({
    address,
    key: GOOGLE_API_KEY,
    language: 'he',
    region: 'il',
  });

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${params}`
    );
    const data = await res.json();

    if (data.status === 'OK' && data.results.length > 0) {
      const loc = data.results[0].geometry.location;
      return { lat: loc.lat, lng: loc.lng };
    }

    return null;
  } catch (err) {
    console.warn(`  Google geocode error:`, err);
    return null;
  }
}

async function main() {
  if (!GOOGLE_API_KEY) {
    console.error('VITE_GOOGLE_PLACES_API_KEY not set in .env');
    process.exit(1);
  }

  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== APPLYING FIXES ===');
  console.log(`Threshold: ${THRESHOLD_METERS}m\n`);

  const sheltersData: SheltersJson = JSON.parse(
    fs.readFileSync(SHELTERS_JSON, 'utf-8')
  );

  const givatayim = sheltersData.shelters.filter(
    (s) => s.source === 'givatayim-open-shelters-2026.csv'
  );
  console.log(`Found ${givatayim.length} Givatayim shelters to verify\n`);

  let fixed = 0;
  let skipped = 0;
  let failed = 0;
  let unchanged = 0;
  const changes: Array<{
    id: number;
    name: string;
    oldLat: number;
    oldLng: number;
    newLat: number;
    newLng: number;
    distance: number;
  }> = [];

  for (const shelter of givatayim) {
    const addr = extractAddress(shelter);
    if (!addr) {
      console.log(`  [SKIP] ${shelter.name} — could not extract address`);
      skipped++;
      continue;
    }

    // Skip entries with empty/missing street name
    if (!addr.street.trim()) {
      console.log(`  [SKIP] id=${shelter.id} — no street name`);
      skipped++;
      continue;
    }

    // Apply known street name fixes
    const fixedStreet = STREET_NAME_FIXES[addr.street] || addr.street;

    process.stdout.write(`  ${fixedStreet} ${addr.number}... `);

    const coords = await geocodeGoogle(fixedStreet, addr.number);
    if (!coords) {
      console.log('FAILED (no result)');
      failed++;
      await sleep(200);
      continue;
    }

    const dist = haversineDistance(
      shelter.lat,
      shelter.lng,
      coords.lat,
      coords.lng
    );

    // Reject Google results outside Givatayim bounds
    if (!isInGivatayim(coords.lat, coords.lng)) {
      console.log(
        `REJECTED (outside Givatayim: ${coords.lat.toFixed(6)},${coords.lng.toFixed(6)})`
      );
      failed++;
      await sleep(200);
      continue;
    }

    if (dist > THRESHOLD_METERS) {
      console.log(
        `FIX needed: ${Math.round(dist)}m off ` +
          `(${shelter.lat.toFixed(6)},${shelter.lng.toFixed(6)} → ${coords.lat.toFixed(6)},${coords.lng.toFixed(6)})`
      );

      changes.push({
        id: shelter.id,
        name: shelter.name,
        oldLat: shelter.lat,
        oldLng: shelter.lng,
        newLat: coords.lat,
        newLng: coords.lng,
        distance: dist,
      });

      if (!DRY_RUN) {
        shelter.lat = coords.lat;
        shelter.lng = coords.lng;
      }
      fixed++;
    } else {
      console.log(`OK (${Math.round(dist)}m)`);
      unchanged++;
    }

    await sleep(200);
  }

  // Detect duplicate target coordinates (sign of generic/fallback geocoding)
  const coordKey = (lat: number, lng: number) =>
    `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const coordCounts = new Map<string, number>();
  for (const c of changes) {
    const key = coordKey(c.newLat, c.newLng);
    coordCounts.set(key, (coordCounts.get(key) || 0) + 1);
  }
  const duplicateCoords = new Set(
    [...coordCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([key]) => key)
  );

  if (duplicateCoords.size > 0) {
    const removed = changes.filter((c) =>
      duplicateCoords.has(coordKey(c.newLat, c.newLng))
    );
    for (const c of removed) {
      console.log(
        `  [REJECT] ${c.name}: duplicate target coords (generic fallback)`
      );
      // Revert the coordinate change
      if (!DRY_RUN) {
        const shelter = sheltersData.shelters.find((s) => s.id === c.id);
        if (shelter) {
          shelter.lat = c.oldLat;
          shelter.lng = c.oldLng;
        }
      }
      fixed--;
      failed++;
    }
    // Remove from changes list
    const validChanges = changes.filter(
      (c) => !duplicateCoords.has(coordKey(c.newLat, c.newLng))
    );
    changes.length = 0;
    changes.push(...validChanges);
  }

  console.log(`\n--- Summary ---`);
  console.log(`Total: ${givatayim.length}`);
  console.log(`Unchanged (<${THRESHOLD_METERS}m): ${unchanged}`);
  console.log(`Fixed (>${THRESHOLD_METERS}m): ${fixed}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failed}`);

  if (changes.length > 0) {
    console.log(`\n--- Changes ---`);
    for (const c of changes) {
      console.log(
        `  [${c.id}] ${c.name}: ${Math.round(c.distance)}m moved ` +
          `(${c.oldLat.toFixed(6)},${c.oldLng.toFixed(6)} → ${c.newLat.toFixed(6)},${c.newLng.toFixed(6)})`
      );
    }
  }

  if (!DRY_RUN && fixed > 0) {
    sheltersData.metadata.generated = new Date().toISOString();
    console.log(`\nWriting updated shelters.json...`);
    fs.writeFileSync(SHELTERS_JSON, JSON.stringify(sheltersData));
    console.log('Done!');
  } else if (DRY_RUN && fixed > 0) {
    console.log(`\nRe-run without --dry-run to apply fixes.`);
  }
}

main().catch(console.error);

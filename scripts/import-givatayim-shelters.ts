/**
 * Import Givatayim open shelters CSV into shelters.json
 *
 * Usage: npx tsx scripts/import-givatayim-shelters.ts
 *
 * Reads the CSV, geocodes addresses via Google (with Nominatim fallback),
 * and merges into public/shelters.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read .env manually (no dotenv dependency)
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
}

const CSV_PATH = path.join(__dirname, 'all-tabs.csv');
const SHELTERS_JSON = path.join(__dirname, '..', 'public', 'shelters.json');
const GOOGLE_API_KEY = process.env.VITE_GOOGLE_PLACES_API_KEY || '';

interface CsvRow {
  street: string;
  number: string;
  notes: string;
  contact: string;
  phone: string;
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

function parseCsv(content: string): CsvRow[] {
  const lines = content.split('\n').filter((l) => l.trim());
  // Skip header
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    // Simple CSV parse — handle quoted fields
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of lines[i]) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current.trim());

    const street = fields[0] || '';
    const number = fields[1] || '';
    const notes = fields[2] || '';
    const contact = fields[3] || '';
    const phone = fields[4] || '';

    if (!street && !number) continue;

    rows.push({ street, number, notes, contact, phone });
  }

  return rows;
}

async function geocode(
  street: string,
  number: string
): Promise<{ lat: number; lng: number } | null> {
  const query = `${street} ${number}, גבעתיים, ישראל`;
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '1',
    countrycodes: 'il',
    'accept-language': 'he',
  });

  const url = `https://nominatim.openstreetmap.org/search?${params}`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'shelter-route-import/1.0' },
    });

    if (!res.ok) {
      console.warn(`  Geocode HTTP ${res.status} for "${query}"`);
      return null;
    }

    const data = await res.json();
    if (data.length === 0) {
      // Retry without number
      if (number) {
        const retryParams = new URLSearchParams({
          q: `${street}, גבעתיים, ישראל`,
          format: 'json',
          limit: '1',
          countrycodes: 'il',
          'accept-language': 'he',
        });
        const retryRes = await fetch(
          `https://nominatim.openstreetmap.org/search?${retryParams}`,
          { headers: { 'User-Agent': 'shelter-route-import/1.0' } }
        );
        const retryData = await retryRes.json();
        if (retryData.length > 0) {
          return { lat: parseFloat(retryData[0].lat), lng: parseFloat(retryData[0].lon) };
        }
      }
      return null;
    }

    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch (err) {
    console.warn(`  Geocode error for "${query}":`, err);
    return null;
  }
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
    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
    const data = await res.json();

    if (data.status === 'OK' && data.results.length > 0) {
      const loc = data.results[0].geometry.location;
      return { lat: loc.lat, lng: loc.lng };
    }

    // Retry without number
    if (number) {
      const retryParams = new URLSearchParams({
        address: `${street}, גבעתיים, ישראל`,
        key: GOOGLE_API_KEY,
        language: 'he',
        region: 'il',
      });
      const retryRes = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${retryParams}`);
      const retryData = await retryRes.json();
      if (retryData.status === 'OK' && retryData.results.length > 0) {
        const loc = retryData.results[0].geometry.location;
        return { lat: loc.lat, lng: loc.lng };
      }
    }

    return null;
  } catch (err) {
    console.warn(`  Google geocode error for "${address}":`, err);
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Check if a new shelter is too close to an existing one (within 20m)
function isDuplicate(
  newLat: number,
  newLng: number,
  existing: MiklatShelter[]
): boolean {
  const R = 6371000; // Earth radius in meters
  for (const s of existing) {
    const dLat = ((s.lat - newLat) * Math.PI) / 180;
    const dLng = ((s.lng - newLng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((newLat * Math.PI) / 180) *
        Math.cos((s.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    if (dist < 20) return true;
  }
  return false;
}

async function main() {
  console.log('Reading CSV...');
  const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
  const rows = parseCsv(csvContent);
  console.log(`Parsed ${rows.length} rows from CSV`);

  console.log('\nReading existing shelters.json...');
  const sheltersData: SheltersJson = JSON.parse(
    fs.readFileSync(SHELTERS_JSON, 'utf-8')
  );
  const existingCount = sheltersData.shelters.length;
  console.log(`Existing shelters: ${existingCount}`);

  // Find max ID
  let maxId = 0;
  for (const s of sheltersData.shelters) {
    if (s.id > maxId) maxId = s.id;
  }

  const newShelters: MiklatShelter[] = [];
  let geocoded = 0;
  let skippedNoCoords = 0;
  let skippedDuplicate = 0;
  const source = 'givatayim-open-shelters-2026.csv';

  const geocodeProvider = GOOGLE_API_KEY ? 'Google (Nominatim fallback)' : 'Nominatim only';
  console.log(`\nGeocoding addresses via ${geocodeProvider} (1.2s delay between requests)...\n`);

  for (const row of rows) {
    const address = `${row.street} ${row.number}`.trim();
    process.stdout.write(`  ${address}... `);

    let coords: { lat: number; lng: number } | null = null;

    if (GOOGLE_API_KEY) {
      coords = await geocodeGoogle(row.street, row.number);
    }

    if (!coords) {
      process.stdout.write('(trying Nominatim) ');
      coords = await geocode(row.street, row.number);
    }

    if (!coords) {
      console.log('FAILED (no coords)');
      skippedNoCoords++;
      await sleep(GOOGLE_API_KEY ? 200 : 1200);
      continue;
    }

    // Check for duplicates against existing + new shelters
    const allShelters = [...sheltersData.shelters, ...newShelters];
    if (isDuplicate(coords.lat, coords.lng, allShelters)) {
      console.log(`DUPLICATE (${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)})`);
      skippedDuplicate++;
      await sleep(GOOGLE_API_KEY ? 200 : 1200);
      continue;
    }

    maxId++;

    // Build description from notes + contact info
    const descParts: string[] = [`${row.street} ${row.number}, גבעתיים`];
    if (row.notes) descParts.push(row.notes);
    if (row.contact && row.phone) descParts.push(`${row.contact}: ${row.phone}`);
    else if (row.phone) descParts.push(row.phone);

    const shelter: MiklatShelter = {
      id: maxId,
      name: `מקלט ציבורי — ${row.street} ${row.number}`,
      lat: coords.lat,
      lng: coords.lng,
      description: descParts.join(' | '),
      source,
      sources: [source],
    };

    newShelters.push(shelter);
    geocoded++;
    console.log(`OK (${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)})`);

    // Respect rate limits (Nominatim: 1 req/sec, Google: 50 req/sec)
    await sleep(GOOGLE_API_KEY ? 200 : 1200);
  }

  console.log(`\n--- Summary ---`);
  console.log(`Total CSV rows: ${rows.length}`);
  console.log(`Geocoded successfully: ${geocoded}`);
  console.log(`Skipped (no coords): ${skippedNoCoords}`);
  console.log(`Skipped (duplicate): ${skippedDuplicate}`);

  if (newShelters.length === 0) {
    console.log('\nNo new shelters to add.');
    return;
  }

  // Merge into shelters.json
  sheltersData.shelters.push(...newShelters);
  sheltersData.metadata.count = sheltersData.shelters.length;
  sheltersData.metadata.raw_count += newShelters.length;
  if (!sheltersData.metadata.sources.includes(source)) {
    sheltersData.metadata.sources.push(source);
  }
  sheltersData.metadata.generated = new Date().toISOString();

  console.log(`\nWriting ${sheltersData.shelters.length} shelters to shelters.json...`);
  fs.writeFileSync(SHELTERS_JSON, JSON.stringify(sheltersData));
  console.log('Done!');
}

main().catch(console.error);

import type { Shelter } from '../types';

interface MiklatShelter {
  id: number;
  name: string;
  lat: number;
  lng: number;
  description?: string;
}

const STORAGE_KEY = 'shelter-route:shelters';
const STORAGE_VERSION = 1;
const GEOCODE_CACHE_KEY = 'shelter-route:geocode-cache';
const NOMINATIM_USER_AGENT = 'ShelterRoute/1.0 (https://github.com/shelter-route)';

let cachedShelters: Shelter[] | null = null;
let reverseGeocodeInProgress = false;

function loadFromLocalStorage(): Shelter[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.version !== STORAGE_VERSION) return null;
    return parsed.data as Shelter[];
  } catch {
    return null;
  }
}

function saveToLocalStorage(shelters: Shelter[]) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: STORAGE_VERSION, data: shelters })
    );
  } catch {
    // Storage full or unavailable — ignore
  }
}

// --- Reverse-geocoding cache (localStorage) ---

interface GeocodeCache {
  [coordKey: string]: string; // coordKey "lat,lon" -> street/neighborhood name
}

function loadGeocodeCache(): GeocodeCache {
  try {
    const raw = localStorage.getItem(GEOCODE_CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as GeocodeCache;
  } catch {
    return {};
  }
}

function saveGeocodeCache(cache: GeocodeCache) {
  try {
    localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Storage full or unavailable — ignore
  }
}

function coordKey(lat: number, lon: number): string {
  return `${lat.toFixed(6)},${lon.toFixed(6)}`;
}

/**
 * Delay helper — resolves after `ms` milliseconds.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface NominatimAddress {
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  city_district?: string;
  hamlet?: string;
  village?: string;
}

interface NominatimResponse {
  address?: NominatimAddress;
}

/**
 * Extract a meaningful Hebrew location name from a Nominatim response.
 * Prefers road (street) name, then neighbourhood, then suburb/district.
 */
function extractNameFromNominatim(data: NominatimResponse): string | null {
  const addr = data.address;
  if (!addr) return null;

  if (addr.road) return addr.road;
  if (addr.neighbourhood) return addr.neighbourhood;
  if (addr.suburb) return addr.suburb;
  if (addr.city_district) return addr.city_district;
  if (addr.hamlet) return addr.hamlet;
  if (addr.village) return addr.village;

  return null;
}

/**
 * Perform a single reverse-geocode request against Nominatim.
 * Returns a street/neighborhood name or null on failure.
 */
async function reverseGeocodeSingle(
  lat: number,
  lon: number
): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=he&zoom=18`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': NOMINATIM_USER_AGENT,
      },
    });
    if (!response.ok) return null;
    const data: NominatimResponse = await response.json();
    return extractNameFromNominatim(data);
  } catch {
    return null;
  }
}

/**
 * Reverse-geocode shelters that still have a generic "מקלט ציבורי" name.
 * Batches requests with a 1.1 second delay between each to respect
 * Nominatim's rate limit (max 1 req/sec).
 *
 * Updates shelters in-place and persists to localStorage.
 * Called as a background task — does not block shelter loading.
 */
async function reverseGeocodeGenericShelters(
  shelters: Shelter[],
  onUpdate?: () => void
): Promise<void> {
  if (reverseGeocodeInProgress) return;
  reverseGeocodeInProgress = true;

  try {
    const cache = loadGeocodeCache();
    const generic = shelters.filter((s) => s.name === 'מקלט ציבורי');

    if (generic.length === 0) return;

    let cacheUpdated = false;
    let sheltersUpdated = false;

    for (const shelter of generic) {
      const key = coordKey(shelter.lat, shelter.lon);

      // Check cache first
      if (cache[key]) {
        shelter.name = `מקלט — ${cache[key]}`;
        sheltersUpdated = true;
        continue;
      }

      // Rate-limit: wait before making a network request
      await delay(1100);

      const locationName = await reverseGeocodeSingle(shelter.lat, shelter.lon);
      if (locationName) {
        cache[key] = locationName;
        cacheUpdated = true;
        shelter.name = `מקלט — ${locationName}`;
        sheltersUpdated = true;
      }
    }

    if (cacheUpdated) {
      saveGeocodeCache(cache);
    }
    if (sheltersUpdated) {
      saveToLocalStorage(shelters);
      onUpdate?.();
    }
  } finally {
    reverseGeocodeInProgress = false;
  }
}

const GENERIC_NAME_RE = /^Shelter\s+\d+$|^מקלט\s*\d*$/;

/**
 * Try to extract a short location hint from a shelter description.
 * Looks for street names (רחוב X N), school names (ביה"ס "X"), or treats
 * short descriptions (≤40 chars) as direct addresses.
 */
function extractLocationHint(description: string): string | null {
  const trimmed = description.trim();
  if (!trimmed) return null;

  // Short description is likely a direct address (e.g. "פסטלוצי 34")
  if (trimmed.length <= 40) return trimmed;

  // Try to extract a street reference: רחוב <name> <number>
  const streetMatch = trimmed.match(/רחוב\s+([\p{L}\u0590-\u05FF"'.׳\-]+(?:\s+[\p{L}\u0590-\u05FF"'.׳\-]+)*\s*\d*)/u);
  if (streetMatch) return `רח׳ ${streetMatch[1].trim()}`;

  // Try to extract a school name: ביה"ס "X" or בית הספר "X"
  const schoolMatch = trimmed.match(/(?:ביה"ס|בית\s+הספר)\s+"([^"]+)"/);
  if (schoolMatch) return `ביה"ס "${schoolMatch[1]}"`;

  return null;
}

function enrichShelterName(name: string, description?: string): string {
  if (!GENERIC_NAME_RE.test(name)) return name;

  const hint = description ? extractLocationHint(description) : null;
  if (hint) return `מקלט — ${hint}`;

  // No hint available — show clean generic name
  return 'מקלט ציבורי';
}

function parseShelters(data: MiklatShelter[]): Shelter[] {
  return data
    .filter(
      (s) =>
        !isNaN(s.lat) &&
        !isNaN(s.lng) &&
        s.lat >= 29 &&
        s.lat <= 34 &&
        s.lng >= 34 &&
        s.lng <= 36
    )
    .map((s) => ({
      id: String(s.id),
      name: enrichShelterName(s.name || 'מקלט ציבורי', s.description),
      address: s.description || undefined,
      lat: s.lat,
      lon: s.lng,
      city: '',
    }));
}

/**
 * Fetch all shelters. Returns immediately with locally enriched names.
 *
 * If `onReverseGeocodeUpdate` is provided, shelters with generic names
 * ("מקלט ציבורי") will be reverse-geocoded in the background via Nominatim.
 * The callback fires once all reverse-geocoding is done so the UI can
 * re-render with improved names.
 */
export async function fetchAllShelters(
  onReverseGeocodeUpdate?: () => void
): Promise<Shelter[]> {
  if (cachedShelters) {
    // Kick off background reverse-geocoding even for cached shelters
    // (in case previous run was interrupted or new generic shelters exist)
    reverseGeocodeGenericShelters(cachedShelters, onReverseGeocodeUpdate);
    return cachedShelters;
  }

  try {
    const response = await fetch('/shelters.json');

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const json: { shelters: MiklatShelter[] } = await response.json();
    cachedShelters = parseShelters(json.shelters);
    saveToLocalStorage(cachedShelters);

    // Start background reverse-geocoding for generic names
    reverseGeocodeGenericShelters(cachedShelters, onReverseGeocodeUpdate);

    return cachedShelters;
  } catch (err) {
    // Fallback to localStorage cache
    const cached = loadFromLocalStorage();
    if (cached && cached.length > 0) {
      cachedShelters = cached;
      return cachedShelters;
    }
    console.error('Failed to fetch shelters:', err);
    throw new Error('שגיאה בטעינת מקלטים. בדוק את חיבור האינטרנט.');
  }
}

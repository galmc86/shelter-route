import type { Shelter, ShelterKind } from '../types';
import { reportError } from './errorReportingService';
import { resilientFetch } from './fetchClient';
import { ServiceError } from './serviceResult';

interface MiklatShelter {
  id: number;
  name: string;
  lat: number;
  lng: number;
  description?: string;
  kind?: ShelterKind;
}

const STORAGE_KEY = 'shelter-route:shelters';
const STORAGE_VERSION = 2;
const GEOCODE_CACHE_KEY = 'shelter-route:geocode-cache';
const FETCHED_AT_KEY = 'shelter-route:shelters-fetched-at';
const MAX_CACHE_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

let cachedShelters: Shelter[] | null = null;
let reverseGeocodeInProgress = false;

// --- Progressive loading state ---

interface ShelterLoadingProgress {
  loaded: boolean;
  fromCache: boolean;
  progress: number; // 0-1
}

export interface ShelterDataStatus extends ShelterLoadingProgress {
  dataAgeDays: number | null;
  isStale: boolean;
}

const loadingState: ShelterLoadingProgress = {
  loaded: false,
  fromCache: false,
  progress: 0,
};

const shelterDataStatusListeners = new Set<() => void>();

let shelterDataStatusSnapshot: ShelterDataStatus = {
  loaded: false,
  fromCache: false,
  progress: 0,
  dataAgeDays: null,
  isStale: false,
};

function refreshShelterDataStatusSnapshot(): void {
  shelterDataStatusSnapshot = {
    ...loadingState,
    dataAgeDays: getShelterDataAge(),
    isStale: isShelterDataStale(),
  };
}

function notifyShelterDataStatusListeners(): void {
  refreshShelterDataStatusSnapshot();
  shelterDataStatusListeners.forEach((listener) => listener());
}

/** Returns the current shelter loading progress. */
export function getShelterLoadingProgress(): ShelterLoadingProgress {
  return { ...loadingState };
}

export function getShelterDataStatus(): ShelterDataStatus {
  return shelterDataStatusSnapshot;
}

export function subscribeShelterDataStatus(listener: () => void): () => void {
  shelterDataStatusListeners.add(listener);
  return () => {
    shelterDataStatusListeners.delete(listener);
  };
}

type SheltersUpdatedCallback = (shelters: Shelter[]) => void;
let onSheltersUpdatedCallback: SheltersUpdatedCallback | null = null;

/**
 * Register a callback that fires when fresh shelter data arrives from the
 * network after the app has already started with cached data.
 */
export function onSheltersUpdated(callback: SheltersUpdatedCallback): void {
  onSheltersUpdatedCallback = callback;
}

const STORAGE_HASH_KEY = 'shelter-route:shelters-hash';

function computeSimpleHash(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return hash.toString(36);
}

function loadStoredHash(): string | null {
  try {
    return localStorage.getItem(STORAGE_HASH_KEY);
  } catch {
    return null;
  }
}

function saveStoredHash(hash: string): void {
  try {
    localStorage.setItem(STORAGE_HASH_KEY, hash);
  } catch {
    // Storage full or unavailable — ignore
  }
}

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

function saveToLocalStorage(shelters: Shelter[], options?: { preserveFetchedAt?: boolean }) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: STORAGE_VERSION, data: shelters })
    );
    if (!options?.preserveFetchedAt) {
      localStorage.setItem(FETCHED_AT_KEY, String(Date.now()));
    }
  } catch {
    // Storage full or unavailable — ignore
  }
}

/**
 * Returns how many days old the cached shelter data is, or null if no cache timestamp exists.
 */
export function getShelterDataAge(): number | null {
  try {
    const raw = localStorage.getItem(FETCHED_AT_KEY);
    if (!raw) return null;
    const fetchedAt = Number(raw);
    if (isNaN(fetchedAt)) return null;
    const ageMs = Date.now() - fetchedAt;
    return Math.floor(ageMs / (24 * 60 * 60 * 1000));
  } catch {
    return null;
  }
}

/**
 * Returns true if the cached shelter data is older than 30 days.
 */
export function isShelterDataStale(): boolean {
  try {
    const raw = localStorage.getItem(FETCHED_AT_KEY);
    if (!raw) return false;
    const fetchedAt = Number(raw);
    if (isNaN(fetchedAt)) return false;
    return Date.now() - fetchedAt > MAX_CACHE_AGE_MS;
  } catch {
    return false;
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

interface SheltersResponse {
  shelters: MiklatShelter[];
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
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=he&zoom=18`;
  const result = await resilientFetch<NominatimResponse>(url, {}, {
    timeout: 5000,
    retries: 0,
  });

  if (!result.ok) {
    return null;
  }

  return extractNameFromNominatim(result.data);
}

/** Max network reverse-geocode requests per session to avoid Nominatim rate limits */
const MAX_GEOCODE_REQUESTS_PER_SESSION = 10;
let geocodeRequestCount = 0;

/**
 * Reverse-geocode shelters that still have a generic "מקלט ציבורי" name.
 * Batches requests with a 1.5 second delay between each to respect
 * Nominatim's rate limit (max 1 req/sec).
 *
 * Limits to MAX_GEOCODE_REQUESTS_PER_SESSION network requests per page load
 * to avoid 429 errors. Cached results are applied immediately without limits.
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

      // Check cache first — no rate limit needed
      if (cache[key]) {
        shelter.name = `מקלט — ${cache[key]}`;
        sheltersUpdated = true;
        continue;
      }

      // Stop making network requests if we've hit the per-session limit
      if (geocodeRequestCount >= MAX_GEOCODE_REQUESTS_PER_SESSION) {
        continue;
      }

      // Rate-limit: wait before making a network request
      await delay(1500);

      geocodeRequestCount++;
      const locationName = await reverseGeocodeSingle(shelter.lat, shelter.lon);
      if (locationName) {
        cache[key] = locationName;
        cacheUpdated = true;
        shelter.name = `מקלט — ${locationName}`;
        sheltersUpdated = true;
      } else {
        // Got null — likely 429 or network error. Stop requesting.
        break;
      }
    }

    if (cacheUpdated) {
      saveGeocodeCache(cache);
    }
    if (sheltersUpdated) {
      saveToLocalStorage(shelters, { preserveFetchedAt: true });
      onUpdate?.();
      notifyShelterDataStatusListeners();
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
  const streetMatch = trimmed.match(/רחוב\s+([\p{L}\u0590-\u05FF"'.׳-]+(?:\s+[\p{L}\u0590-\u05FF"'.׳-]+)*\s*\d*)/u);
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

function inferShelterKind(shelter: MiklatShelter): ShelterKind {
  if (shelter.kind) return shelter.kind;

  const haystack = `${shelter.name ?? ''} ${shelter.description ?? ''}`;

  if (haystack.includes('מיגונית')) return 'migunit';
  if (haystack.includes('מתקן מיגון קהילה')) return 'community-protection';
  if (haystack.includes('מרחב מוגן') || haystack.includes('ממ"ד') || haystack.includes('מתקן מיגון')) {
    return 'protected-space';
  }

  return 'shelter';
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
      kind: inferShelterKind(s),
    }));
}

/**
 * Fetch shelter data from the network with progress tracking.
 * Uses streaming when available to report download progress.
 */
async function fetchWithProgress(url: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new ServiceError('NETWORK', 'Failed to fetch shelters', undefined, true, err);
  }

  if (!response.ok) {
    throw new ServiceError(
      'HTTP',
      `HTTP ${response.status}: ${response.statusText}`,
      response.status,
      response.status >= 500,
    );
  }

  const contentLength = response.headers.get('content-length');
  const total = contentLength ? parseInt(contentLength, 10) : 0;

  // If we can't stream or don't know the size, fall back to simple fetch
  if (!response.body || !total) {
    const text = await response.text();
    loadingState.progress = 1;
    return text;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    loadingState.progress = Math.min(received / total, 0.99);
  }

  const decoder = new TextDecoder();
  const text = chunks.map((c) => decoder.decode(c, { stream: true })).join('') + decoder.decode();
  loadingState.progress = 1;
  return text;
}

function parseSheltersResponse(text: string): SheltersResponse {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (err) {
    throw new ServiceError('PARSE', 'Failed to parse shelter dataset JSON', undefined, false, err);
  }

  if (!json || typeof json !== 'object' || !Array.isArray((json as Partial<SheltersResponse>).shelters)) {
    throw new ServiceError('PARSE', 'Shelter dataset payload is malformed');
  }

  return json as SheltersResponse;
}

/**
 * Background fetch: downloads fresh shelter data from the network, compares
 * it against the stored hash, and if different, updates cache and notifies
 * the app via onSheltersUpdatedCallback.
 */
function backgroundRefresh(onReverseGeocodeUpdate?: () => void): void {
  fetchWithProgress(`/shelters.json?v=${__SHELTER_DATA_VERSION__}`)
    .then((text) => {
      const newHash = computeSimpleHash(text);
      const oldHash = loadStoredHash();

      const json = parseSheltersResponse(text);
      const freshShelters = parseShelters(json.shelters);

      if (newHash !== oldHash) {
        cachedShelters = freshShelters;
        saveToLocalStorage(freshShelters);
        saveStoredHash(newHash);

        // Notify the app that fresh data is available
        onSheltersUpdatedCallback?.(freshShelters);
      }

      loadingState.loaded = true;
      loadingState.fromCache = false;
      notifyShelterDataStatusListeners();

      // Start background reverse-geocoding on the latest data
      reverseGeocodeGenericShelters(
        cachedShelters || freshShelters,
        onReverseGeocodeUpdate
      );
    })
    .catch(() => {
      // Background refresh failed silently — cached data is still valid
    });
}

/**
 * Fetch all shelters. Uses a progressive loading strategy:
 *
 * 1. If data is in localStorage, returns it immediately (cache-first).
 * 2. Kicks off a background network fetch to check for updates.
 * 3. If the network version differs, updates the cache and fires
 *    the `onSheltersUpdated` callback so the UI can refresh.
 * 4. For first-time users (no cache), fetches from the network with
 *    progress tracking available via `getShelterLoadingProgress()`.
 *
 * If `onReverseGeocodeUpdate` is provided, shelters with generic names
 * ("מקלט ציבורי") will be reverse-geocoded in the background via Nominatim.
 * The callback fires once all reverse-geocoding is done so the UI can
 * re-render with improved names.
 */
export async function fetchAllShelters(
  onReverseGeocodeUpdate?: () => void
): Promise<Shelter[]> {
  // Already loaded in this session — return immediately
  if (cachedShelters) {
    reverseGeocodeGenericShelters(cachedShelters, onReverseGeocodeUpdate);
    return cachedShelters;
  }

  // Try localStorage cache first (instant load for returning users)
  const localData = loadFromLocalStorage();
  if (localData && localData.length > 0) {
    cachedShelters = localData;
    loadingState.loaded = true;
    loadingState.fromCache = true;
    loadingState.progress = 1;
    notifyShelterDataStatusListeners();

    // Start background reverse-geocoding on cached data
    reverseGeocodeGenericShelters(cachedShelters, onReverseGeocodeUpdate);

    // Refresh from network in the background
    backgroundRefresh(onReverseGeocodeUpdate);

    return cachedShelters;
  }

  // First-time user: must fetch from network (with progress tracking)
  try {
    loadingState.progress = 0;
    const text = await fetchWithProgress(
      `/shelters.json?v=${__SHELTER_DATA_VERSION__}`
    );

    const json = parseSheltersResponse(text);
    cachedShelters = parseShelters(json.shelters);

    saveToLocalStorage(cachedShelters);
    saveStoredHash(computeSimpleHash(text));

    loadingState.loaded = true;
    loadingState.fromCache = false;
    loadingState.progress = 1;
    notifyShelterDataStatusListeners();

    // Start background reverse-geocoding for generic names
    reverseGeocodeGenericShelters(cachedShelters, onReverseGeocodeUpdate);

    return cachedShelters;
  } catch (err) {
    const details = err instanceof ServiceError ? `${err.code}: ${err.message}` : String(err);
    reportError('shelter-load', 'Failed to fetch shelters', details);
    throw new Error('שגיאה בטעינת מקלטים. בדוק את חיבור האינטרנט.', {
      cause: err,
    });

  }
}

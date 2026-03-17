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

let cachedShelters: Shelter[] | null = null;

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

export async function fetchAllShelters(): Promise<Shelter[]> {
  if (cachedShelters) return cachedShelters;

  try {
    const response = await fetch('/shelters.json');

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const json: { shelters: MiklatShelter[] } = await response.json();
    cachedShelters = parseShelters(json.shelters);
    saveToLocalStorage(cachedShelters);
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

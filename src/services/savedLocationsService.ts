import type { Shelter } from '../types';

const STORAGE_KEY = 'shelter-route:saved-locations';
const STORAGE_VERSION = 1;
export const MAX_SAVED_LOCATIONS = 5;

export type SavedLocationLabel = 'home' | 'work' | 'school' | 'other';

export interface SavedLocation {
  id: string;
  name: string;
  label: SavedLocationLabel;
  lat: number;
  lng: number;
}

interface StorageData {
  version: number;
  locations: SavedLocation[];
}

function isSavedLocationLabel(value: unknown): value is SavedLocationLabel {
  return value === 'home' || value === 'work' || value === 'school' || value === 'other';
}

function sanitizeLocation(raw: unknown): SavedLocation | null {
  if (!raw || typeof raw !== 'object') return null;

  const candidate = raw as Partial<SavedLocation> & { nearestShelters?: Pick<Shelter, 'id' | 'name' | 'lat' | 'lon' | 'address'>[] };
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.name !== 'string' ||
    !isSavedLocationLabel(candidate.label) ||
    typeof candidate.lat !== 'number' ||
    typeof candidate.lng !== 'number'
  ) {
    return null;
  }

  return {
    id: candidate.id,
    name: candidate.name,
    label: candidate.label,
    lat: candidate.lat,
    lng: candidate.lng,
  };
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function getSavedLocations(): SavedLocation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: StorageData = JSON.parse(raw);
    if (parsed.version !== STORAGE_VERSION) return [];
    if (!Array.isArray(parsed.locations)) return [];
    return parsed.locations
      .map((location) => sanitizeLocation(location))
      .filter((location): location is SavedLocation => location !== null);
  } catch {
    return [];
  }
}

function persist(locations: SavedLocation[]): void {
  try {
    const data: StorageData = { version: STORAGE_VERSION, locations };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or unavailable
  }
}

export function saveLocation(
  loc: Omit<SavedLocation, 'id'>
): SavedLocation[] {
  const locations = getSavedLocations();
  if (locations.length >= MAX_SAVED_LOCATIONS) return locations;
  const newLoc: SavedLocation = { ...loc, id: generateId() };
  const updated = [...locations, newLoc];
  persist(updated);
  return updated;
}

export function removeLocation(id: string): SavedLocation[] {
  const locations = getSavedLocations();
  const updated = locations.filter((l) => l.id !== id);
  persist(updated);
  return updated;
}

export function updateLocation(
  id: string,
  updates: Partial<Omit<SavedLocation, 'id'>>
): SavedLocation[] {
  const locations = getSavedLocations();
  const updated = locations.map((l) =>
    l.id === id ? { ...l, ...updates } : l
  );
  persist(updated);
  return updated;
}

import type { LatLng, Shelter, TravelMode } from '../types';

const STORAGE_KEY = 'shelter-route:saved-locations';
const STORAGE_VERSION = 3;
export const MAX_SAVED_LOCATIONS = 5;

export type SavedLocationLabel = 'home' | 'work' | 'school' | 'other';
const SINGLETON_LABELS: SavedLocationLabel[] = ['home', 'work', 'school'];
const LABEL_ORDER: Record<SavedLocationLabel, number> = {
  home: 0,
  work: 1,
  school: 2,
  other: 3,
};

export interface SavedLocation {
  id: string;
  name: string;
  label: SavedLocationLabel;
  lat: number;
  lng: number;
  lastUsedAt?: number;
  routePreset?: SavedLocationRoutePreset;
}

export interface SavedLocationRoutePreset {
  destination: LatLng;
  destinationName: string;
  travelMode: TravelMode;
  savedAt: number;
}

interface StorageData {
  version: number;
  locations: SavedLocation[];
}

function isSavedLocationLabel(value: unknown): value is SavedLocationLabel {
  return value === 'home' || value === 'work' || value === 'school' || value === 'other';
}

function isSingletonLabel(label: SavedLocationLabel): boolean {
  return SINGLETON_LABELS.includes(label);
}

function sortSavedLocations(locations: SavedLocation[]): SavedLocation[] {
  return [...locations].sort((left, right) => {
    const labelDelta = LABEL_ORDER[left.label] - LABEL_ORDER[right.label];
    if (labelDelta !== 0) return labelDelta;

    const lastUsedDelta = (right.lastUsedAt ?? 0) - (left.lastUsedAt ?? 0);
    if (lastUsedDelta !== 0) return lastUsedDelta;

    return left.name.localeCompare(right.name);
  });
}

function dedupeSingletonLocations(locations: SavedLocation[]): SavedLocation[] {
  const byLabel = new Map<SavedLocationLabel, SavedLocation>();
  const otherLocations: SavedLocation[] = [];

  locations.forEach((location) => {
    if (!isSingletonLabel(location.label)) {
      otherLocations.push(location);
      return;
    }

    const existing = byLabel.get(location.label);
    if (!existing || (location.lastUsedAt ?? 0) >= (existing.lastUsedAt ?? 0)) {
      byLabel.set(location.label, location);
    }
  });

  return sortSavedLocations([
    ...SINGLETON_LABELS.map((label) => byLabel.get(label)).filter((location): location is SavedLocation => Boolean(location)),
    ...otherLocations,
  ]);
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
    lastUsedAt: typeof candidate.lastUsedAt === 'number' ? candidate.lastUsedAt : undefined,
    routePreset: sanitizeRoutePreset(candidate.routePreset),
  };
}

function sanitizeRoutePreset(raw: unknown): SavedLocationRoutePreset | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const candidate = raw as Partial<SavedLocationRoutePreset>;
  if (
    !candidate.destination ||
    typeof candidate.destination !== 'object' ||
    typeof candidate.destination.lat !== 'number' ||
    typeof candidate.destination.lng !== 'number' ||
    typeof candidate.destinationName !== 'string' ||
    !isTravelMode(candidate.travelMode) ||
    typeof candidate.savedAt !== 'number'
  ) {
    return undefined;
  }

  return {
    destination: {
      lat: candidate.destination.lat,
      lng: candidate.destination.lng,
    },
    destinationName: candidate.destinationName,
    travelMode: candidate.travelMode,
    savedAt: candidate.savedAt,
  };
}

function isTravelMode(value: unknown): value is TravelMode {
  return value === 'WALKING' || value === 'BICYCLING' || value === 'DRIVING';
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
    if (![1, 2, STORAGE_VERSION].includes(parsed.version)) return [];
    if (!Array.isArray(parsed.locations)) return [];
    const sanitized = dedupeSingletonLocations(parsed.locations
      .map((location) => sanitizeLocation(location))
      .filter((location): location is SavedLocation => location !== null));
    if (parsed.version !== STORAGE_VERSION) {
      persist(sanitized);
    }
    return sanitized;
  } catch {
    return [];
  }
}

function persist(locations: SavedLocation[]): void {
  try {
    const data: StorageData = { version: STORAGE_VERSION, locations: sortSavedLocations(locations) };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or unavailable
  }
}

export function saveLocation(
  loc: Omit<SavedLocation, 'id'>
): SavedLocation[] {
  const locations = getSavedLocations();
  const existingProfile = isSingletonLabel(loc.label)
    ? locations.find((location) => location.label === loc.label)
    : null;

  let updated: SavedLocation[];
  if (existingProfile) {
    updated = locations.map((location) => (
      location.id === existingProfile.id
        ? {
            ...location,
            ...loc,
            id: existingProfile.id,
            lastUsedAt: existingProfile.lastUsedAt,
          }
        : location
    ));
  } else {
    if (locations.length >= MAX_SAVED_LOCATIONS) return locations;
    const newLoc: SavedLocation = { ...loc, id: generateId() };
    updated = [...locations, newLoc];
  }

  persist(updated);
  return sortSavedLocations(updated);
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
  const current = locations.find((location) => location.id === id);
  if (!current) return locations;

  const nextLocation = { ...current, ...updates };
  const updated = dedupeSingletonLocations(locations.map((location) => (
    location.id === id ? nextLocation : location
  )));
  persist(updated);
  return updated;
}

export function touchLocation(id: string): SavedLocation[] {
  const locations = getSavedLocations();
  const touchedAt = Date.now();
  const updated = locations.map((location) => (
    location.id === id
      ? { ...location, lastUsedAt: touchedAt }
      : location
  ));
  persist(updated);
  return updated;
}

export function saveRoutePreset(
  id: string,
  routePreset: SavedLocationRoutePreset
): SavedLocation[] {
  const locations = getSavedLocations();
  const updated = locations.map((location) => (
    location.id === id
      ? {
          ...location,
          routePreset,
        }
      : location
  ));
  persist(updated);
  return updated;
}

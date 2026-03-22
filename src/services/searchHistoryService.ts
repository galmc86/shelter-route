import type { SearchHistoryEntry, SavedRouteData, LatLng, TravelMode } from '../types';

const STORAGE_KEY = 'shelter-route:search-history';
const STORAGE_VERSION = 1;
export const MAX_ENTRIES = 20;
const COORD_PRECISION = 4; // ~11m precision for dedup

interface StorageData {
  version: number;
  entries: SearchHistoryEntry[];
}

export function loadHistory(): SearchHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: StorageData = JSON.parse(raw);
    if (parsed.version !== STORAGE_VERSION) return [];
    if (!Array.isArray(parsed.entries)) return [];
    return parsed.entries;
  } catch {
    return [];
  }
}

export function saveHistory(entries: SearchHistoryEntry[]): void {
  try {
    const data: StorageData = { version: STORAGE_VERSION, entries };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or unavailable — ignore
  }
}

function roundCoord(n: number): number {
  return Math.round(n * 10 ** COORD_PRECISION) / 10 ** COORD_PRECISION;
}

export function isDuplicate(
  existing: SearchHistoryEntry,
  origin: LatLng,
  destination: LatLng,
  travelMode: TravelMode
): boolean {
  return (
    roundCoord(existing.origin.lat) === roundCoord(origin.lat) &&
    roundCoord(existing.origin.lng) === roundCoord(origin.lng) &&
    roundCoord(existing.destination.lat) === roundCoord(destination.lat) &&
    roundCoord(existing.destination.lng) === roundCoord(destination.lng) &&
    existing.travelMode === travelMode
  );
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function addToHistory(
  entries: SearchHistoryEntry[],
  newEntry: Omit<SearchHistoryEntry, 'id' | 'timestamp'>
): SearchHistoryEntry[] {
  // Check for duplicate — update timestamp and move to top
  const dupIndex = entries.findIndex((e) =>
    isDuplicate(e, newEntry.origin, newEntry.destination, newEntry.travelMode)
  );

  let updated: SearchHistoryEntry[];

  if (dupIndex !== -1) {
    const existing = entries[dupIndex];
    const refreshed: SearchHistoryEntry = {
      ...existing,
      ...newEntry,
      id: existing.id,
      timestamp: Date.now(),
    };
    updated = [refreshed, ...entries.filter((_, i) => i !== dupIndex)];
  } else {
    const entry: SearchHistoryEntry = {
      ...newEntry,
      id: generateId(),
      timestamp: Date.now(),
    };
    updated = [entry, ...entries];
  }

  // Enforce cap — evict oldest non-pinned entries
  while (updated.length > MAX_ENTRIES) {
    // Find the oldest non-pinned entry
    let oldestIdx = -1;
    let oldestTimestamp = Infinity;
    for (let i = 0; i < updated.length; i++) {
      if (!updated[i].pinned && updated[i].timestamp < oldestTimestamp) {
        oldestTimestamp = updated[i].timestamp;
        oldestIdx = i;
      }
    }
    if (oldestIdx === -1) break; // All pinned, can't evict
    updated.splice(oldestIdx, 1);
  }

  return updated;
}

export function removeFromHistory(
  entries: SearchHistoryEntry[],
  id: string
): SearchHistoryEntry[] {
  return entries.filter((e) => e.id !== id);
}

export function clearHistory(entries: SearchHistoryEntry[]): SearchHistoryEntry[] {
  // Preserve pinned entries
  return entries.filter((e) => e.pinned);
}

export function togglePin(
  entries: SearchHistoryEntry[],
  id: string
): SearchHistoryEntry[] {
  return entries.map((e) =>
    e.id === id ? { ...e, pinned: !e.pinned } : e
  );
}

export function renameEntry(
  entries: SearchHistoryEntry[],
  id: string,
  label: string
): SearchHistoryEntry[] {
  const trimmed = label.trim();
  return entries.map((e) =>
    e.id === id ? { ...e, label: trimmed || undefined } : e
  );
}

export function saveRouteData(
  entries: SearchHistoryEntry[],
  id: string,
  routeData: SavedRouteData
): SearchHistoryEntry[] {
  return entries.map((e) =>
    e.id === id ? { ...e, routeData } : e
  );
}

export function unsaveRouteData(
  entries: SearchHistoryEntry[],
  id: string
): SearchHistoryEntry[] {
  return entries.map((e) =>
    e.id === id ? { ...e, routeData: undefined } : e
  );
}

export function updateShelterCount(
  entries: SearchHistoryEntry[],
  origin: LatLng,
  destination: LatLng,
  travelMode: TravelMode,
  shelterCount: number
): SearchHistoryEntry[] {
  return entries.map((e) =>
    isDuplicate(e, origin, destination, travelMode)
      ? { ...e, shelterCount }
      : e
  );
}

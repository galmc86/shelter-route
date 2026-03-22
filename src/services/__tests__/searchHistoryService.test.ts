import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadHistory,
  saveHistory,
  isDuplicate,
  addToHistory,
  removeFromHistory,
  clearHistory,
  togglePin,
  renameEntry,
  updateShelterCount,
  saveRouteData,
  unsaveRouteData,
  MAX_ENTRIES,
} from '../searchHistoryService';
import type { SearchHistoryEntry, SavedRouteData } from '../../types';

function makeEntry(overrides: Partial<SearchHistoryEntry> = {}): SearchHistoryEntry {
  return {
    id: 'test-id',
    origin: { lat: 32.0, lng: 34.78 },
    destination: { lat: 32.1, lng: 34.79 },
    originName: 'Origin',
    destName: 'Destination',
    travelMode: 'WALKING',
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('searchHistoryService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('loadHistory', () => {
    it('returns empty array when localStorage is empty', () => {
      expect(loadHistory()).toEqual([]);
    });

    it('returns entries from localStorage', () => {
      const entries = [makeEntry()];
      localStorage.setItem(
        'shelter-route:search-history',
        JSON.stringify({ version: 1, entries })
      );
      expect(loadHistory()).toEqual(entries);
    });

    it('returns empty array for wrong version', () => {
      localStorage.setItem(
        'shelter-route:search-history',
        JSON.stringify({ version: 999, entries: [makeEntry()] })
      );
      expect(loadHistory()).toEqual([]);
    });

    it('returns empty array for corrupted JSON', () => {
      localStorage.setItem('shelter-route:search-history', 'not-json');
      expect(loadHistory()).toEqual([]);
    });

    it('returns empty array for invalid data shape', () => {
      localStorage.setItem(
        'shelter-route:search-history',
        JSON.stringify({ version: 1, entries: 'not-an-array' })
      );
      expect(loadHistory()).toEqual([]);
    });
  });

  describe('saveHistory', () => {
    it('saves entries to localStorage', () => {
      const entries = [makeEntry()];
      saveHistory(entries);
      const raw = localStorage.getItem('shelter-route:search-history');
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed.version).toBe(1);
      expect(parsed.entries).toEqual(entries);
    });

    it('handles QuotaExceededError gracefully', () => {
      const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('', 'QuotaExceededError');
      });
      expect(() => saveHistory([makeEntry()])).not.toThrow();
      spy.mockRestore();
    });
  });

  describe('isDuplicate', () => {
    it('detects duplicate with same coords and mode', () => {
      const entry = makeEntry();
      expect(isDuplicate(entry, entry.origin, entry.destination, entry.travelMode)).toBe(true);
    });

    it('detects duplicate within coordinate precision', () => {
      const entry = makeEntry({ origin: { lat: 32.00001, lng: 34.78001 } });
      // Both round to 32.0000 and 34.7800 at 4 decimal places
      expect(isDuplicate(entry, { lat: 32.00004, lng: 34.78004 }, entry.destination, 'WALKING')).toBe(true);
    });

    it('returns false for different travel mode', () => {
      const entry = makeEntry();
      expect(isDuplicate(entry, entry.origin, entry.destination, 'DRIVING')).toBe(false);
    });

    it('returns false for different destination', () => {
      const entry = makeEntry();
      expect(isDuplicate(entry, entry.origin, { lat: 33.0, lng: 35.0 }, 'WALKING')).toBe(false);
    });
  });

  describe('addToHistory', () => {
    it('adds a new entry at the beginning', () => {
      const result = addToHistory([], {
        origin: { lat: 32.0, lng: 34.78 },
        destination: { lat: 32.1, lng: 34.79 },
        originName: 'A',
        destName: 'B',
        travelMode: 'WALKING',
      });
      expect(result).toHaveLength(1);
      expect(result[0].originName).toBe('A');
      expect(result[0].id).toBeTruthy();
      expect(result[0].timestamp).toBeGreaterThan(0);
    });

    it('moves duplicate to top and updates timestamp', () => {
      const existing = makeEntry({ id: 'old', timestamp: 1000 });
      const result = addToHistory([existing], {
        origin: existing.origin,
        destination: existing.destination,
        originName: 'Updated',
        destName: existing.destName,
        travelMode: existing.travelMode,
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('old'); // Keeps original ID
      expect(result[0].timestamp).toBeGreaterThan(1000);
      expect(result[0].originName).toBe('Updated');
    });

    it('caps at MAX_ENTRIES by evicting oldest', () => {
      const entries: SearchHistoryEntry[] = Array.from({ length: MAX_ENTRIES }, (_, i) =>
        makeEntry({
          id: `id-${i}`,
          origin: { lat: 32.0 + i * 0.01, lng: 34.78 },
          timestamp: 1000 + i,
        })
      );
      const result = addToHistory(entries, {
        origin: { lat: 40.0, lng: 35.0 },
        destination: { lat: 40.1, lng: 35.1 },
        originName: 'New',
        destName: 'Place',
        travelMode: 'DRIVING',
      });
      expect(result).toHaveLength(MAX_ENTRIES);
      expect(result[0].originName).toBe('New');
      // Oldest (id-0) should be evicted
      expect(result.find((e) => e.id === 'id-0')).toBeUndefined();
    });

    it('does not evict pinned entries at capacity', () => {
      const entries: SearchHistoryEntry[] = Array.from({ length: MAX_ENTRIES }, (_, i) =>
        makeEntry({
          id: `id-${i}`,
          origin: { lat: 32.0 + i * 0.01, lng: 34.78 },
          timestamp: 1000 + i,
          pinned: i === 0, // First entry is pinned
        })
      );
      const result = addToHistory(entries, {
        origin: { lat: 40.0, lng: 35.0 },
        destination: { lat: 40.1, lng: 35.1 },
        originName: 'New',
        destName: 'Place',
        travelMode: 'DRIVING',
      });
      expect(result).toHaveLength(MAX_ENTRIES);
      // Pinned entry (id-0) should still exist
      expect(result.find((e) => e.id === 'id-0')).toBeTruthy();
      // Oldest non-pinned entry (id-1) should be evicted
      expect(result.find((e) => e.id === 'id-1')).toBeUndefined();
    });
  });

  describe('removeFromHistory', () => {
    it('removes entry by id', () => {
      const entries = [makeEntry({ id: 'a' }), makeEntry({ id: 'b' })];
      const result = removeFromHistory(entries, 'a');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('b');
    });

    it('returns same array when id not found', () => {
      const entries = [makeEntry({ id: 'a' })];
      const result = removeFromHistory(entries, 'nonexistent');
      expect(result).toHaveLength(1);
    });
  });

  describe('clearHistory', () => {
    it('removes all non-pinned entries', () => {
      const entries = [
        makeEntry({ id: 'a', pinned: true }),
        makeEntry({ id: 'b' }),
        makeEntry({ id: 'c' }),
      ];
      const result = clearHistory(entries);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('a');
    });

    it('returns empty array when no pinned entries', () => {
      const entries = [makeEntry({ id: 'a' }), makeEntry({ id: 'b' })];
      expect(clearHistory(entries)).toEqual([]);
    });
  });

  describe('togglePin', () => {
    it('pins an unpinned entry', () => {
      const entries = [makeEntry({ id: 'a', pinned: false })];
      const result = togglePin(entries, 'a');
      expect(result[0].pinned).toBe(true);
    });

    it('unpins a pinned entry', () => {
      const entries = [makeEntry({ id: 'a', pinned: true })];
      const result = togglePin(entries, 'a');
      expect(result[0].pinned).toBe(false);
    });

    it('does not affect other entries', () => {
      const entries = [makeEntry({ id: 'a' }), makeEntry({ id: 'b', pinned: true })];
      const result = togglePin(entries, 'a');
      expect(result[1].pinned).toBe(true);
    });
  });

  describe('renameEntry', () => {
    it('sets label on entry', () => {
      const entries = [makeEntry({ id: 'a' })];
      const result = renameEntry(entries, 'a', 'Home to Office');
      expect(result[0].label).toBe('Home to Office');
    });

    it('removes label when empty string', () => {
      const entries = [makeEntry({ id: 'a', label: 'Old Label' })];
      const result = renameEntry(entries, 'a', '');
      expect(result[0].label).toBeUndefined();
    });

    it('trims whitespace from label', () => {
      const entries = [makeEntry({ id: 'a' })];
      const result = renameEntry(entries, 'a', '  My Route  ');
      expect(result[0].label).toBe('My Route');
    });

    it('does not affect other entries', () => {
      const entries = [makeEntry({ id: 'a' }), makeEntry({ id: 'b' })];
      const result = renameEntry(entries, 'a', 'Renamed');
      expect(result[0].label).toBe('Renamed');
      expect(result[1].label).toBeUndefined();
    });
  });

  describe('updateShelterCount', () => {
    it('updates shelter count for matching entry', () => {
      const entries = [makeEntry({ id: 'a' })];
      const result = updateShelterCount(
        entries,
        entries[0].origin,
        entries[0].destination,
        entries[0].travelMode,
        42
      );
      expect(result[0].shelterCount).toBe(42);
    });

    it('does not update non-matching entries', () => {
      const entries = [makeEntry({ id: 'a' })];
      const result = updateShelterCount(
        entries,
        { lat: 99, lng: 99 },
        { lat: 99, lng: 99 },
        'WALKING',
        42
      );
      expect(result[0].shelterCount).toBeUndefined();
    });
  });

  describe('saveRouteData', () => {
    const routeData: SavedRouteData = {
      duration: '45 minutes',
      distance: '2.5 km',
      durationSeconds: 2700,
      distanceMeters: 2500,
      shelterCount: 12,
      savedAt: Date.now(),
    };

    it('sets routeData on matching entry', () => {
      const entries = [makeEntry({ id: 'a' })];
      const result = saveRouteData(entries, 'a', routeData);
      expect(result[0].routeData).toEqual(routeData);
    });

    it('does not affect other entries', () => {
      const entries = [makeEntry({ id: 'a' }), makeEntry({ id: 'b' })];
      const result = saveRouteData(entries, 'a', routeData);
      expect(result[0].routeData).toEqual(routeData);
      expect(result[1].routeData).toBeUndefined();
    });

    it('overwrites existing routeData', () => {
      const oldData: SavedRouteData = { ...routeData, shelterCount: 5 };
      const entries = [makeEntry({ id: 'a', routeData: oldData })];
      const result = saveRouteData(entries, 'a', routeData);
      expect(result[0].routeData?.shelterCount).toBe(12);
    });
  });

  describe('unsaveRouteData', () => {
    it('clears routeData on matching entry', () => {
      const entries = [makeEntry({ id: 'a', routeData: {
        duration: '10 min',
        distance: '500 m',
        durationSeconds: 600,
        distanceMeters: 500,
        shelterCount: 3,
        savedAt: Date.now(),
      } })];
      const result = unsaveRouteData(entries, 'a');
      expect(result[0].routeData).toBeUndefined();
    });

    it('does not affect other entries', () => {
      const rd: SavedRouteData = {
        duration: '10 min',
        distance: '500 m',
        durationSeconds: 600,
        distanceMeters: 500,
        shelterCount: 3,
        savedAt: Date.now(),
      };
      const entries = [makeEntry({ id: 'a', routeData: rd }), makeEntry({ id: 'b', routeData: rd })];
      const result = unsaveRouteData(entries, 'a');
      expect(result[0].routeData).toBeUndefined();
      expect(result[1].routeData).toEqual(rd);
    });
  });

  describe('routeData persistence', () => {
    it('saved route data survives load/save cycle', () => {
      const routeData: SavedRouteData = {
        duration: '30 min',
        distance: '1.2 km',
        durationSeconds: 1800,
        distanceMeters: 1200,
        shelterCount: 8,
        savedAt: Date.now(),
      };
      const entries = [makeEntry({ id: 'a', routeData })];
      saveHistory(entries);
      const loaded = loadHistory();
      expect(loaded[0].routeData).toEqual(routeData);
    });
  });
});

import type { Shelter } from '../types';

export interface CapacityData {
  capacity: number;
  currentOccupancy: number;
  lastUpdated: string;
}

type CapacityListener = (data: Map<string, CapacityData>) => void;

const capacityCache = new Map<string, CapacityData>();
const listeners = new Set<CapacityListener>();
let updateInterval: ReturnType<typeof setInterval> | null = null;
let initialized = false;

/**
 * Seed-based pseudo-random number generator for deterministic per-shelter values.
 * Uses a simple hash of the shelter id.
 */
function hashId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function generateCapacity(shelterId: string): CapacityData {
  const h = hashId(shelterId);
  // Deterministic base capacity between 20 and 200
  const capacity = 20 + (h % 181);
  // Random occupancy with some variance
  const occupancyPct = Math.random();
  const currentOccupancy = Math.min(
    capacity,
    Math.round(capacity * occupancyPct)
  );
  return {
    capacity,
    currentOccupancy,
    lastUpdated: new Date().toISOString(),
  };
}

function notifyListeners() {
  listeners.forEach((cb) => cb(new Map(capacityCache)));
}

/**
 * Initialize capacity simulation for a list of shelters.
 * Generates initial data and starts periodic updates.
 */
export function initCapacitySimulation(shelters: Shelter[], intervalMs = 30_000) {
  // Populate initial data
  shelters.forEach((s) => {
    if (!capacityCache.has(s.id)) {
      capacityCache.set(s.id, generateCapacity(s.id));
    }
  });

  initialized = true;
  notifyListeners();

  // Clear any existing interval
  if (updateInterval) clearInterval(updateInterval);

  // Periodically update a random subset of shelters
  updateInterval = setInterval(() => {
    const ids = Array.from(capacityCache.keys());
    // Update ~20% of shelters each tick
    const count = Math.max(1, Math.floor(ids.length * 0.2));
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * ids.length);
      const id = ids[idx];
      const existing = capacityCache.get(id);
      if (existing) {
        // Small random change in occupancy
        const delta = Math.floor(Math.random() * 11) - 5; // -5 to +5
        const newOccupancy = Math.max(
          0,
          Math.min(existing.capacity, existing.currentOccupancy + delta)
        );
        capacityCache.set(id, {
          ...existing,
          currentOccupancy: newOccupancy,
          lastUpdated: new Date().toISOString(),
        });
      }
    }
    notifyListeners();
  }, intervalMs);
}

/**
 * Stop the capacity simulation.
 */
export function stopCapacitySimulation() {
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
}

/**
 * Subscribe to capacity data changes. Returns an unsubscribe function.
 */
export function subscribeCapacity(listener: CapacityListener): () => void {
  listeners.add(listener);
  // Send current data immediately if available
  if (initialized) {
    listener(new Map(capacityCache));
  }
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Get capacity data for a single shelter. Returns undefined if unknown.
 */
export function getCapacityForShelter(shelterId: string): CapacityData | undefined {
  return capacityCache.get(shelterId);
}

/**
 * Get current snapshot of all capacity data.
 */
export function getAllCapacityData(): Map<string, CapacityData> {
  return new Map(capacityCache);
}

/**
 * Get occupancy percentage (0-100). Returns undefined if no data.
 */
export function getOccupancyPercent(shelterId: string): number | undefined {
  const data = capacityCache.get(shelterId);
  if (!data || data.capacity === 0) return undefined;
  return Math.round((data.currentOccupancy / data.capacity) * 100);
}

/**
 * Get color for a given occupancy percentage.
 * green < 50%, yellow 50-80%, red > 80%
 */
export function getCapacityColor(percent: number | undefined): string {
  if (percent === undefined) return '#9E9E9E'; // grey for unknown
  if (percent < 50) return '#4CAF50'; // green
  if (percent <= 80) return '#FF9800'; // yellow/orange
  return '#F44336'; // red
}

/**
 * Get capacity status key for translations.
 */
export function getCapacityStatusKey(percent: number | undefined): 'capacity.low' | 'capacity.medium' | 'capacity.high' | 'capacity.unknown' {
  if (percent === undefined) return 'capacity.unknown';
  if (percent < 50) return 'capacity.low';
  if (percent <= 80) return 'capacity.medium';
  return 'capacity.high';
}

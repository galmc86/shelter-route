import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  initCapacitySimulation,
  stopCapacitySimulation,
  subscribeCapacity,
  getCapacityForShelter,
  getAllCapacityData,
  getOccupancyPercent,
  getCapacityColor,
  getCapacityStatusKey,
} from '../capacityService';
import type { Shelter } from '../../types';

function makeShelter(id: string): Shelter {
  return {
    id,
    name: `Shelter ${id}`,
    lat: 32.0,
    lon: 34.0,
    city: 'Test',
  };
}

describe('getCapacityColor', () => {
  it('returns green for 0%', () => {
    expect(getCapacityColor(0)).toBe('#4CAF50');
  });

  it('returns green for 49%', () => {
    expect(getCapacityColor(49)).toBe('#4CAF50');
  });

  it('returns orange for 50%', () => {
    expect(getCapacityColor(50)).toBe('#FF9800');
  });

  it('returns orange for 79%', () => {
    expect(getCapacityColor(79)).toBe('#FF9800');
  });

  it('returns orange for 80%', () => {
    expect(getCapacityColor(80)).toBe('#FF9800');
  });

  it('returns red for 81%', () => {
    expect(getCapacityColor(81)).toBe('#F44336');
  });

  it('returns red for 100%', () => {
    expect(getCapacityColor(100)).toBe('#F44336');
  });

  it('returns gray for undefined', () => {
    expect(getCapacityColor(undefined)).toBe('#9E9E9E');
  });
});

describe('getCapacityStatusKey', () => {
  it('returns capacity.low for 0%', () => {
    expect(getCapacityStatusKey(0)).toBe('capacity.low');
  });

  it('returns capacity.low for 49%', () => {
    expect(getCapacityStatusKey(49)).toBe('capacity.low');
  });

  it('returns capacity.medium for 50%', () => {
    expect(getCapacityStatusKey(50)).toBe('capacity.medium');
  });

  it('returns capacity.medium for 80%', () => {
    expect(getCapacityStatusKey(80)).toBe('capacity.medium');
  });

  it('returns capacity.high for 81%', () => {
    expect(getCapacityStatusKey(81)).toBe('capacity.high');
  });

  it('returns capacity.high for 100%', () => {
    expect(getCapacityStatusKey(100)).toBe('capacity.high');
  });

  it('returns capacity.unknown for undefined', () => {
    expect(getCapacityStatusKey(undefined)).toBe('capacity.unknown');
  });
});

describe('initCapacitySimulation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stopCapacitySimulation();
  });

  afterEach(() => {
    stopCapacitySimulation();
    vi.useRealTimers();
  });

  it('generates capacity data for provided shelters', () => {
    const shelters = [makeShelter('s1'), makeShelter('s2')];
    initCapacitySimulation(shelters, 60000);

    const data = getAllCapacityData();
    expect(data.size).toBe(2);
    expect(data.has('s1')).toBe(true);
    expect(data.has('s2')).toBe(true);

    const s1 = data.get('s1')!;
    expect(s1.capacity).toBeGreaterThanOrEqual(20);
    expect(s1.capacity).toBeLessThanOrEqual(200);
    expect(s1.currentOccupancy).toBeGreaterThanOrEqual(0);
    expect(s1.currentOccupancy).toBeLessThanOrEqual(s1.capacity);
    expect(s1.lastUpdated).toBeTruthy();
  });

  it('produces deterministic capacity based on shelter ID hash', () => {
    const shelters = [makeShelter('abc')];
    initCapacitySimulation(shelters, 60000);
    const cap1 = getCapacityForShelter('abc')!.capacity;

    // Re-init should keep same capacity (already cached)
    initCapacitySimulation(shelters, 60000);
    const cap2 = getCapacityForShelter('abc')!.capacity;

    expect(cap1).toBe(cap2);
  });
});

describe('subscribeCapacity', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stopCapacitySimulation();
  });

  afterEach(() => {
    stopCapacitySimulation();
    vi.useRealTimers();
  });

  it('notifies listener immediately with current data after init', () => {
    const shelters = [makeShelter('s1')];
    initCapacitySimulation(shelters, 60000);

    const listener = vi.fn();
    subscribeCapacity(listener);

    expect(listener).toHaveBeenCalledTimes(1);
    const data = listener.mock.calls[0][0];
    expect(data).toBeInstanceOf(Map);
    expect(data.has('s1')).toBe(true);
  });

  it('returns an unsubscribe function that stops notifications', () => {
    const shelters = [makeShelter('s1')];
    initCapacitySimulation(shelters, 60000);

    const listener = vi.fn();
    const unsubscribe = subscribeCapacity(listener);

    // Clear initial call count
    listener.mockClear();

    unsubscribe();

    // Advance timer to trigger update
    vi.advanceTimersByTime(60000);

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('getCapacityForShelter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stopCapacitySimulation();
  });

  afterEach(() => {
    stopCapacitySimulation();
    vi.useRealTimers();
  });

  it('returns undefined for unknown shelter', () => {
    expect(getCapacityForShelter('nonexistent')).toBeUndefined();
  });

  it('returns capacity data for initialized shelter', () => {
    initCapacitySimulation([makeShelter('test-id')], 60000);
    const data = getCapacityForShelter('test-id');
    expect(data).toBeDefined();
    expect(data!.capacity).toBeGreaterThanOrEqual(20);
  });
});

describe('getOccupancyPercent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stopCapacitySimulation();
  });

  afterEach(() => {
    stopCapacitySimulation();
    vi.useRealTimers();
  });

  it('returns undefined for unknown shelter', () => {
    expect(getOccupancyPercent('nonexistent')).toBeUndefined();
  });

  it('returns a percentage between 0 and 100 for initialized shelter', () => {
    initCapacitySimulation([makeShelter('pct-test')], 60000);
    const pct = getOccupancyPercent('pct-test');
    expect(pct).toBeDefined();
    expect(pct!).toBeGreaterThanOrEqual(0);
    expect(pct!).toBeLessThanOrEqual(100);
  });
});

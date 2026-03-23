import { describe, expect, it } from 'vitest';
import {
  buildExistingShelterIndex,
  deterministicShelterId,
  EXISTING_ID_MATCH_DISTANCE_METERS,
  findExistingShelterMatch,
  reserveShelterId,
  resolveStableShelterId,
} from './shelter-id';
import type { MiklatShelter } from './shelters-schema';

function makeShelter(overrides: Partial<MiklatShelter> = {}): MiklatShelter {
  return {
    id: 101,
    name: 'Shelter 1',
    lat: 32.0853,
    lng: 34.7818,
    description: 'תל אביב',
    source: 'miklat-isr-2026-03-06.kmz',
    sources: ['miklat-isr-2026-03-06.kmz'],
    ...overrides,
  };
}

describe('shelter-id', () => {
  it('reuses an existing shelter id on exact same-source match', () => {
    const existingIndex = buildExistingShelterIndex([makeShelter({ id: 777 })]);
    const seenShelterIds = new Map<number, string>();

    const id = resolveStableShelterId(
      'miklat-isr-2026-04-01.kmz',
      32.0853,
      34.7818,
      existingIndex,
      seenShelterIds
    );

    expect(id).toBe(777);
  });

  it('reuses an existing shelter id for a near same-source coordinate match', () => {
    const existingIndex = buildExistingShelterIndex([makeShelter({ id: 555 })]);
    const seenShelterIds = new Map<number, string>();

    const match = findExistingShelterMatch(
      'miklat-isr-2026-04-01.kmz',
      32.08531,
      34.78181,
      existingIndex
    );

    expect(match?.id).toBe(555);
    expect(
      resolveStableShelterId(
        'miklat-isr-2026-04-01.kmz',
        32.08531,
        34.78181,
        existingIndex,
        seenShelterIds
      )
    ).toBe(555);
  });

  it('does not reuse existing ids outside the same-source distance window', () => {
    const existingIndex = buildExistingShelterIndex([makeShelter({ id: 333 })]);
    const farLat = 32.0853 + (EXISTING_ID_MATCH_DISTANCE_METERS + 3) / 111111;

    expect(
      findExistingShelterMatch(
        'miklat-isr-2026-04-01.kmz',
        farLat,
        34.7818,
        existingIndex
      )
    ).toBeNull();
  });

  it('uses deterministic fallback ids when no existing match exists', () => {
    const existingIndex = buildExistingShelterIndex([]);
    const seenShelterIds = new Map<number, string>();

    const first = resolveStableShelterId(
      'miklat-tlv-2026-03-06.kmz',
      32.0853,
      34.7818,
      existingIndex,
      seenShelterIds
    );
    const second = deterministicShelterId(
      'miklat-tlv-2026-03-07.kmz',
      32.0853,
      34.7818
    );

    expect(first).toBe(second);
  });

  it('produces different deterministic ids for different canonical sources', () => {
    expect(
      deterministicShelterId('miklat-isr-2026-03-06.kmz', 32.0853, 34.7818)
    ).not.toBe(
      deterministicShelterId('miklat-tlv-2026-03-06.kmz', 32.0853, 34.7818)
    );
  });

  it('produces a positive 32-bit integer id', () => {
    const id = deterministicShelterId('miklat-isr-2026-03-06.kmz', 32.0853, 34.7818);

    expect(Number.isInteger(id)).toBe(true);
    expect(id).toBeGreaterThan(0);
    expect(id).toBeLessThanOrEqual(0x7fffffff);
  });

  it('treats coordinates that only differ beyond 6 decimal places as the same fallback id', () => {
    expect(
      deterministicShelterId('miklat-isr-2026-03-06.kmz', 32.0853001, 34.7818001)
    ).toBe(
      deterministicShelterId('miklat-isr-2026-03-06.kmz', 32.0853004, 34.7818004)
    );
  });

  it('throws loudly on shelter id collisions', () => {
    const seenShelterIds = new Map<number, string>();

    reserveShelterId(1234, 'miklat-isr:32.085300:34.781800', seenShelterIds);

    expect(() =>
      reserveShelterId(1234, 'miklat-isr:32.085301:34.781801', seenShelterIds)
    ).toThrow('Shelter ID collision');
  });
});

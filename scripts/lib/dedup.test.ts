import { describe, expect, it } from 'vitest';
import { deduplicateShelters } from './dedup';
import type { MiklatShelter } from './shelters-schema';

function makeShelter(overrides: Partial<MiklatShelter> = {}): MiklatShelter {
  return {
    id: 1,
    name: 'Shelter 1',
    lat: 32.0853,
    lng: 34.7818,
    description: 'Desc',
    source: 'miklat-isr-2026-03-06.kmz',
    sources: ['miklat-isr-2026-03-06.kmz'],
    ...overrides,
  };
}

describe('dedup', () => {
  it('removes same-source duplicates within 10 meters', () => {
    const result = deduplicateShelters([
      makeShelter({ id: 1, lat: 32.0853, lng: 34.7818 }),
      makeShelter({ id: 2, lat: 32.08533, lng: 34.7818 }),
    ]);

    expect(result.shelters).toHaveLength(1);
    expect(result.duplicatesRemoved).toBe(1);
  });

  it('keeps same-source shelters outside the 10 meter threshold', () => {
    const result = deduplicateShelters([
      makeShelter({ id: 1, lat: 32.0853, lng: 34.7818 }),
      makeShelter({ id: 2, lat: 32.08544, lng: 34.7818 }),
    ]);

    expect(result.shelters).toHaveLength(2);
    expect(result.duplicatesRemoved).toBe(0);
  });

  it('merges cross-source shelters within 20 meters and combines sources', () => {
    const result = deduplicateShelters([
      makeShelter({
        id: 1,
        name: 'Shelter 1',
        source: 'miklat-tlv-2026-03-06.kmz',
        sources: ['miklat-tlv-2026-03-06.kmz'],
      }),
      makeShelter({
        id: 2,
        name: 'Descriptive Shelter',
        lat: 32.08539,
        source: 'miklat-isr-2026-03-06.kmz',
        sources: ['miklat-isr-2026-03-06.kmz'],
      }),
    ]);

    expect(result.shelters).toHaveLength(1);
    expect(result.shelters[0].sources).toEqual([
      'miklat-isr-2026-03-06.kmz',
      'miklat-tlv-2026-03-06.kmz',
    ]);
    expect(result.duplicatesRemoved).toBe(1);
  });

  it('keeps cross-source shelters outside the 20 meter threshold', () => {
    const result = deduplicateShelters([
      makeShelter({
        id: 1,
        source: 'miklat-isr-2026-03-06.kmz',
      }),
      makeShelter({
        id: 2,
        lat: 32.0856,
        source: 'miklat-tlv-2026-03-06.kmz',
      }),
    ]);

    expect(result.shelters).toHaveLength(2);
  });

  it('uses explicit source priority when choosing the representative id', () => {
    const result = deduplicateShelters([
      makeShelter({
        id: 200,
        source: 'miklat-tlv-2026-03-06.kmz',
        sources: ['miklat-tlv-2026-03-06.kmz'],
      }),
      makeShelter({
        id: 100,
        lat: 32.08539,
        source: 'miklat-isr-2026-03-06.kmz',
        sources: ['miklat-isr-2026-03-06.kmz'],
      }),
    ]);

    expect(result.shelters).toHaveLength(1);
    expect(result.shelters[0].id).toBe(100);
    expect(result.shelters[0].source).toBe('miklat-isr-2026-03-06.kmz');
  });

  it('prefers descriptive names over generic ones during merge', () => {
    const result = deduplicateShelters([
      makeShelter({
        id: 1,
        name: 'Shelter 1',
        source: 'miklat-isr-2026-03-06.kmz',
      }),
      makeShelter({
        id: 2,
        name: 'בית ספר אלון',
        lat: 32.08539,
        source: 'miklat-tlv-2026-03-06.kmz',
      }),
    ]);

    expect(result.shelters).toHaveLength(1);
    expect(result.shelters[0].name).toBe('בית ספר אלון');
    expect(result.crossSourceGenericMerges).toBe(1);
  });

  it('returns empty output for empty input', () => {
    expect(deduplicateShelters([])).toEqual({
      shelters: [],
      duplicatesRemoved: 0,
      crossSourceGenericMerges: 0,
    });
  });
});

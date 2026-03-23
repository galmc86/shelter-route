import { describe, expect, it } from 'vitest';
import { buildExistingShelterIndex } from './shelter-id';
import { normalizeTelAvivFeature, TEL_AVIV_ARCGIS_SOURCE } from './tel-aviv-arcgis';
import type { MiklatShelter } from './shelters-schema';

function makeExistingShelter(overrides: Partial<MiklatShelter> = {}): MiklatShelter {
  return {
    id: 390,
    name: 'מקלט ציבורי נגיש',
    lat: 32.0432456,
    lng: 34.7512182,
    description: 'יפת 120',
    source: 'miklat-tlv-2026-03-06.kmz',
    sources: ['miklat-isr-2026-03-06.kmz', 'miklat-tlv-2026-03-06.kmz'],
    ...overrides,
  };
}

describe('tel-aviv-arcgis', () => {
  it('normalizes ArcGIS features into shelter records and reuses existing ids', () => {
    const existingIndex = buildExistingShelterIndex([makeExistingShelter()]);
    const seen = new Map<number, string>();

    const shelter = normalizeTelAvivFeature({
      attributes: {
        t_sug: 'מקלט ציבורי נגיש',
        Full_Address: 'יפת 120',
        lat: 32.0432457,
        lon: 34.7512181,
      },
    }, existingIndex, seen);

    expect(shelter).toEqual({
      id: 390,
      name: 'מקלט ציבורי נגיש',
      lat: 32.0432457,
      lng: 34.7512181,
      description: 'יפת 120',
      source: TEL_AVIV_ARCGIS_SOURCE,
      sources: [TEL_AVIV_ARCGIS_SOURCE],
    });
  });

  it('skips features without valid coordinates', () => {
    const existingIndex = buildExistingShelterIndex([]);
    const seen = new Map<number, string>();

    expect(normalizeTelAvivFeature({
      attributes: {
        t_sug: 'מקלט ציבורי',
        lat: null,
        lon: 34.7,
      },
    }, existingIndex, seen)).toBeNull();
  });
});

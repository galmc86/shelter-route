import { describe, expect, it } from 'vitest';
import { reconcileTelAvivShelters, TEL_AVIV_RECONCILED_SOURCE } from './tel-aviv-reconcile';
import type { MiklatShelter, SheltersJson } from './shelters-schema';

function makeShelter(overrides: Partial<MiklatShelter> = {}): MiklatShelter {
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

function makeDataset(shelters: MiklatShelter[]): SheltersJson {
  return {
    shelters,
    metadata: {
      count: shelters.length,
      raw_count: shelters.length,
      duplicates_removed: 0,
      cross_source_generic_merges: 0,
      dedupe_distance_meters: 10,
      dedupe_cross_source_distance_meters: 20,
      generated: '2026-03-23T00:00:00.000Z',
      sources: ['miklat-isr-2026-03-06.kmz', 'miklat-tlv-2026-03-06.kmz'],
      totalShelters: shelters.length,
    },
  };
}

describe('tel-aviv-reconcile', () => {
  it('promotes high-confidence matches with the existing id', () => {
    const current = makeShelter();
    const candidate = makeShelter({
      id: 999,
      lat: 32.043255,
      lng: 34.751225,
      source: 'tel-aviv-arcgis',
      sources: ['tel-aviv-arcgis'],
    });

    const result = reconcileTelAvivShelters(makeDataset([current]), [candidate]);

    expect(result.report.safeMoveCount).toBe(1);
    expect(result.report.safeEnrichCount).toBe(0);
    expect(result.report.promotedCount).toBe(1);
    expect(result.report.ambiguousCount).toBe(0);
    expect(result.candidateDataset.shelters[0]).toEqual({
      id: 390,
      name: candidate.name,
      lat: candidate.lat,
      lng: candidate.lng,
      description: current.description,
      source: current.source,
      sources: [
        'miklat-isr-2026-03-06.kmz',
        'miklat-tlv-2026-03-06.kmz',
        'tel-aviv-arcgis',
        TEL_AVIV_RECONCILED_SOURCE,
      ],
    });
  });

  it('enriches high-confidence matches without moving coordinates when the distance is larger', () => {
    const current = makeShelter();
    const candidate = makeShelter({
      id: 999,
      lat: 32.04342,
      lng: 34.75137,
      description: 'יפת 120 תל אביב',
      source: 'tel-aviv-arcgis',
      sources: ['tel-aviv-arcgis'],
    });

    const result = reconcileTelAvivShelters(makeDataset([current]), [candidate]);

    expect(result.report.safeMoveCount).toBe(0);
    expect(result.report.safeEnrichCount).toBe(1);
    expect(result.candidateDataset.shelters[0]).toEqual({
      ...current,
      description: 'יפת 120 תל אביב',
      sources: [
        'miklat-isr-2026-03-06.kmz',
        'miklat-tlv-2026-03-06.kmz',
        'tel-aviv-arcgis',
        TEL_AVIV_RECONCILED_SOURCE,
      ],
    });
  });

  it('keeps medium-confidence matches in the review bucket and leaves the current shelter unchanged', () => {
    const current = makeShelter();
    const candidate = makeShelter({
      id: 999,
      lat: 32.04287759,
      lng: 34.75052125,
      description: 'הלוטוס 12',
      source: 'tel-aviv-arcgis',
      sources: ['tel-aviv-arcgis'],
    });

    const result = reconcileTelAvivShelters(makeDataset([current]), [candidate]);

    expect(result.report.promotedCount).toBe(0);
    expect(result.report.safeMoveCount).toBe(0);
    expect(result.report.safeEnrichCount).toBe(0);
    expect(result.report.ambiguousCount).toBe(1);
    expect(result.report.candidateOnlyCount).toBe(0);
    expect(result.candidateDataset.shelters[0]).toEqual(current);
  });

  it('promotes exact-name address-style matches as safe enrichments without moving coordinates', () => {
    const current = makeShelter({
      description: 'המקלט נמצא מול בית מספר 12 ברחבה הציבורית. ניתן להגיע גם דרך רחוב יפת 120.',
    });
    const candidate = makeShelter({
      id: 999,
      lat: 32.04287759,
      lng: 34.75052125,
      description: 'הלוטוס 12',
      source: 'tel-aviv-arcgis',
      sources: ['tel-aviv-arcgis'],
    });

    const result = reconcileTelAvivShelters(makeDataset([current]), [candidate]);

    expect(result.report.safeEnrichCount).toBe(1);
    expect(result.report.safeMoveCount).toBe(0);
    expect(result.report.ambiguousCount).toBe(0);
    expect(result.candidateDataset.shelters[0]).toEqual({
      ...current,
      sources: [
        'miklat-isr-2026-03-06.kmz',
        'miklat-tlv-2026-03-06.kmz',
        'tel-aviv-arcgis',
        TEL_AVIV_RECONCILED_SOURCE,
      ],
    });
  });

  it('promotes school-site matches with exact address overlap as safe enrichments', () => {
    const current = makeShelter({
      id: 2040,
      name: 'מקלט פנימי בשטח בית ספר',
      lat: 32.0465021,
      lng: 34.7575232,
      description: 'פסטלוצי 34',
    });
    const candidate = makeShelter({
      id: 999,
      name: "בית ספר אג'יאל",
      lat: 32.04668856,
      lng: 34.75712409,
      description: 'פסטלוצי 34',
      source: 'tel-aviv-arcgis',
      sources: ['tel-aviv-arcgis'],
    });

    const result = reconcileTelAvivShelters(makeDataset([current]), [candidate]);

    expect(result.report.safeEnrichCount).toBe(1);
    expect(result.report.safeMoveCount).toBe(0);
    expect(result.report.ambiguousCount).toBe(0);
    expect(result.candidateDataset.shelters[0]).toEqual({
      ...current,
      sources: [
        'miklat-isr-2026-03-06.kmz',
        'miklat-tlv-2026-03-06.kmz',
        'tel-aviv-arcgis',
        TEL_AVIV_RECONCILED_SOURCE,
      ],
    });
  });

  it('promotes school-site matches when the quoted school name matches the ArcGIS school name', () => {
    const current = makeShelter({
      id: 5562,
      name: 'מקלט ציבורי במוסדות חינוך',
      lat: 32.115895,
      lng: 34.8381995,
      description: 'המקלט נמצא בשטח ביה"ס "הגליל", כניסה מהשער הראשי ואז ימינה וישר עד למקלט.',
    });
    const candidate = makeShelter({
      id: 999,
      name: 'בית ספר הגליל',
      lat: 32.115528,
      lng: 34.83750205,
      description: 'גבעתי 4',
      source: 'tel-aviv-arcgis',
      sources: ['tel-aviv-arcgis'],
    });

    const result = reconcileTelAvivShelters(makeDataset([current]), [candidate]);

    expect(result.report.safeEnrichCount).toBe(1);
    expect(result.report.safeMoveCount).toBe(0);
    expect(result.report.ambiguousCount).toBe(0);
  });

  it('promotes parking/refuge matches when the address matches exactly', () => {
    const current = makeShelter({
      id: 19980,
      name: 'חניון מחסה לציבור',
      lat: 32.061,
      lng: 34.771,
      description: 'אחד העם 9',
    });
    const candidate = makeShelter({
      id: 999,
      name: 'בית הרכב מגדל שלום',
      lat: 32.0606,
      lng: 34.7704,
      description: 'אחד העם 9',
      source: 'tel-aviv-arcgis',
      sources: ['tel-aviv-arcgis'],
    });

    const result = reconcileTelAvivShelters(makeDataset([current]), [candidate]);

    expect(result.report.safeEnrichCount).toBe(1);
    expect(result.report.safeMoveCount).toBe(0);
    expect(result.report.ambiguousCount).toBe(0);
  });

  it('reports unmatched candidate shelters without adding them automatically', () => {
    const current = makeShelter();
    const candidate = makeShelter({
      id: 999,
      name: 'בית ספר איתמר בן אב"י',
      lat: 32.171,
      lng: 34.88,
      description: 'קהילת קנדה 13',
      source: 'tel-aviv-arcgis',
      sources: ['tel-aviv-arcgis'],
    });

    const result = reconcileTelAvivShelters(makeDataset([current]), [candidate]);

    expect(result.report.promotedCount).toBe(0);
    expect(result.report.currentOnlyCount).toBe(1);
    expect(result.report.candidateOnlyCount).toBe(1);
    expect(result.candidateDataset.shelters).toEqual([current]);
  });
});

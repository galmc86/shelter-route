import { describe, expect, it } from 'vitest';
import {
  CANONICAL_SOURCE_PRIORITY,
  canonicalSourceKey,
  compareCanonicalSourcePriority,
  isKmzSource,
  sortSourcesByPriority,
  stripSourceExtension,
} from './source-keys';

describe('source-keys', () => {
  it('strips source extensions before canonicalization', () => {
    expect(stripSourceExtension('data/miklat-isr-2026-03-06.kmz')).toBe('miklat-isr-2026-03-06');
    expect(stripSourceExtension('givatayim-open-shelters-2026.csv')).toBe('givatayim-open-shelters-2026');
  });

  it('maps dated KMZ variants to stable canonical keys', () => {
    expect(canonicalSourceKey('miklat-isr-2026-03-06.kmz')).toBe('miklat-isr');
    expect(canonicalSourceKey('/tmp/miklat-tlv-2025-12-31.kmz')).toBe('miklat-tlv');
  });

  it('leaves unknown sources stable after removing extension', () => {
    expect(canonicalSourceKey('custom-source-v2.kmz')).toBe('custom-source-v2');
    expect(canonicalSourceKey('nested/foo.csv')).toBe('foo');
  });

  it('detects KMZ sources by extension', () => {
    expect(isKmzSource('miklat-isr-2026-03-06.kmz')).toBe(true);
    expect(isKmzSource('MIKLAT-TLV.KMZ')).toBe(true);
    expect(isKmzSource('givatayim-open-shelters-2026.csv')).toBe(false);
  });

  it('uses the explicit canonical priority table before lexical fallback', () => {
    expect(CANONICAL_SOURCE_PRIORITY).toEqual([
      'miklat-isr',
      'miklat-tlv',
      'givatayim-open-shelters',
    ]);
    expect(compareCanonicalSourcePriority('miklat-isr', 'miklat-tlv')).toBeLessThan(0);
    expect(compareCanonicalSourcePriority('miklat-tlv', 'givatayim-open-shelters')).toBeLessThan(0);
    expect(compareCanonicalSourcePriority('unknown-b', 'unknown-a')).toBeGreaterThan(0);
  });

  it('sorts concrete source filenames by canonical priority and then lexical name', () => {
    expect(
      sortSourcesByPriority([
        'givatayim-open-shelters-2026.csv',
        'miklat-tlv-2026-03-06.kmz',
        'miklat-isr-2026-03-06.kmz',
        'unknown-b.kmz',
        'unknown-a.kmz',
      ])
    ).toEqual([
      'miklat-isr-2026-03-06.kmz',
      'miklat-tlv-2026-03-06.kmz',
      'givatayim-open-shelters-2026.csv',
      'unknown-a.kmz',
      'unknown-b.kmz',
    ]);
  });
});

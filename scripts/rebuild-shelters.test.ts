import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runRebuildShelters } from './rebuild-shelters';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'shelter-rebuild-'));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('rebuild-shelters CLI', () => {
  it('fails cleanly on an invalid HTML .kmz in dry-run mode without writing output', async () => {
    const tempDir = makeTempDir();
    const dataDir = path.join(tempDir, 'data');
    const sheltersPath = path.join(tempDir, 'shelters.json');
    const kmzPath = path.join(dataDir, 'miklat-isr.kmz');

    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(kmzPath, '<!DOCTYPE html><html><body>not a kmz</body></html>');
    fs.writeFileSync(
      sheltersPath,
      JSON.stringify({
        shelters: [],
        metadata: {
          count: 0,
          raw_count: 0,
          duplicates_removed: 0,
          cross_source_generic_merges: 0,
          dedupe_distance_meters: 10,
          dedupe_cross_source_distance_meters: 20,
          generated: '2026-03-23T00:00:00.000Z',
          sources: [],
          totalShelters: 0,
        },
      })
    );

    const originalContents = fs.readFileSync(sheltersPath, 'utf8');
    const io = {
      log: vi.fn(),
      error: vi.fn(),
    };

    await expect(
      runRebuildShelters(['--dry-run', kmzPath], { dataDir, sheltersPath, cwd: tempDir }, io)
    ).rejects.toThrow('Input is not a valid KMZ archive');

    expect(fs.readFileSync(sheltersPath, 'utf8')).toBe(originalContents);
  });
});

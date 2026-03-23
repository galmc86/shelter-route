#!/usr/bin/env node

import { existsSync, readFileSync } from 'fs';
import { createHash } from 'crypto';
import { resolve } from 'path';

const ROOT = process.cwd();
const SHELTERS_JSON = resolve(ROOT, 'public/shelters.json');
const RAW_SOURCES = [
  resolve(ROOT, 'data/miklat-isr.kmz'),
  resolve(ROOT, 'data/miklat-tlv.kmz'),
];

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exitCode = 1;
}

function isZipArchive(buffer) {
  return buffer.length >= 4
    && buffer[0] === 0x50
    && buffer[1] === 0x4b
    && buffer[2] === 0x03
    && buffer[3] === 0x04;
}

function detectHtml(buffer) {
  return buffer.toString('utf8', 0, Math.min(buffer.length, 256)).includes('<!DOCTYPE html>');
}

function verifyShelterDataset() {
  if (!existsSync(SHELTERS_JSON)) {
    fail(`Missing dataset: ${SHELTERS_JSON}`);
    return null;
  }

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(SHELTERS_JSON, 'utf8'));
  } catch (err) {
    fail(`Unable to parse public/shelters.json: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }

  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.shelters)) {
    fail('public/shelters.json must contain a top-level "shelters" array.');
    return null;
  }

  const hash = createHash('md5')
    .update(readFileSync(SHELTERS_JSON))
    .digest('hex')
    .slice(0, 8);

  console.log(`Dataset OK: ${parsed.shelters.length} shelters, version ${hash}`);
  if (parsed.metadata?.generated) {
    console.log(`Generated: ${parsed.metadata.generated}`);
  }
  if (Array.isArray(parsed.metadata?.sources) && parsed.metadata.sources.length > 0) {
    console.log(`Metadata sources: ${parsed.metadata.sources.join(', ')}`);
  }

  return parsed;
}

function verifyRawSources() {
  let validCount = 0;

  for (const file of RAW_SOURCES) {
    if (!existsSync(file)) {
      fail(`Missing raw source: ${file}`);
      continue;
    }

    const buffer = readFileSync(file);
    if (isZipArchive(buffer)) {
      console.log(`Raw source OK: ${file}`);
      validCount++;
      continue;
    }

    if (detectHtml(buffer)) {
      fail(`Raw source is HTML, not KMZ: ${file}`);
      continue;
    }

    fail(`Raw source is not a valid KMZ archive: ${file}`);
  }

  if (validCount !== RAW_SOURCES.length) {
    console.error(
      'Raw shelter sources are not reproducible yet. Replace the invalid KMZ files before attempting a full dataset refresh.'
    );
  }
}

verifyShelterDataset();
verifyRawSources();

if (!process.exitCode) {
  console.log('Shelter data verification passed.');
}

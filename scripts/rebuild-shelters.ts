import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { MiklatShelter, SheltersJson, SheltersMetadata } from './lib/shelters-schema';
import { extractKml, parseKmlPlacemarks } from './lib/kmz-parser';
import { canonicalSourceKey, sortSourcesByPriority } from './lib/source-keys';
import {
  buildExistingShelterIndex,
  resolveStableShelterId,
  type SeenShelterIds,
} from './lib/shelter-id';
import { deduplicateShelters } from './lib/dedup';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA_DIR = path.resolve(__dirname, '..', 'data');
const DEFAULT_SHELTERS_PATH = path.resolve(__dirname, '..', 'public', 'shelters.json');

interface CliOptions {
  dryRun: boolean;
  mergeExisting: boolean;
}

interface CliConfig {
  dataDir: string;
  sheltersPath: string;
  cwd: string;
}

interface CliIo {
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

interface RebuildSummary {
  rebuiltSources: string[];
  rawCount: number;
  dedupedKmzCount: number;
  totalShelters: number;
  duplicatesRemoved: number;
  crossSourceGenericMerges: number;
  preservedShelters: number;
  dryRun: boolean;
}

function defaultConfig(): CliConfig {
  return {
    dataDir: DEFAULT_DATA_DIR,
    sheltersPath: DEFAULT_SHELTERS_PATH,
    cwd: process.cwd(),
  };
}

function loadSheltersJson(sheltersPath: string): SheltersJson {
  return JSON.parse(fs.readFileSync(sheltersPath, 'utf8')) as SheltersJson;
}

function parseArgs(args: string[]): { options: CliOptions; files: string[] } {
  const options: CliOptions = {
    dryRun: false,
    mergeExisting: false,
  };
  const files: string[] = [];

  for (const arg of args) {
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg === '--merge-existing') {
      options.mergeExisting = true;
      continue;
    }
    files.push(arg);
  }

  return { options, files };
}

function resolveInputFiles(files: string[], config: CliConfig): string[] {
  if (files.length > 0) {
    return files.map((file) => path.resolve(config.cwd, file));
  }

  return fs.readdirSync(config.dataDir)
    .filter((entry) => entry.toLowerCase().endsWith('.kmz'))
    .sort()
    .map((entry) => path.join(config.dataDir, entry));
}

function buildShelterFromPlacemark(
  placemark: ReturnType<typeof parseKmlPlacemarks>[number],
  source: string,
  existingShelterIndex: ReturnType<typeof buildExistingShelterIndex>,
  seenShelterIds: SeenShelterIds
): MiklatShelter {
  return {
    id: resolveStableShelterId(
      source,
      placemark.lat,
      placemark.lng,
      existingShelterIndex,
      seenShelterIds
    ),
    name: placemark.name || 'מקלט ציבורי',
    lat: placemark.lat,
    lng: placemark.lng,
    description: placemark.description,
    source,
    sources: [source],
  };
}

function buildMetadata(params: {
  dedupedKmzShelters: MiklatShelter[];
  finalShelters: MiklatShelter[];
  rawCount: number;
  duplicatesRemoved: number;
  crossSourceGenericMerges: number;
  rebuiltSources: string[];
}): SheltersMetadata {
  const metadataSources = sortSourcesByPriority(
    Array.from(
      new Set([
        ...params.finalShelters.flatMap((shelter) => shelter.sources),
        ...params.rebuiltSources,
      ])
    )
  );

  return {
    count: params.dedupedKmzShelters.length,
    raw_count: params.rawCount,
    duplicates_removed: params.duplicatesRemoved,
    cross_source_generic_merges: params.crossSourceGenericMerges,
    dedupe_distance_meters: 10,
    dedupe_cross_source_distance_meters: 20,
    generated: new Date().toISOString(),
    sources: metadataSources,
    totalShelters: params.finalShelters.length,
  };
}

export async function runRebuildShelters(
  args: string[],
  config: Partial<CliConfig> = {},
  io: CliIo = console
): Promise<RebuildSummary> {
  const effectiveConfig = {
    ...defaultConfig(),
    ...config,
  };
  const { options, files } = parseArgs(args);
  const inputFiles = resolveInputFiles(files, effectiveConfig);

  if (inputFiles.length === 0) {
    throw new Error('No KMZ files found to rebuild');
  }

  const currentShelters = loadSheltersJson(effectiveConfig.sheltersPath);
  const existingShelterIndex = buildExistingShelterIndex(currentShelters.shelters);
  const seenShelterIds: SeenShelterIds = new Map();
  const rebuiltSources = inputFiles.map((file) => path.basename(file));
  const rebuiltSourceKeys = new Set(rebuiltSources.map((source) => canonicalSourceKey(source)));

  const rebuiltShelters: MiklatShelter[] = [];

  for (const file of inputFiles) {
    const source = path.basename(file);
    io.log(`Processing ${source}...`);
    const kml = await extractKml(fs.readFileSync(file));
    const placemarks = parseKmlPlacemarks(kml);

    rebuiltShelters.push(
      ...placemarks.map((placemark) =>
        buildShelterFromPlacemark(placemark, source, existingShelterIndex, seenShelterIds)
      )
    );
  }

  const deduped = deduplicateShelters(rebuiltShelters);

  const preservedShelters = options.mergeExisting
    ? currentShelters.shelters.filter(
        (shelter) => !rebuiltSourceKeys.has(canonicalSourceKey(shelter.source))
      )
    : [];

  const finalShelters = [
    ...deduped.shelters,
    ...preservedShelters,
  ];
  const finalJson: SheltersJson = {
    shelters: finalShelters,
    metadata: buildMetadata({
      dedupedKmzShelters: deduped.shelters,
      finalShelters,
      rawCount: rebuiltShelters.length,
      duplicatesRemoved: deduped.duplicatesRemoved,
      crossSourceGenericMerges: deduped.crossSourceGenericMerges,
      rebuiltSources,
    }),
  };

  if (!options.dryRun) {
    fs.writeFileSync(effectiveConfig.sheltersPath, JSON.stringify(finalJson, null, 2));
  }

  const summary: RebuildSummary = {
    rebuiltSources,
    rawCount: rebuiltShelters.length,
    dedupedKmzCount: deduped.shelters.length,
    totalShelters: finalShelters.length,
    duplicatesRemoved: deduped.duplicatesRemoved,
    crossSourceGenericMerges: deduped.crossSourceGenericMerges,
    preservedShelters: preservedShelters.length,
    dryRun: options.dryRun,
  };

  io.log(
    `${options.dryRun ? 'Dry run complete' : 'Rebuild complete'}: `
      + `${summary.rawCount} raw -> ${summary.dedupedKmzCount} KMZ shelters`
      + `, ${summary.totalShelters} total shelters`
      + `, ${summary.duplicatesRemoved} duplicates removed`
  );

  return summary;
}

async function main() {
  try {
    await runRebuildShelters(process.argv.slice(2));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`ERROR: ${message}`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}

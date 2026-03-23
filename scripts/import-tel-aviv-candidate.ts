import fs from 'fs';
import path from 'path';
import type { SheltersJson } from './lib/shelters-schema';
import { importTelAvivCandidate } from './lib/tel-aviv-arcgis';

const CURRENT_SHELTERS_PATH = path.resolve(process.cwd(), 'public/shelters.json');
const DEFAULT_OUTPUT_PATH = path.resolve(process.cwd(), 'tmp/tel-aviv-shelters.candidate.json');

async function main() {
  const outputPath = process.argv[2]
    ? path.resolve(process.cwd(), process.argv[2])
    : DEFAULT_OUTPUT_PATH;

  try {
    const current = JSON.parse(fs.readFileSync(CURRENT_SHELTERS_PATH, 'utf8')) as SheltersJson;
    const candidate = await importTelAvivCandidate(current.shelters);

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(candidate, null, 2));

    console.log(`Wrote Tel Aviv candidate: ${outputPath}`);
    console.log(`Imported shelters: ${candidate.metadata.importedCount}`);
    console.log(`Reused ids: ${candidate.metadata.reusedIdCount}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`ERROR: ${message}`);
    process.exit(1);
  }
}

void main();

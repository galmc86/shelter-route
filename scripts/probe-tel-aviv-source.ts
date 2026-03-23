import { probeTelAvivSource } from './lib/tel-aviv-arcgis';

async function main() {
  try {
    const summary = await probeTelAvivSource();
    console.log(`Tel Aviv source count: ${summary.count}`);
    console.log(`Sample shelter type: ${summary.sampleShelterType ?? 'n/a'}`);
    console.log(`Sample attributes: ${summary.sampleAttributes.join(', ')}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`ERROR: ${message}`);
    process.exit(1);
  }
}

void main();

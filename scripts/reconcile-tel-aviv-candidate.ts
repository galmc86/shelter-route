import fs from 'fs';
import path from 'path';
import type { SheltersJson } from './lib/shelters-schema';
import type { TelAvivCandidateFile } from './lib/tel-aviv-arcgis';
import { reconcileTelAvivShelters } from './lib/tel-aviv-reconcile';

const CURRENT_SHELTERS_PATH = path.resolve(process.cwd(), 'public/shelters.json');
const DEFAULT_CANDIDATE_PATH = path.resolve(process.cwd(), 'tmp/tel-aviv-shelters.candidate.json');
const DEFAULT_REPORT_PATH = path.resolve(process.cwd(), 'tmp/tel-aviv-reconciliation.report.json');
const DEFAULT_OUTPUT_PATH = path.resolve(process.cwd(), 'tmp/shelters.tlv-reconciled.candidate.json');

function loadJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

async function main() {
  const candidatePath = process.argv[2]
    ? path.resolve(process.cwd(), process.argv[2])
    : DEFAULT_CANDIDATE_PATH;
  const reportPath = process.argv[3]
    ? path.resolve(process.cwd(), process.argv[3])
    : DEFAULT_REPORT_PATH;
  const outputPath = process.argv[4]
    ? path.resolve(process.cwd(), process.argv[4])
    : DEFAULT_OUTPUT_PATH;

  try {
    const current = loadJson<SheltersJson>(CURRENT_SHELTERS_PATH);
    const candidate = loadJson<TelAvivCandidateFile>(candidatePath);
    const result = reconcileTelAvivShelters(current, candidate.shelters);

    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(result.report, null, 2));
    fs.writeFileSync(outputPath, JSON.stringify(result.candidateDataset, null, 2));

    console.log(`Wrote Tel Aviv reconciliation report: ${reportPath}`);
    console.log(`Wrote reconciled shelter candidate: ${outputPath}`);
    console.log(`Safe coordinate moves: ${result.report.safeMoveCount}`);
    console.log(`Safe enrichments without moving coordinates: ${result.report.safeEnrichCount}`);
    console.log(`Promoted high-confidence matches: ${result.report.promotedCount}`);
    console.log(`Ambiguous matches left unchanged: ${result.report.ambiguousCount}`);
    console.log(`Current-only shelters left unchanged: ${result.report.currentOnlyCount}`);
    console.log(`Candidate-only shelters not auto-added: ${result.report.candidateOnlyCount}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`ERROR: ${message}`);
    process.exit(1);
  }
}

void main();

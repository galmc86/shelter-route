import type { MiklatShelter, SheltersJson } from './shelters-schema';
import { canonicalSourceKey, sortSourcesByPriority } from './source-keys';
import { haversineMeters } from './shelter-id';

export const TEL_AVIV_RECONCILED_SOURCE = 'miklat-tlv-arcgis';

const SAFE_MOVE_DISTANCE_METERS = 20;
const SAFE_ENRICH_DISTANCE_METERS = 35;
const SAFE_ENRICH_ADDRESS_DISTANCE_METERS = 90;
const PLAUSIBLE_MATCH_DISTANCE_METERS = 120;
const LOW_CONFIDENCE_DISTANCE_METERS = 60;

export type ReconcileAction = 'safe_move' | 'safe_enrich' | 'review';

export interface ReconcileMatch {
  current: MiklatShelter;
  candidate: MiklatShelter;
  distanceMeters: number;
  nameOverlap: number;
  descriptionOverlap: number;
  confidence: 'high' | 'medium' | 'low';
  action: ReconcileAction;
}

export interface TelAvivReconcileReport {
  generatedAt: string;
  currentCount: number;
  candidateCount: number;
  safeMoveCount: number;
  safeEnrichCount: number;
  promotedCount: number;
  ambiguousCount: number;
  currentOnlyCount: number;
  candidateOnlyCount: number;
  promoted: ReconcileMatch[];
  ambiguous: ReconcileMatch[];
  currentOnly: MiklatShelter[];
  candidateOnly: MiklatShelter[];
}

export interface ReconcileResult {
  report: TelAvivReconcileReport;
  candidateDataset: SheltersJson;
}

function normalizeText(value: string | undefined): string {
  if (!value) {
    return '';
  }

  return value
    .replace(/["'”“׳״]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function extractSchoolNameHints(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return [
    ...Array.from(value.matchAll(/ביה"?ס\s+"([^"]{2,})"/g)).map((match) => match[1] ?? ''),
    ...Array.from(value.matchAll(/בית הספר\s+"([^"]{2,})"/g)).map((match) => match[1] ?? ''),
    ...Array.from(value.matchAll(/בי"?ס\s+"([^"]{2,})"/g)).map((match) => match[1] ?? ''),
    ...Array.from(value.matchAll(/"([^"]{2,})"/g)).map((match) => match[1] ?? ''),
    ...Array.from(value.matchAll(/״([^״]{2,})״/g)).map((match) => match[1] ?? ''),
  ]
    .map((phrase) => normalizeText(phrase))
    .filter(Boolean);
}

function toWordSet(value: string | undefined): Set<string> {
  const normalized = normalizeText(value);
  if (!normalized) {
    return new Set();
  }

  return new Set(
    normalized
      .split(/[\s,./()-]+/)
      .map((part) => part.trim())
      .filter(Boolean)
  );
}

function textOverlap(left: string | undefined, right: string | undefined): number {
  const leftWords = toWordSet(left);
  const rightWords = toWordSet(right);
  if (leftWords.size === 0 || rightWords.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const word of leftWords) {
    if (rightWords.has(word)) {
      intersection++;
    }
  }

  return intersection / Math.min(leftWords.size, rightWords.size);
}

function isTelAvivShelter(shelter: MiklatShelter): boolean {
  return canonicalSourceKey(shelter.source) === 'miklat-tlv';
}

function looksLikeSchoolMatch(current: MiklatShelter, candidate: MiklatShelter): boolean {
  const combined = [
    current.name,
    current.description,
    candidate.name,
    candidate.description,
  ]
    .filter(Boolean)
    .join(' ');
  return /בית ספר|ביה"?ס|מוסדות חינוך/.test(combined);
}

function quotedSchoolNameOverlap(
  current: MiklatShelter,
  candidate: MiklatShelter
): number {
  const candidateName = candidate.name;
  let best = 0;

  for (const phrase of extractSchoolNameHints(current.description)) {
    best = Math.max(best, textOverlap(phrase, candidateName));
  }

  return best;
}

function looksLikeParkingMatch(current: MiklatShelter, candidate: MiklatShelter): boolean {
  const currentText = `${current.name} ${current.description ?? ''}`;
  const candidateText = `${candidate.name} ${candidate.description ?? ''}`;
  return /חניון|מחסה/.test(currentText)
    && /חניון|מגדל|מלון|בית/.test(candidateText);
}

function classifyMatch(
  current: MiklatShelter,
  candidate: MiklatShelter
): ReconcileMatch | null {
  const distanceMeters = haversineMeters(
    current.lat,
    current.lng,
    candidate.lat,
    candidate.lng
  );
  const nameOverlap = textOverlap(current.name, candidate.name);
  const descriptionOverlap = textOverlap(current.description, candidate.description);

  const exactishName = nameOverlap >= 0.8;
  const exactishDescription = descriptionOverlap >= 0.8;
  const strongTextSignal = nameOverlap >= 0.5 || descriptionOverlap >= 0.75;
  const plausibleTextSignal = nameOverlap >= 0.5 || descriptionOverlap >= 0.5;
  const quotedSchoolOverlap = quotedSchoolNameOverlap(current, candidate);

  if (distanceMeters <= SAFE_MOVE_DISTANCE_METERS && (exactishName || exactishDescription)) {
    return {
      current,
      candidate,
      distanceMeters,
      nameOverlap,
      descriptionOverlap,
      confidence: 'high',
      action: 'safe_move',
    };
  }

  if (distanceMeters <= SAFE_ENRICH_DISTANCE_METERS && strongTextSignal) {
    return {
      current,
      candidate,
      distanceMeters,
      nameOverlap,
      descriptionOverlap,
      confidence: 'high',
      action: 'safe_enrich',
    };
  }

  if (
    distanceMeters <= SAFE_ENRICH_ADDRESS_DISTANCE_METERS
    && exactishName
    && descriptionOverlap >= 0.5
  ) {
    return {
      current,
      candidate,
      distanceMeters,
      nameOverlap,
      descriptionOverlap,
      confidence: 'high',
      action: 'safe_enrich',
    };
  }

  if (
    distanceMeters <= SAFE_ENRICH_ADDRESS_DISTANCE_METERS
    && looksLikeSchoolMatch(current, candidate)
    && (descriptionOverlap >= 1 || quotedSchoolOverlap >= 0.5)
  ) {
    return {
      current,
      candidate,
      distanceMeters,
      nameOverlap,
      descriptionOverlap,
      confidence: 'high',
      action: 'safe_enrich',
    };
  }

  if (
    distanceMeters <= SAFE_ENRICH_ADDRESS_DISTANCE_METERS
    && looksLikeParkingMatch(current, candidate)
    && descriptionOverlap >= 1
  ) {
    return {
      current,
      candidate,
      distanceMeters,
      nameOverlap,
      descriptionOverlap,
      confidence: 'high',
      action: 'safe_enrich',
    };
  }

  if (distanceMeters <= PLAUSIBLE_MATCH_DISTANCE_METERS && plausibleTextSignal) {
    return {
      current,
      candidate,
      distanceMeters,
      nameOverlap,
      descriptionOverlap,
      confidence: 'medium',
      action: 'review',
    };
  }

  if (distanceMeters <= LOW_CONFIDENCE_DISTANCE_METERS && (nameOverlap >= 0.4 || descriptionOverlap >= 0.4)) {
    return {
      current,
      candidate,
      distanceMeters,
      nameOverlap,
      descriptionOverlap,
      confidence: 'low',
      action: 'review',
    };
  }

  return null;
}

function preferDescription(current: MiklatShelter, candidate: MiklatShelter): string | undefined {
  const currentDescription = normalizeText(current.description);
  const candidateDescription = normalizeText(candidate.description);

  if (!candidateDescription) {
    return current.description;
  }
  if (!currentDescription) {
    return candidate.description;
  }

  return currentDescription.length >= candidateDescription.length
    ? current.description
    : candidate.description;
}

function mergePromotedShelter(match: ReconcileMatch): MiklatShelter {
  const mergedSources = sortSourcesByPriority(
    Array.from(
      new Set([
        ...match.current.sources,
        ...match.candidate.sources,
        TEL_AVIV_RECONCILED_SOURCE,
      ])
    )
  );

  if (match.action === 'safe_enrich') {
    return {
      ...match.current,
      description: preferDescription(match.current, match.candidate),
      sources: mergedSources,
    };
  }

  return {
    id: match.current.id,
    name: match.current.name,
    lat: match.candidate.lat,
    lng: match.candidate.lng,
    description: preferDescription(match.current, match.candidate),
    source: match.current.source,
    sources: mergedSources,
  };
}

function findBestCandidateMatch(
  current: MiklatShelter,
  candidates: MiklatShelter[],
  usedCandidateIds: Set<number>
): ReconcileMatch | null {
  let best: ReconcileMatch | null = null;

  for (const candidate of candidates) {
    if (usedCandidateIds.has(candidate.id)) {
      continue;
    }

    const match = classifyMatch(current, candidate);
    if (!match) {
      continue;
    }

    if (
      !best
      || (match.confidence === 'high' && best.confidence !== 'high')
      || (
        match.confidence === best.confidence
        && (
          match.descriptionOverlap > best.descriptionOverlap
          || (
            match.descriptionOverlap === best.descriptionOverlap
            && match.nameOverlap > best.nameOverlap
          )
          || (
            match.descriptionOverlap === best.descriptionOverlap
            && match.nameOverlap === best.nameOverlap
            && match.distanceMeters < best.distanceMeters
          )
        )
      )
    ) {
      best = match;
    }
  }

  return best;
}

export function reconcileTelAvivShelters(
  currentDataset: SheltersJson,
  candidateShelters: MiklatShelter[]
): ReconcileResult {
  const currentTelAviv = currentDataset.shelters.filter(isTelAvivShelter);
  const nonTelAvivShelters = currentDataset.shelters.filter((shelter) => !isTelAvivShelter(shelter));
  const usedCandidateIds = new Set<number>();
  const promoted: ReconcileMatch[] = [];
  const ambiguous: ReconcileMatch[] = [];
  const currentOnly: MiklatShelter[] = [];

  for (const currentShelter of currentTelAviv) {
    const bestMatch = findBestCandidateMatch(currentShelter, candidateShelters, usedCandidateIds);
    if (!bestMatch) {
      currentOnly.push(currentShelter);
      continue;
    }

    if (bestMatch.confidence === 'high') {
      promoted.push(bestMatch);
      usedCandidateIds.add(bestMatch.candidate.id);
      continue;
    }

    ambiguous.push(bestMatch);
    usedCandidateIds.add(bestMatch.candidate.id);
  }

  const candidateOnly = candidateShelters.filter((shelter) => !usedCandidateIds.has(shelter.id));
  const promotedShelters = promoted.map(mergePromotedShelter);
  const retainedAmbiguousShelters = ambiguous.map((match) => match.current);
  const nextTelAvivShelters = [...promotedShelters, ...retainedAmbiguousShelters, ...currentOnly]
    .sort((left, right) => left.id - right.id);

  const candidateDataset: SheltersJson = {
    shelters: [...nonTelAvivShelters, ...nextTelAvivShelters].sort((left, right) => left.id - right.id),
    metadata: {
      ...currentDataset.metadata,
      count: nonTelAvivShelters.length + nextTelAvivShelters.length,
      totalShelters: nonTelAvivShelters.length + nextTelAvivShelters.length,
      generated: new Date().toISOString(),
      sources: sortSourcesByPriority(
        Array.from(
          new Set([
            ...currentDataset.metadata.sources,
            TEL_AVIV_RECONCILED_SOURCE,
          ])
        )
      ),
    },
  };

  return {
    report: {
      generatedAt: new Date().toISOString(),
      currentCount: currentTelAviv.length,
      candidateCount: candidateShelters.length,
      safeMoveCount: promoted.filter((match) => match.action === 'safe_move').length,
      safeEnrichCount: promoted.filter((match) => match.action === 'safe_enrich').length,
      promotedCount: promoted.length,
      ambiguousCount: ambiguous.length,
      currentOnlyCount: currentOnly.length,
      candidateOnlyCount: candidateOnly.length,
      promoted,
      ambiguous,
      currentOnly,
      candidateOnly,
    },
    candidateDataset,
  };
}

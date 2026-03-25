import type { FamilyRemoteGroupRecord } from './familyRemoteModel';

const STORAGE_KEY = 'shelter-route:family-sync-queue';

export type FamilySyncMutation =
  | {
      kind: 'upsert';
      groupCode: string;
      queuedAt: string;
      record: FamilyRemoteGroupRecord;
    }
  | {
      kind: 'clear';
      groupCode: string;
      queuedAt: string;
    };

export function getPendingFamilySyncMutations(): FamilySyncMutation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(sanitizeMutation)
      .filter((mutation): mutation is FamilySyncMutation => mutation !== null);
  } catch {
    return [];
  }
}

export function getPendingFamilySyncMutation(groupCode: string): FamilySyncMutation | null {
  const normalizedCode = groupCode.toUpperCase();
  return getPendingFamilySyncMutations().find((mutation) => mutation.groupCode === normalizedCode) ?? null;
}

export function queueFamilySyncMutation(mutation: FamilySyncMutation): FamilySyncMutation[] {
  const normalizedMutation = normalizeMutation(mutation);
  const nextMutations = [
    ...getPendingFamilySyncMutations().filter((entry) => entry.groupCode !== normalizedMutation.groupCode),
    normalizedMutation,
  ];

  savePendingFamilySyncMutations(nextMutations);
  return nextMutations;
}

export function savePendingFamilySyncMutations(mutations: FamilySyncMutation[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mutations.map(normalizeMutation)));
  } catch {
    // ignore storage failures
  }
}

export function clearPendingFamilySyncMutations(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore storage failures
  }
}

function sanitizeMutation(raw: unknown): FamilySyncMutation | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const candidate = raw as Partial<FamilySyncMutation>;
  if (
    (candidate.kind !== 'upsert' && candidate.kind !== 'clear') ||
    typeof candidate.groupCode !== 'string' ||
    typeof candidate.queuedAt !== 'string'
  ) {
    return null;
  }

  if (candidate.kind === 'clear') {
    return {
      kind: 'clear',
      groupCode: candidate.groupCode.toUpperCase(),
      queuedAt: candidate.queuedAt,
    };
  }

  const upsertCandidate = candidate as Partial<Extract<FamilySyncMutation, { kind: 'upsert' }>>;
  if (!upsertCandidate.record || typeof upsertCandidate.record !== 'object') {
    return null;
  }

  const record = upsertCandidate.record as FamilyRemoteGroupRecord;
  if (typeof record.inviteCode !== 'string') {
    return null;
  }

  return {
    kind: 'upsert',
    groupCode: candidate.groupCode.toUpperCase(),
    queuedAt: candidate.queuedAt,
    record: {
      ...record,
      inviteCode: record.inviteCode.toUpperCase(),
    },
  };
}

function normalizeMutation(mutation: FamilySyncMutation): FamilySyncMutation {
  if (mutation.kind === 'clear') {
    return {
      ...mutation,
      groupCode: mutation.groupCode.toUpperCase(),
    };
  }

  return {
    ...mutation,
    groupCode: mutation.groupCode.toUpperCase(),
    record: {
      ...mutation.record,
      inviteCode: mutation.record.inviteCode.toUpperCase(),
    },
  };
}

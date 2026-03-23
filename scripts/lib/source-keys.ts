import path from 'path';

const DATED_SOURCE_SUFFIX_RE = /-\d{4}-\d{2}-\d{2}$/;
const CANONICAL_SOURCE_ALIASES: Record<string, string> = {
  'tel-aviv-arcgis': 'miklat-tlv',
};

export const CANONICAL_SOURCE_PRIORITY = [
  'miklat-isr',
  'miklat-tlv',
  'givatayim-open-shelters',
] as const;

const CANONICAL_SOURCE_PRIORITY_INDEX = new Map(
  CANONICAL_SOURCE_PRIORITY.map((key, index) => [key, index])
);

export function stripSourceExtension(source: string): string {
  return path.basename(source).replace(/\.[^.]+$/, '');
}

export function canonicalSourceKey(source: string): string {
  const base = stripSourceExtension(source);
  const normalized = base.replace(DATED_SOURCE_SUFFIX_RE, '');
  return CANONICAL_SOURCE_ALIASES[normalized] ?? normalized;
}

export function isKmzSource(source: string): boolean {
  return path.extname(source).toLowerCase() === '.kmz';
}

export function compareCanonicalSourcePriority(left: string, right: string): number {
  const leftIndex = CANONICAL_SOURCE_PRIORITY_INDEX.get(left);
  const rightIndex = CANONICAL_SOURCE_PRIORITY_INDEX.get(right);

  if (leftIndex !== undefined && rightIndex !== undefined) {
    return leftIndex - rightIndex;
  }
  if (leftIndex !== undefined) {
    return -1;
  }
  if (rightIndex !== undefined) {
    return 1;
  }

  return left.localeCompare(right);
}

export function sortSourcesByPriority<T extends string>(sources: T[]): T[] {
  return [...sources].sort((left, right) =>
    compareCanonicalSourcePriority(canonicalSourceKey(left), canonicalSourceKey(right))
      || left.localeCompare(right)
  );
}

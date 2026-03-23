export type ShelterKind = 'shelter' | 'migunit' | 'protected-space' | 'community-protection';

export interface MiklatShelter {
  id: number;
  name: string;
  lat: number;
  lng: number;
  description?: string;
  kind?: ShelterKind;
  source: string;
  sources: string[];
}

export interface SheltersMetadata {
  count: number;
  raw_count: number;
  duplicates_removed: number;
  cross_source_generic_merges: number;
  dedupe_distance_meters: number;
  dedupe_cross_source_distance_meters: number;
  generated: string;
  sources: string[];
  totalShelters: number;
}

export interface SheltersJson {
  shelters: MiklatShelter[];
  metadata: SheltersMetadata;
}

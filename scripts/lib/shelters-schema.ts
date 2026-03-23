export interface MiklatShelter {
  id: number;
  name: string;
  lat: number;
  lng: number;
  description?: string;
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

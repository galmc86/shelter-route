import type { MiklatShelter } from './shelters-schema';
import {
  buildExistingShelterIndex,
  resolveStableShelterId,
  type SeenShelterIds,
} from './shelter-id';

export const TEL_AVIV_ARCGIS_SOURCE = 'tel-aviv-arcgis';
export const TEL_AVIV_ARCGIS_LAYER_URL =
  'https://gisn.tel-aviv.gov.il/ArcGIS/rest/services/IView2/MapServer/592/query';
const PAGE_SIZE = 1000;

export interface ArcgisQueryResponse {
  features?: ArcgisFeature[];
  exceededTransferLimit?: boolean;
  error?: {
    message?: string;
  };
}

export interface ArcgisFeature {
  attributes?: ArcgisShelterAttributes;
}

export interface ArcgisShelterAttributes {
  ms_miklat?: number | null;
  t_sug?: string | null;
  Full_Address?: string | null;
  miklat_mungash?: string | null;
  is_open?: string | null;
  lat?: number | null;
  lon?: number | null;
  shem?: string | null;
  hearot?: string | null;
  opening_times?: string | null;
  date_import?: string | null;
}

export interface TelAvivProbeSummary {
  count: number;
  sampleAttributes: string[];
  sampleShelterType: string | null;
}

export interface TelAvivCandidateFile {
  shelters: MiklatShelter[];
  metadata: {
    source: string;
    endpoint: string;
    fetchedAt: string;
    importedCount: number;
    reusedIdCount: number;
    currentTelAvivCount: number;
  };
}

function buildQueryUrl(resultOffset: number, returnCountOnly = false): string {
  const params = new URLSearchParams({
    where: '1=1',
    f: 'json',
    returnGeometry: 'false',
    outFields: [
      'ms_miklat',
      't_sug',
      'Full_Address',
      'miklat_mungash',
      'is_open',
      'lat',
      'lon',
      'shem',
      'hearot',
      'opening_times',
      'date_import',
    ].join(','),
  });

  if (returnCountOnly) {
    params.set('returnCountOnly', 'true');
  } else {
    params.set('resultOffset', String(resultOffset));
    params.set('resultRecordCount', String(PAGE_SIZE));
  }

  return `${TEL_AVIV_ARCGIS_LAYER_URL}?${params.toString()}`;
}

async function fetchArcgisJson(url: string): Promise<ArcgisQueryResponse & { count?: number }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Tel Aviv ArcGIS request failed: HTTP ${response.status}`);
  }

  const data = (await response.json()) as ArcgisQueryResponse & { count?: number };
  if (data.error?.message) {
    throw new Error(`Tel Aviv ArcGIS error: ${data.error.message}`);
  }

  return data;
}

function pickShelterName(attributes: ArcgisShelterAttributes): string {
  return attributes.shem?.trim()
    || attributes.t_sug?.trim()
    || 'מקלט ציבורי';
}

function buildDescription(attributes: ArcgisShelterAttributes): string | undefined {
  return attributes.Full_Address?.trim()
    || attributes.hearot?.trim()
    || attributes.opening_times?.trim()
    || undefined;
}

export function normalizeTelAvivFeature(
  feature: ArcgisFeature,
  existingIndex: ReturnType<typeof buildExistingShelterIndex>,
  seenShelterIds: SeenShelterIds
): MiklatShelter | null {
  const attributes = feature.attributes;
  if (!attributes) {
    return null;
  }

  const lat = attributes.lat;
  const lng = attributes.lon;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return {
    id: resolveStableShelterId(
      TEL_AVIV_ARCGIS_SOURCE,
      lat,
      lng,
      existingIndex,
      seenShelterIds
    ),
    name: pickShelterName(attributes),
    lat,
    lng,
    description: buildDescription(attributes),
    source: TEL_AVIV_ARCGIS_SOURCE,
    sources: [TEL_AVIV_ARCGIS_SOURCE],
  };
}

export async function probeTelAvivSource(): Promise<TelAvivProbeSummary> {
  const countResult = await fetchArcgisJson(buildQueryUrl(0, true));
  const pageResult = await fetchArcgisJson(buildQueryUrl(0));
  const sample = pageResult.features?.[0]?.attributes ?? null;

  return {
    count: countResult.count ?? pageResult.features?.length ?? 0,
    sampleAttributes: sample ? Object.keys(sample) : [],
    sampleShelterType: sample?.t_sug ?? null,
  };
}

export async function fetchAllTelAvivFeatures(): Promise<ArcgisFeature[]> {
  const features: ArcgisFeature[] = [];
  let offset = 0;

  for (;;) {
    const page = await fetchArcgisJson(buildQueryUrl(offset));
    const pageFeatures = page.features ?? [];
    features.push(...pageFeatures);

    if (pageFeatures.length < PAGE_SIZE || !page.exceededTransferLimit) {
      break;
    }

    offset += pageFeatures.length;
  }

  return features;
}

export async function importTelAvivCandidate(currentShelters: MiklatShelter[]): Promise<TelAvivCandidateFile> {
  const existingIndex = buildExistingShelterIndex(currentShelters);
  const seenShelterIds: SeenShelterIds = new Map();
  const currentTelAvivCount = currentShelters.filter((shelter) => shelter.source.includes('miklat-tlv')).length;
  const features = await fetchAllTelAvivFeatures();
  const shelters = features
    .map((feature) => normalizeTelAvivFeature(feature, existingIndex, seenShelterIds))
    .filter((shelter): shelter is MiklatShelter => shelter !== null);

  const reusedIdCount = shelters.filter((shelter) =>
    currentShelters.some((existing) => existing.id === shelter.id)
  ).length;

  return {
    shelters,
    metadata: {
      source: TEL_AVIV_ARCGIS_SOURCE,
      endpoint: TEL_AVIV_ARCGIS_LAYER_URL,
      fetchedAt: new Date().toISOString(),
      importedCount: shelters.length,
      reusedIdCount,
      currentTelAvivCount,
    },
  };
}

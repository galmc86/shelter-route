import type { PlaceResult } from '../types';
import { resilientFetch } from './fetchClient';

// Re-export for backward compatibility
export type NominatimResult = PlaceResult;

interface NominatimResponse {
  lat: string;
  lon: string;
  display_name: string;
}

export async function searchPlaces(
  query: string,
  signal?: AbortSignal
): Promise<PlaceResult[]> {
  if (!query || query.length < 2) return [];

  const params = new URLSearchParams({
    format: 'json',
    countrycodes: 'il',
    limit: '5',
    q: query,
    'accept-language': 'he',
  });

  const result = await resilientFetch<NominatimResponse[]>(
    `https://nominatim.openstreetmap.org/search?${params}`,
    {},
    { timeout: 5000, retries: 0, signal }
  );

  if (!result.ok) {
    console.warn('[Nominatim] Search failed:', result.error.message);
    return [];
  }

  return result.data.map((item) => ({
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
    displayName: item.display_name,
  }));
}

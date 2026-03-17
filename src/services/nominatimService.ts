export interface NominatimResult {
  lat: number;
  lng: number;
  displayName: string;
}

interface NominatimResponse {
  lat: string;
  lon: string;
  display_name: string;
}

export async function searchPlaces(
  query: string,
  signal?: AbortSignal
): Promise<NominatimResult[]> {
  if (!query || query.length < 2) return [];

  const params = new URLSearchParams({
    format: 'json',
    countrycodes: 'il',
    limit: '5',
    q: query,
    'accept-language': 'he',
  });

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    {
      headers: { 'User-Agent': 'ShelterRoute/1.0' },
      signal,
    }
  );

  if (!response.ok) return [];

  const data: NominatimResponse[] = await response.json();

  return data.map((item) => ({
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
    displayName: item.display_name,
  }));
}

import type { RouteOption, TravelMode, LatLng, LatLngBounds } from '../types';

const ORS_API = 'https://api.openrouteservice.org/v2/directions';

const PROFILE_MAP: Record<TravelMode, string> = {
  WALKING: 'foot-walking',
  BICYCLING: 'cycling-regular',
  DRIVING: 'driving-car',
};

function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

function computeBounds(path: LatLng[]): LatLngBounds {
  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;
  for (const p of path) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  return {
    southWest: { lat: minLat, lng: minLng },
    northEast: { lat: maxLat, lng: maxLng },
  };
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return 'פחות מדקה';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} דקות`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (remaining === 0) return `${hours} שעות`;
  return `${hours} שעות ו-${remaining} דקות`;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} מטר`;
  return `${(meters / 1000).toFixed(1)} ק"מ`;
}

function parseRoutes(data: { routes?: Array<{ geometry: string; summary: { duration: number; distance: number } }> }): RouteOption[] {
  const routes = data.routes;
  if (!routes || routes.length === 0) throw new Error('לא נמצא מסלול');

  return routes.map((route) => {
    const path = decodePolyline(route.geometry);
    const bounds = computeBounds(path);
    const summary = route.summary;

    return {
      path,
      bounds,
      duration: formatDuration(summary.duration),
      distance: formatDistance(summary.distance),
      durationSeconds: summary.duration,
      distanceMeters: summary.distance,
    };
  });
}

async function fetchRoutes(
  origin: LatLng,
  destination: LatLng,
  profile: string,
  apiKey: string,
  withAlternatives: boolean
): Promise<Response> {
  const body: Record<string, unknown> = {
    coordinates: [
      [origin.lng, origin.lat],
      [destination.lng, destination.lat],
    ],
  };

  if (withAlternatives) {
    body.alternative_routes = {
      target_count: 3,
      share_factor: 0.6,
      weight_factor: 1.4,
    };
  }

  return fetch(`${ORS_API}/${profile}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiKey,
    },
    body: JSON.stringify(body),
  });
}

export async function computeRoutes(
  origin: LatLng,
  destination: LatLng,
  travelMode: TravelMode
): Promise<RouteOption[]> {
  const profile = PROFILE_MAP[travelMode];
  const apiKey = import.meta.env.VITE_ORS_API_KEY;

  // Try with alternative routes first
  let response = await fetchRoutes(origin, destination, profile, apiKey, true);

  // If alternative routes request fails, fall back to single route
  if (!response.ok) {
    response = await fetchRoutes(origin, destination, profile, apiKey, false);
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const message = errorData?.error?.message || 'לא נמצא מסלול';
    throw new Error(message);
  }

  const data = await response.json();
  return parseRoutes(data);
}

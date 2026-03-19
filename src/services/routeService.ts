import type { RouteOption, TravelMode, LatLng, LatLngBounds } from '../types';
import { translations } from '../i18n/translations';
import type { TranslationKey } from '../i18n/translations';

type TranslateFn = (key: TranslationKey) => string;

const defaultT: TranslateFn = (key) => translations.he[key] ?? key;

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

function formatDuration(seconds: number, t: TranslateFn = defaultT): string {
  if (seconds < 60) return t('units.lessThanMinute');
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    const template = minutes === 1 ? t('units.minute') : t('units.minutes');
    return template.replace('{{n}}', String(minutes));
  }
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (remaining === 0) {
    const template = hours === 1 ? t('units.hour') : t('units.hours');
    return template.replace('{{n}}', String(hours));
  }
  if (hours === 1) {
    return t('units.hourMinutes').replace('{{n}}', String(hours)).replace('{{m}}', String(remaining));
  }
  return t('units.hoursMinutes' as TranslationKey).replace('{{n}}', String(hours)).replace('{{m}}', String(remaining));
}

function formatDistance(meters: number, t: TranslateFn = defaultT): string {
  if (meters < 1000) return t('units.meters').replace('{{n}}', String(Math.round(meters)));
  return t('units.km').replace('{{n}}', (meters / 1000).toFixed(1));
}

// Max realistic speeds (m/s) per travel mode — used to sanity-check ORS durations
const MAX_SPEED: Record<TravelMode, number> = {
  WALKING: 5 / 3.6,     // 5 km/h
  BICYCLING: 18 / 3.6,  // 18 km/h
  DRIVING: 90 / 3.6,    // 90 km/h
};

function sanitizeDuration(durationSeconds: number, distanceMeters: number, travelMode: TravelMode): number {
  const impliedSpeed = distanceMeters / durationSeconds; // m/s
  const maxSpeed = MAX_SPEED[travelMode];
  if (impliedSpeed > maxSpeed) {
    // ORS returned an unrealistic duration — estimate from distance and max speed
    return Math.round(distanceMeters / maxSpeed);
  }
  return durationSeconds;
}

function parseRoutes(data: { routes?: Array<{ geometry: string; summary: { duration: number; distance: number } }> }, travelMode: TravelMode, t: TranslateFn = defaultT): RouteOption[] {
  const routes = data.routes;
  if (!routes || routes.length === 0) throw new Error('לא נמצא מסלול');

  return routes.map((route) => {
    const path = decodePolyline(route.geometry);
    const bounds = computeBounds(path);
    const summary = route.summary;
    const duration = sanitizeDuration(summary.duration, summary.distance, travelMode);

    return {
      path,
      bounds,
      duration: formatDuration(duration, t),
      distance: formatDistance(summary.distance, t),
      durationSeconds: duration,
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
      share_factor: 0.8,
      weight_factor: 2.0,
    };
  }

  const doFetch = () =>
    fetch(`${ORS_API}/${profile}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: apiKey,
      },
      body: JSON.stringify(body),
    });

  // Retry once on network error (handles Safari 18+ keep-alive bug)
  try {
    return await doFetch();
  } catch {
    return doFetch();
  }
}

export async function computeRoutes(
  origin: LatLng,
  destination: LatLng,
  travelMode: TravelMode,
  t: TranslateFn = defaultT
): Promise<RouteOption[]> {
  const profile = PROFILE_MAP[travelMode];
  const apiKey = import.meta.env.VITE_ORS_API_KEY;

  let response: Response;

  try {
    // Try with alternative routes first
    response = await fetchRoutes(origin, destination, profile, apiKey, true);
  } catch {
    // Network error on alternatives request — try without
    try {
      response = await fetchRoutes(origin, destination, profile, apiKey, false);
    } catch {
      throw new Error('שגיאת רשת – בדוק את חיבור האינטרנט');
    }
  }

  // If alternative routes HTTP error, fall back to single route
  if (!response.ok) {
    try {
      response = await fetchRoutes(origin, destination, profile, apiKey, false);
    } catch {
      throw new Error('שגיאת רשת – בדוק את חיבור האינטרנט');
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const message = errorData?.error?.message || 'לא נמצא מסלול';
    throw new Error(message);
  }

  const data = await response.json();
  return parseRoutes(data, travelMode, t);
}

import type { RouteOption, TravelMode, LatLng, LatLngBounds } from '../types';
import { reportError } from './errorReportingService';
import { translations } from '../i18n/translations';
import type { TranslationKey } from '../i18n/translations';
import { resilientFetch } from './fetchClient';
import type { ServiceResult } from './serviceResult';

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
  if (!routes || routes.length === 0) throw new Error(t('error.routeNotFound'));

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

interface AlternativeParams {
  target_count: number;
  share_factor: number;
  weight_factor: number;
}

interface OrsRoutesResponse {
  routes?: Array<{ geometry: string; summary: { duration: number; distance: number } }>;
  error?: { message?: string };
}

async function fetchRoutes(
  origin: LatLng,
  destination: LatLng,
  profile: string,
  apiKey: string,
  alternativeParams?: AlternativeParams
): Promise<ServiceResult<OrsRoutesResponse>> {
  const body: Record<string, unknown> = {
    coordinates: [
      [origin.lng, origin.lat],
      [destination.lng, destination.lat],
    ],
    preference: 'fastest',
  };

  if (alternativeParams) {
    body.alternative_routes = alternativeParams;
  }

  // retries: 1 handles transient network errors (e.g. Safari 18+ keep-alive bug)
  // HTTP errors are NOT retried here — the ALTERNATIVE_STRATEGIES loop handles fallback
  return resilientFetch<OrsRoutesResponse>(`${ORS_API}/${profile}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiKey,
    },
    body: JSON.stringify(body),
  }, {
    timeout: 30000,
    retries: 1,
    retryDelay: 1000,
  });
}

// Graduated fallback: try progressively relaxed alternative params before giving up
const ALTERNATIVE_STRATEGIES: (AlternativeParams | undefined)[] = [
  { target_count: 3, share_factor: 0.8, weight_factor: 2.0 },
  { target_count: 2, share_factor: 0.9, weight_factor: 1.5 },
  undefined, // single route, no alternatives
];

export async function computeRoutes(
  origin: LatLng,
  destination: LatLng,
  travelMode: TravelMode,
  t: TranslateFn = defaultT
): Promise<RouteOption[]> {
  const profile = PROFILE_MAP[travelMode];
  const apiKey = import.meta.env.VITE_ORS_API_KEY;

  let successResult: OrsRoutesResponse | null = null;
  let lastErrorMessage: string | null = null;

  for (const strategy of ALTERNATIVE_STRATEGIES) {
    const label = strategy ? `alternatives(target=${strategy.target_count},share=${strategy.share_factor})` : 'single route';

    const result = await fetchRoutes(origin, destination, profile, apiKey, strategy);

    if (!result.ok) {
      if (result.error.code === 'HTTP') {
        lastErrorMessage = result.error.message;
      }
      console.warn(`[RouteService] ${result.error.code} error with ${label}:`, result.error.message);
      continue;
    }

    // Success
    successResult = result.data;
    if (strategy) {
      console.info(`[RouteService] Got response with ${label}`);
    }
    break;
  }

  if (!successResult) {
    reportError('route-api', 'All route strategies failed', lastErrorMessage || 'unknown error');
    throw new Error(lastErrorMessage || t('error.networkError'));
  }

  const routes = parseRoutes(successResult, travelMode, t);

  console.info(`[RouteService] Received ${routes.length} route(s) from ORS`);

  // Sort routes by duration (fastest first) — matches Google Maps behavior
  routes.sort((a, b) => a.durationSeconds - b.durationSeconds);

  // Mark the fastest route
  if (routes.length > 0) {
    routes[0].isFastest = true;
  }

  return routes;
}

/** Lightweight walking route fetch for in-app navigation (no alternatives, no retries). */
export async function computeWalkingRoute(
  origin: LatLng,
  destination: LatLng
): Promise<{ path: LatLng[]; distanceMeters: number; durationSeconds: number }> {
  const profile = 'foot-walking';
  const apiKey = import.meta.env.VITE_ORS_API_KEY;

  const result = await fetchRoutes(origin, destination, profile, apiKey);

  if (!result.ok) {
    throw new Error(result.error.message ?? 'Walking route request failed');
  }

  const data = result.data;
  const routes = data.routes;
  if (!routes || routes.length === 0) throw new Error('No walking route found');

  const route = routes[0];
  const path = decodePolyline(route.geometry);
  const duration = sanitizeDuration(route.summary.duration, route.summary.distance, 'WALKING');

  return { path, distanceMeters: route.summary.distance, durationSeconds: duration };
}

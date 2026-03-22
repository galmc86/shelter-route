// OREF real-time alert service
// Polls Home Front Command alerts API for active rocket/missile alerts

import { reportError } from './errorReportingService';

export interface OrefAlert {
  id: string;
  cat: string;        // category (e.g., "1" = rockets)
  title: string;      // alert title in Hebrew
  data: string[];     // affected area names
  desc: string;       // description
  alertDate: string;  // ISO timestamp
}

export interface AlertRegion {
  name: string;           // Hebrew region name from OREF
  nameEn: string;         // English name
  lat: number;            // Center latitude
  lng: number;            // Center longitude
  radius: number;         // Radius in km
  timeToShelter: number;  // Seconds to reach shelter
}

// Region mapping - major Israeli cities/areas with their time-to-shelter
// Time-to-shelter varies: 15s near Gaza, 30s in south, 60s center, 90s north
export const ALERT_REGIONS: AlertRegion[] = [
  // South - Gaza envelope (15 seconds)
  { name: 'עוטף עזה', nameEn: 'Gaza Envelope', lat: 31.374, lng: 34.393, radius: 15, timeToShelter: 15 },
  { name: 'שדרות, אשקלון', nameEn: 'Sderot, Ashkelon', lat: 31.525, lng: 34.596, radius: 10, timeToShelter: 15 },
  // South (30 seconds)
  { name: 'אשדוד', nameEn: 'Ashdod', lat: 31.804, lng: 34.655, radius: 8, timeToShelter: 30 },
  { name: 'באר שבע', nameEn: 'Beer Sheva', lat: 31.252, lng: 34.791, radius: 12, timeToShelter: 30 },
  { name: 'קריית גת', nameEn: 'Kiryat Gat', lat: 31.610, lng: 34.764, radius: 8, timeToShelter: 30 },
  // Center (60 seconds)
  { name: 'תל אביב', nameEn: 'Tel Aviv', lat: 32.085, lng: 34.782, radius: 10, timeToShelter: 60 },
  { name: 'רמת גן', nameEn: 'Ramat Gan', lat: 32.082, lng: 34.814, radius: 6, timeToShelter: 60 },
  { name: 'גבעתיים', nameEn: 'Givatayim', lat: 32.072, lng: 34.810, radius: 8, timeToShelter: 60 },
  { name: 'חולון', nameEn: 'Holon', lat: 32.011, lng: 34.773, radius: 6, timeToShelter: 60 },
  { name: 'בת ים', nameEn: 'Bat Yam', lat: 32.017, lng: 34.751, radius: 5, timeToShelter: 60 },
  { name: 'פתח תקווה', nameEn: 'Petah Tikva', lat: 32.087, lng: 34.887, radius: 7, timeToShelter: 60 },
  { name: 'ראשון לציון', nameEn: 'Rishon LeZion', lat: 31.950, lng: 34.800, radius: 8, timeToShelter: 60 },
  { name: 'נתניה', nameEn: 'Netanya', lat: 32.322, lng: 34.854, radius: 8, timeToShelter: 60 },
  { name: 'הרצליה', nameEn: 'Herzliya', lat: 32.162, lng: 34.791, radius: 6, timeToShelter: 60 },
  { name: 'רחובות', nameEn: 'Rehovot', lat: 31.894, lng: 34.811, radius: 6, timeToShelter: 60 },
  { name: 'ירושלים', nameEn: 'Jerusalem', lat: 31.768, lng: 35.214, radius: 12, timeToShelter: 60 },
  { name: 'מודיעין', nameEn: "Modi'in", lat: 31.897, lng: 35.010, radius: 8, timeToShelter: 60 },
  { name: 'יבנה', nameEn: 'Yavne', lat: 31.878, lng: 34.739, radius: 8, timeToShelter: 60 },
  { name: 'לוד', nameEn: 'Lod', lat: 31.951, lng: 34.896, radius: 8, timeToShelter: 60 },
  { name: 'רמלה', nameEn: 'Ramla', lat: 31.929, lng: 34.862, radius: 8, timeToShelter: 60 },
  { name: 'נצרת', nameEn: 'Nazareth', lat: 32.700, lng: 35.303, radius: 10, timeToShelter: 60 },
  { name: 'כרמיאל', nameEn: 'Carmiel', lat: 32.919, lng: 35.304, radius: 10, timeToShelter: 60 },
  { name: 'קריית מוצקין', nameEn: 'Kiryat Motzkin', lat: 32.839, lng: 35.079, radius: 8, timeToShelter: 60 },
  { name: 'קריית ביאליק', nameEn: 'Kiryat Bialik', lat: 32.831, lng: 35.087, radius: 8, timeToShelter: 60 },
  { name: 'טירת כרמל', nameEn: 'Tirat Carmel', lat: 32.767, lng: 34.971, radius: 8, timeToShelter: 60 },
  { name: 'נשר', nameEn: 'Nesher', lat: 32.771, lng: 35.039, radius: 8, timeToShelter: 60 },
  // Center-South (90 seconds)
  { name: 'בית שמש', nameEn: 'Beit Shemesh', lat: 31.747, lng: 34.988, radius: 10, timeToShelter: 90 },
  // Sharon / North-Center (90 seconds)
  { name: 'רעננה', nameEn: "Ra'anana", lat: 32.184, lng: 34.871, radius: 8, timeToShelter: 90 },
  { name: 'כפר סבא', nameEn: 'Kfar Saba', lat: 32.178, lng: 34.908, radius: 8, timeToShelter: 90 },
  { name: 'חדרה', nameEn: 'Hadera', lat: 32.434, lng: 34.920, radius: 10, timeToShelter: 90 },
  { name: 'אור עקיבא', nameEn: 'Or Akiva', lat: 32.507, lng: 34.919, radius: 8, timeToShelter: 90 },
  // North (60-90 seconds)
  { name: 'חיפה', nameEn: 'Haifa', lat: 32.794, lng: 34.990, radius: 10, timeToShelter: 60 },
  { name: 'עכו', nameEn: 'Akko', lat: 32.927, lng: 35.084, radius: 6, timeToShelter: 60 },
  { name: 'נהריה', nameEn: 'Nahariya', lat: 33.005, lng: 35.098, radius: 6, timeToShelter: 30 },
  { name: 'קריית שמונה', nameEn: 'Kiryat Shmona', lat: 33.208, lng: 35.573, radius: 8, timeToShelter: 15 },
  { name: 'צפת', nameEn: 'Safed', lat: 32.965, lng: 35.496, radius: 8, timeToShelter: 30 },
  { name: 'טבריה', nameEn: 'Tiberias', lat: 32.796, lng: 35.530, radius: 8, timeToShelter: 60 },
  { name: 'עפולה', nameEn: 'Afula', lat: 32.607, lng: 35.289, radius: 10, timeToShelter: 90 },
  { name: 'יקנעם', nameEn: 'Yokneam', lat: 32.659, lng: 35.109, radius: 8, timeToShelter: 90 },
  // South - Negev (90 seconds)
  { name: 'אילת', nameEn: 'Eilat', lat: 29.558, lng: 34.952, radius: 15, timeToShelter: 90 },
  { name: 'ערד', nameEn: 'Arad', lat: 31.261, lng: 35.213, radius: 8, timeToShelter: 90 },
  { name: 'דימונה', nameEn: 'Dimona', lat: 31.068, lng: 35.033, radius: 10, timeToShelter: 90 },
];

// Default time-to-shelter if region not found
const DEFAULT_TIME_TO_SHELTER = 90;

// Normalize a string for comparison: trim whitespace and lowercase
function normalizeForMatch(s: string): string {
  return s.trim().toLowerCase();
}

// Check if an area name matches a region name using exact match first, then substring fallback
function areaMatchesRegion(area: string, regionName: string): boolean {
  const normalizedArea = normalizeForMatch(area);
  const normalizedRegion = normalizeForMatch(regionName);

  // Exact match first
  if (normalizedArea === normalizedRegion) return true;

  // Substring fallback: check if one contains the other
  return normalizedRegion.includes(normalizedArea) || normalizedArea.includes(normalizedRegion);
}

// Check if user is in an alerted region based on coordinates.
// Returns a matching AlertRegion if the user is within a known region's radius,
// or a generic fallback region with DEFAULT_TIME_TO_SHELTER if alerts are active
// but no specific region matches the user's location.
export function matchUserToAlertRegion(
  userLat: number,
  userLng: number,
  alertedAreas: string[]
): AlertRegion | null {
  for (const region of ALERT_REGIONS) {
    // Check if any alerted area name matches this region
    const isAlerted = alertedAreas.some(area => areaMatchesRegion(area, region.name));
    if (!isAlerted) continue;

    // Check if user is within region radius (rough check using haversine)
    const distance = haversineKm(userLat, userLng, region.lat, region.lng);
    if (distance <= region.radius) {
      return region;
    }
  }

  // Fallback: alerts are active but user doesn't match any specific region.
  // Return a generic alert so the user is still warned.
  if (alertedAreas.length > 0) {
    return {
      name: 'כללי',
      nameEn: 'General Alert',
      lat: userLat,
      lng: userLng,
      radius: 0,
      timeToShelter: DEFAULT_TIME_TO_SHELTER,
    };
  }

  return null;
}

// Simple haversine for km distance
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Get time-to-shelter for a location
export function getTimeToShelter(lat: number, lng: number): number {
  let closest: AlertRegion | null = null;
  let minDist = Infinity;

  for (const region of ALERT_REGIONS) {
    const dist = haversineKm(lat, lng, region.lat, region.lng);
    if (dist < minDist) {
      minDist = dist;
      closest = region;
    }
  }

  return closest && minDist <= closest.radius * 2
    ? closest.timeToShelter
    : DEFAULT_TIME_TO_SHELTER;
}

export type AlertCallback = (alerts: OrefAlert[], matchedRegion: AlertRegion | null) => void;

export type AlertHealthStatus = 'connected' | 'degraded' | 'reconnecting';
export type HealthStatusCallback = (status: AlertHealthStatus) => void;

// The OREF alerts API URL. Set VITE_OREF_PROXY_URL env var to a CORS proxy
// (e.g., a Cloudflare Worker) for production use.
// Direct access to oref.org.il is blocked by CORS in browsers.
const OREF_ALERTS_URL = import.meta.env.VITE_OREF_PROXY_URL as string | undefined;

// Exponential backoff constants
const BASE_BACKOFF_MS = 5000;
const MAX_BACKOFF_MS = 60000;

// Module-level health status for getAlertHealthStatus()
let currentHealthStatus: AlertHealthStatus = 'connected';

export function getAlertHealthStatus(): AlertHealthStatus {
  return currentHealthStatus;
}

// Poll OREF alerts - returns cleanup function
// Requires VITE_OREF_PROXY_URL to be set. Without a proxy, OREF blocks CORS
// and every request fails — flooding the console with 503 errors from the SW.
export function subscribeToAlerts(
  userLat: number | null,
  userLng: number | null,
  callback: AlertCallback,
  intervalMs: number = 5000,
  healthStatusCallback?: HealthStatusCallback
): () => void {
  // No proxy configured — don't poll at all to avoid CORS error spam
  if (!OREF_ALERTS_URL) {
    return () => {};
  }

  let active = true;
  let consecutiveFailures = 0;
  let currentBackoffMs = intervalMs;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const updateHealthStatus = (status: AlertHealthStatus) => {
    currentHealthStatus = status;
    healthStatusCallback?.(status);
  };

  const scheduleNext = () => {
    if (!active) return;
    timeoutId = setTimeout(() => {
      checkAlerts().then(scheduleNext);
    }, currentBackoffMs);
  };

  const checkAlerts = async () => {
    if (!active) return;

    try {
      const response = await fetch(OREF_ALERTS_URL);

      if (!response.ok) {
        reportError('alert-polling', `HTTP ${response.status} from OREF proxy`);
        consecutiveFailures++;
        applyBackoff();
        return;
      }

      // Success — reset backoff and failures
      consecutiveFailures = 0;
      currentBackoffMs = intervalMs;
      updateHealthStatus('connected');

      const text = await response.text();
      if (!text || text.trim() === '') {
        callback([], null);
        return;
      }

      const alerts: OrefAlert[] = JSON.parse(text);

      if (alerts.length === 0) {
        callback([], null);
        return;
      }

      // Match user location to alerted regions
      let matchedRegion: AlertRegion | null = null;
      if (userLat !== null && userLng !== null) {
        const allAreas = alerts.flatMap(a => a.data);
        matchedRegion = matchUserToAlertRegion(userLat, userLng, allAreas);
      }

      callback(alerts, matchedRegion);
    } catch (err) {
      reportError('alert-polling', 'Network error polling OREF alerts', String(err));
      consecutiveFailures++;
      applyBackoff();
    }
  };

  const applyBackoff = () => {
    // Exponential backoff: BASE_BACKOFF_MS * 2^(failures-1), capped at MAX_BACKOFF_MS
    currentBackoffMs = Math.min(
      BASE_BACKOFF_MS * Math.pow(2, consecutiveFailures - 1),
      MAX_BACKOFF_MS
    );

    if (consecutiveFailures >= 3) {
      updateHealthStatus('reconnecting');
    } else {
      updateHealthStatus('degraded');
    }
  };

  // Initial poll, then schedule subsequent polls
  checkAlerts().then(scheduleNext);

  return () => {
    active = false;
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  };
}

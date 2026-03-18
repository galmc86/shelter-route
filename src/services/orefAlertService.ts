// OREF real-time alert service
// Polls Home Front Command alerts API for active rocket/missile alerts

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
const ALERT_REGIONS: AlertRegion[] = [
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
  { name: 'חולון', nameEn: 'Holon', lat: 32.011, lng: 34.773, radius: 6, timeToShelter: 60 },
  { name: 'בת ים', nameEn: 'Bat Yam', lat: 32.017, lng: 34.751, radius: 5, timeToShelter: 60 },
  { name: 'פתח תקווה', nameEn: 'Petah Tikva', lat: 32.087, lng: 34.887, radius: 7, timeToShelter: 60 },
  { name: 'ראשון לציון', nameEn: 'Rishon LeZion', lat: 31.950, lng: 34.800, radius: 8, timeToShelter: 60 },
  { name: 'נתניה', nameEn: 'Netanya', lat: 32.322, lng: 34.854, radius: 8, timeToShelter: 60 },
  { name: 'הרצליה', nameEn: 'Herzliya', lat: 32.162, lng: 34.791, radius: 6, timeToShelter: 60 },
  { name: 'רחובות', nameEn: 'Rehovot', lat: 31.894, lng: 34.811, radius: 6, timeToShelter: 60 },
  { name: 'ירושלים', nameEn: 'Jerusalem', lat: 31.768, lng: 35.214, radius: 12, timeToShelter: 60 },
  { name: 'מודיעין', nameEn: "Modi'in", lat: 31.897, lng: 35.010, radius: 8, timeToShelter: 60 },
  // North (60-90 seconds)
  { name: 'חיפה', nameEn: 'Haifa', lat: 32.794, lng: 34.990, radius: 10, timeToShelter: 60 },
  { name: 'עכו', nameEn: 'Akko', lat: 32.927, lng: 35.084, radius: 6, timeToShelter: 60 },
  { name: 'נהריה', nameEn: 'Nahariya', lat: 33.005, lng: 35.098, radius: 6, timeToShelter: 30 },
  { name: 'קריית שמונה', nameEn: 'Kiryat Shmona', lat: 33.208, lng: 35.573, radius: 8, timeToShelter: 15 },
  { name: 'צפת', nameEn: 'Safed', lat: 32.965, lng: 35.496, radius: 8, timeToShelter: 30 },
  { name: 'טבריה', nameEn: 'Tiberias', lat: 32.796, lng: 35.530, radius: 8, timeToShelter: 60 },
];

// Default time-to-shelter if region not found
const DEFAULT_TIME_TO_SHELTER = 60;

// Check if user is in an alerted region based on coordinates
export function matchUserToAlertRegion(
  userLat: number,
  userLng: number,
  alertedAreas: string[]
): AlertRegion | null {
  for (const region of ALERT_REGIONS) {
    // Check if any alerted area name matches this region
    const isAlerted = alertedAreas.some(area =>
      region.name.includes(area) || area.includes(region.name)
    );
    if (!isAlerted) continue;

    // Check if user is within region radius (rough check using haversine)
    const distance = haversineKm(userLat, userLng, region.lat, region.lng);
    if (distance <= region.radius) {
      return region;
    }
  }
  return null;
}

// Simple haversine for km distance
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
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

// Poll OREF alerts - returns cleanup function
// Note: Direct access to oref.org.il may be blocked by CORS from browsers.
// In production, use a proxy or the community oref-alerts WebSocket API.
export function subscribeToAlerts(
  userLat: number | null,
  userLng: number | null,
  callback: AlertCallback,
  intervalMs: number = 3000
): () => void {
  let active = true;

  const checkAlerts = async () => {
    try {
      // Try fetching from OREF API
      // Note: Direct browser access is blocked by CORS in production.
      // For production use, set up a CORS proxy (e.g., Cloudflare Worker)
      // and update this URL to point to the proxy.
      const response = await fetch('https://www.oref.org.il/WarningMessages/alert/alerts.json', {
        mode: 'cors',
      });

      if (!response.ok) return;

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
    } catch {
      // Silent fail - alerts API may be unavailable
    }
  };

  checkAlerts();
  const interval = setInterval(() => {
    if (active) checkAlerts();
  }, intervalMs);

  return () => {
    active = false;
    clearInterval(interval);
  };
}

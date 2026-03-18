// Google Places API (New) — Autocomplete with session tokens
// Uses the new promise-based API with field-level billing optimization

import type { PlaceResult } from '../types';

// Client-side daily rate limit to prevent runaway API costs
const DAILY_LIMIT = 500; // max autocomplete requests per day per client
const RATE_LIMIT_KEY = 'shelter-route:places-usage';

interface UsageData {
  date: string; // YYYY-MM-DD
  count: number;
}

function getUsage(): UsageData {
  try {
    const raw = localStorage.getItem(RATE_LIMIT_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { date: '', count: 0 };
}

function incrementUsage(): boolean {
  const today = new Date().toISOString().slice(0, 10);
  const usage = getUsage();

  if (usage.date !== today) {
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify({ date: today, count: 1 }));
    return true;
  }

  if (usage.count >= DAILY_LIMIT) {
    return false; // Rate limited
  }

  usage.count++;
  localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(usage));
  return true;
}

let sessionToken: google.maps.places.AutocompleteSessionToken | null = null;

function getSessionToken(): google.maps.places.AutocompleteSessionToken {
  if (!sessionToken) {
    sessionToken = new google.maps.places.AutocompleteSessionToken();
  }
  return sessionToken;
}

/** Reset session token after a place is selected (starts a new billing session) */
export function resetSession(): void {
  sessionToken = null;
}

/** Check if Google Places API (New) is available */
export function isAvailable(): boolean {
  return typeof google !== 'undefined' && !!google.maps?.places?.AutocompleteService;
}

/**
 * Search for places using Google Places Autocomplete.
 * Uses the legacy AutocompleteService for predictions (new Autocomplete widget not yet GA),
 * but uses new Place.fetchFields() for details to get field-level billing.
 */
export async function searchPlaces(
  query: string,
  language: string = 'he'
): Promise<PlaceResult[]> {
  if (!query || query.length < 2) return [];
  if (!isAvailable()) return [];
  if (!incrementUsage()) return []; // Daily rate limit exceeded — fall through to Nominatim

  const service = new google.maps.places.AutocompleteService();
  const token = getSessionToken();

  return new Promise((resolve) => {
    service.getPlacePredictions(
      {
        input: query,
        sessionToken: token,
        componentRestrictions: { country: 'il' },
        language,
        types: ['geocode', 'establishment'],
      },
      (predictions, status) => {
        if (
          status !== google.maps.places.PlacesServiceStatus.OK ||
          !predictions
        ) {
          resolve([]);
          return;
        }

        resolve(
          predictions.slice(0, 5).map((p) => ({
            lat: 0, // Will be filled by getPlaceDetails on selection
            lng: 0,
            displayName: p.description,
            placeId: p.place_id,
          }))
        );
      }
    );
  });
}

/**
 * Get lat/lng details for a place by its placeId.
 * Uses the new Place class with fetchFields() for field-level billing —
 * only pays for the 'location' field (Essentials tier, cheapest).
 */
export async function getPlaceDetails(
  placeId: string
): Promise<{ lat: number; lng: number } | null> {
  if (!isAvailable()) return null;

  try {
    const place = new google.maps.places.Place({ id: placeId });
    await place.fetchFields({ fields: ['location'] });

    // Reset session after details fetch (completes the billing session)
    resetSession();

    const loc = place.location;
    if (!loc) return null;

    return {
      lat: loc.lat(),
      lng: loc.lng(),
    };
  } catch {
    resetSession();
    return null;
  }
}

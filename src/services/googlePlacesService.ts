import type { PlaceResult } from '../types';

let autocompleteService: google.maps.places.AutocompleteService | null = null;
let placesService: google.maps.places.PlacesService | null = null;
let sessionToken: google.maps.places.AutocompleteSessionToken | null = null;
let placesDiv: HTMLDivElement | null = null;

function getAutocompleteService(): google.maps.places.AutocompleteService {
  if (!autocompleteService) {
    autocompleteService = new google.maps.places.AutocompleteService();
  }
  return autocompleteService;
}

function getPlacesService(): google.maps.places.PlacesService {
  if (!placesService) {
    // PlacesService requires a DOM element or map — use a hidden div
    if (!placesDiv) {
      placesDiv = document.createElement('div');
    }
    placesService = new google.maps.places.PlacesService(placesDiv);
  }
  return placesService;
}

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

/** Check if Google Places API is available in the window */
export function isAvailable(): boolean {
  return typeof google !== 'undefined' && !!google.maps?.places;
}

/**
 * Search for places using Google Places Autocomplete.
 * Returns results in the same PlaceResult format as Nominatim.
 * Note: Results include placeId but lat/lng are 0,0 until getPlaceDetails is called.
 */
export async function searchPlaces(
  query: string,
  language: string = 'he'
): Promise<PlaceResult[]> {
  if (!query || query.length < 2) return [];
  if (!isAvailable()) return [];

  const service = getAutocompleteService();
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
 * Uses the same session token as the autocomplete request for billing efficiency.
 */
export async function getPlaceDetails(
  placeId: string
): Promise<{ lat: number; lng: number } | null> {
  if (!isAvailable()) return null;

  const service = getPlacesService();
  const token = getSessionToken();

  return new Promise((resolve) => {
    service.getDetails(
      {
        placeId,
        fields: ['geometry'],
        sessionToken: token,
      },
      (place, status) => {
        // Reset session after details fetch (completes the billing session)
        resetSession();

        if (
          status !== google.maps.places.PlacesServiceStatus.OK ||
          !place?.geometry?.location
        ) {
          resolve(null);
          return;
        }

        resolve({
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        });
      }
    );
  });
}

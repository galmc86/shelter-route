/**
 * URL classification functions for the service worker fetch handler.
 *
 * These are pure functions that accept a URL string and return a boolean.
 * They mirror the logic in public/sw.js and are importable in tests.
 */

/** Map tile requests (OpenStreetMap and similar tile servers). */
export function isTileRequest(url: string): boolean {
  return (
    /^https?:\/\/[a-c]\.tile\.openstreetmap\.org\//.test(url) ||
    /^https?:\/\/.*\.tile\./.test(url)
  );
}

/** Third-party API requests (routing, geocoding, places). */
export function isAPIRequest(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === 'api.openrouteservice.org' ||
      parsed.hostname === 'nominatim.openstreetmap.org' ||
      parsed.hostname === 'maps.googleapis.com' ||
      parsed.hostname === 'places.googleapis.com'
    );
  } catch {
    return false;
  }
}

/** Static assets (JS, CSS, images, fonts, etc.) — excludes shelters.json. */
export function isStaticAsset(url: string): boolean {
  if (isSheltersData(url)) return false;
  try {
    const parsed = new URL(url);
    return /\.(js|css|svg|png|jpg|jpeg|gif|ico|woff|woff2|ttf|eot|json)(\?.*)?$/.test(
      parsed.pathname,
    );
  } catch {
    return false;
  }
}

/** Shelter data file — should use network-first strategy. */
export function isSheltersData(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.pathname.endsWith('/shelters.json') || parsed.pathname === '/shelters.json';
  } catch {
    return false;
  }
}

/** OREF proxy URLs (real-time alert data) — should be network-only. */
export function isOrefProxy(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes('workers.dev');
  } catch {
    return false;
  }
}

# Shelter Finder

A Progressive Web App (PWA) for finding nearby bomb shelters in Israel with route planning and real-time OREF (Home Front Command) alert integration.

## Features

- **Route-based shelter search** -- plan a walking, biking, or driving route and see shelters along the way
- **Nearest shelter mode** -- find the closest shelters to your current location
- **Emergency mode** -- triggered manually or automatically via real-time OREF rocket alert integration
- **Multiple route alternatives** -- compare routes ranked by travel time and shelter coverage
- **Offline support** -- service worker caches shelter data and app shell for use without connectivity
- **Bilingual UI** -- Hebrew (RTL) and English (LTR) with full i18n support
- **Dark / light theme**

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | React 19, TypeScript 5.9 |
| Build | Vite 8 |
| Maps | Leaflet, leaflet.markercluster |
| Routing | OpenRouteService API |
| Places autocomplete | Google Maps Places API |
| Alerts proxy | Cloudflare Worker (`workers/oref-proxy/`) |
| Family sync backend | Cloudflare Worker + KV (`workers/family-sync/`) |
| Testing | Vitest, Testing Library |

## Prerequisites

- Node.js 18+
- npm

## Environment Variables

Create a `.env` file in the project root:

```env
VITE_ORS_API_KEY=<your OpenRouteService API key>
VITE_GOOGLE_MAPS_API_KEY=<your Google Maps API key for Places autocomplete>
VITE_OREF_PROXY_URL=<URL of the deployed oref-proxy Cloudflare Worker>
VITE_FAMILY_REMOTE_URL=<URL of the deployed family-sync Cloudflare Worker>
```

- **VITE_ORS_API_KEY** -- required. Get a free key at https://openrouteservice.org/
- **VITE_GOOGLE_MAPS_API_KEY** -- required for address autocomplete. Enable the Places API in Google Cloud Console.
- **VITE_OREF_PROXY_URL** -- URL of the Cloudflare Worker that proxies OREF alert requests (avoids CORS issues).
- **VITE_FAMILY_REMOTE_URL** -- URL of the Cloudflare Worker that stores and serves family group records for cross-device sync.

## Development

```bash
npm install        # install dependencies
npm run dev        # start Vite dev server (http://localhost:5173)
npm run test       # run tests in watch mode
npm run test:run   # run tests once
npm run lint       # lint with ESLint
npm run build      # type-check + production build
npm run preview    # preview production build locally
npm run data:verify # verify public/shelters.json and raw KMZ source integrity
npm run data:rebuild -- --dry-run data/miklat-isr.kmz # validate rebuild behavior without writing
```

## Project Structure

```
src/
  components/    # React UI components (MapView, SearchPanel, AlertBanner, etc.)
  hooks/         # Custom React hooks (useAppController, useRoute, useOrefAlerts, etc.)
  services/      # API clients and data services (routing, shelters, alerts, geocoding)
  utils/         # Pure utility functions (geometry, distance calculations)
  sw/            # Service worker request classifiers and caching logic
workers/
  oref-proxy/    # Cloudflare Worker that proxies OREF Home Front Command alert API
  family-sync/   # Cloudflare Worker that stores family sync group records in KV
public/
  shelters.json  # Shelter coordinate dataset served as a static asset
  sw.js          # Service worker entry point
  manifest.json  # PWA manifest
data/
  *.kmz          # Raw shelter data source files (see data/README.md)
```

## Shelter Data Workflow

- `public/shelters.json` is the current supported runtime dataset.
- Run `npm run data:verify` before shipping data changes. It validates `public/shelters.json`, prints the current dataset hash used for cache-busting, and checks whether the checked-in `.kmz` files are real KMZ archives.
- `npm run data:rebuild` is now the supported rebuild entry point for valid KMZ inputs. It preserves stable shelter IDs when rebuilt shelters still match the current dataset and supports `--dry-run` plus `--merge-existing`.
- `npm run data:probe-tlv`, `npm run data:import-tlv-candidate`, `npm run data:diff-tlv-candidate`, and `npm run data:reconcile-tlv` are non-destructive Tel Aviv analysis tools. They query the live municipal ArcGIS source, write candidate files under `tmp/`, and generate a reconciliation report plus a phase-1 review-only full dataset candidate. The reconciliation step separates `safe_move` records from `safe_enrich` records so coordinate changes stay conservative.
- A full raw-data rebuild is currently blocked because the checked-in files under [`/Users/gal.machluf/projects/shelter-finder/data`](/Users/gal.machluf/projects/shelter-finder/data) are invalid HTML responses rather than KMZ binaries. Replace those files with real KMZ archives before attempting to reconstruct `public/shelters.json`.
- Partial rebuild semantics are explicit:
  - without `--merge-existing`, only rebuilt KMZ-derived shelters are written
  - with `--merge-existing`, untouched shelters from the current dataset are preserved verbatim
- The production build now fails if `public/shelters.json` cannot be read, so dataset versioning stays deterministic.

## Deployment

The app is deployed to **Cloudflare Pages** at `https://shelter-route.pages.dev`.

- The OREF alert proxy worker is deployed separately via `wrangler` from `workers/oref-proxy/`.
- The family sync worker is deployed separately via `wrangler` from `workers/family-sync/`.
- Shelter data (`public/shelters.json`) is cache-busted at build time using a content hash injected via `__SHELTER_DATA_VERSION__`.

## License

Private project.

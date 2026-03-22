# Shelter Data

## shelters.json

The main shelter dataset lives at `public/shelters.json` and is served as a static asset. It contains an array of shelter objects, each with:

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Unique identifier |
| `name` | string | Display name (e.g. "Shelter 1") |
| `lat` | number | Latitude |
| `lng` | number | Longitude |
| `description` | string | Neighborhood or area name (Hebrew) |
| `source` | string | Original KMZ filename this entry came from |
| `sources` | string[] | All KMZ files containing this shelter |

## Data Pipeline

1. **Source files** -- KMZ files containing shelter placemarks are placed in this `data/` directory.
2. **Processing** -- coordinates and metadata are extracted from the KMZ placemarks and converted into the JSON format above, producing `public/shelters.json`.
3. **Cache-busting** -- at build time, Vite computes an MD5 content hash of `shelters.json` and injects it as `__SHELTER_DATA_VERSION__`. The app appends this hash as a query parameter when fetching the file, ensuring browsers pick up new data after updates.

## Client-side Caching

The app caches shelter data in `localStorage` under the key `shelter-route:shelters` with a version number (`STORAGE_VERSION`). When `STORAGE_VERSION` is bumped in `src/services/shelterApi.ts`, the cached data is discarded and re-fetched. The service worker also caches `shelters.json` requests for offline use.

## Known Issues

The two KMZ files currently in this directory are **not valid KMZ archives**:

```
$ file data/miklat-isr.kmz
data/miklat-isr.kmz: HTML document text, Unicode text, UTF-8 text

$ file data/miklat-tlv.kmz
data/miklat-tlv.kmz: HTML document text, Unicode text, UTF-8 text
```

Both files are HTML documents rather than the expected ZIP-compressed KML. They were likely downloaded from a source that returned an HTML page (e.g. a login wall or redirect) instead of the actual KMZ binary. These files cannot be processed as-is; valid KMZ files would need to be re-downloaded from the original data source.

The shelter data currently in `public/shelters.json` was generated from a valid KMZ snapshot (`miklat-isr-2026-03-06.kmz`) that is no longer present in this directory.

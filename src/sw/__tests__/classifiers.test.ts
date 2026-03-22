import { describe, it, expect } from 'vitest';
import {
  isTileRequest,
  isAPIRequest,
  isStaticAsset,
  isSheltersData,
  isOrefProxy,
} from '../classifiers';

describe('isTileRequest', () => {
  it('matches OpenStreetMap tile URLs', () => {
    expect(isTileRequest('https://a.tile.openstreetmap.org/12/345/678.png')).toBe(true);
    expect(isTileRequest('https://b.tile.openstreetmap.org/10/100/200.png')).toBe(true);
    expect(isTileRequest('https://c.tile.openstreetmap.org/5/10/20.png')).toBe(true);
  });

  it('matches generic tile server URLs', () => {
    expect(isTileRequest('https://maps.tile.example.com/tiles/1/2/3.png')).toBe(true);
  });

  it('rejects non-tile URLs', () => {
    expect(isTileRequest('https://example.com/page')).toBe(false);
    expect(isTileRequest('https://api.openrouteservice.org/v2/directions')).toBe(false);
  });
});

describe('isAPIRequest', () => {
  it('matches openrouteservice API', () => {
    expect(isAPIRequest('https://api.openrouteservice.org/v2/directions/driving-car')).toBe(true);
  });

  it('matches nominatim API', () => {
    expect(isAPIRequest('https://nominatim.openstreetmap.org/search?q=test')).toBe(true);
  });

  it('matches Google Maps API', () => {
    expect(isAPIRequest('https://maps.googleapis.com/maps/api/js')).toBe(true);
  });

  it('matches Google Places API', () => {
    expect(isAPIRequest('https://places.googleapis.com/v1/places')).toBe(true);
  });

  it('rejects non-API URLs', () => {
    expect(isAPIRequest('https://example.com/api/data')).toBe(false);
    expect(isAPIRequest('https://a.tile.openstreetmap.org/12/345/678.png')).toBe(false);
  });
});

describe('isSheltersData', () => {
  it('matches /shelters.json', () => {
    expect(isSheltersData('https://example.com/shelters.json')).toBe(true);
  });

  it('matches shelters.json at root', () => {
    expect(isSheltersData('http://localhost:3000/shelters.json')).toBe(true);
  });

  it('matches shelters.json in subdirectory', () => {
    expect(isSheltersData('https://example.com/data/shelters.json')).toBe(true);
  });

  it('rejects other JSON files', () => {
    expect(isSheltersData('https://example.com/manifest.json')).toBe(false);
    expect(isSheltersData('https://example.com/data.json')).toBe(false);
  });

  it('rejects non-json files with shelters in name', () => {
    expect(isSheltersData('https://example.com/shelters.js')).toBe(false);
  });
});

describe('isStaticAsset', () => {
  it('matches JS files', () => {
    expect(isStaticAsset('https://example.com/assets/main.js')).toBe(true);
  });

  it('matches CSS files', () => {
    expect(isStaticAsset('https://example.com/assets/style.css')).toBe(true);
  });

  it('matches image files', () => {
    expect(isStaticAsset('https://example.com/logo.png')).toBe(true);
    expect(isStaticAsset('https://example.com/photo.jpg')).toBe(true);
    expect(isStaticAsset('https://example.com/icon.svg')).toBe(true);
  });

  it('matches font files', () => {
    expect(isStaticAsset('https://example.com/font.woff2')).toBe(true);
    expect(isStaticAsset('https://example.com/font.ttf')).toBe(true);
  });

  it('matches regular JSON files', () => {
    expect(isStaticAsset('https://example.com/manifest.json')).toBe(true);
  });

  it('excludes shelters.json', () => {
    expect(isStaticAsset('https://example.com/shelters.json')).toBe(false);
    expect(isStaticAsset('http://localhost:3000/shelters.json')).toBe(false);
  });

  it('matches files with query strings', () => {
    expect(isStaticAsset('https://example.com/main.js?v=123')).toBe(true);
  });

  it('rejects non-asset URLs', () => {
    expect(isStaticAsset('https://example.com/api/data')).toBe(false);
    expect(isStaticAsset('https://example.com/')).toBe(false);
  });
});

describe('isOrefProxy', () => {
  it('matches workers.dev URLs', () => {
    expect(isOrefProxy('https://oref-proxy.my-worker.workers.dev/alerts')).toBe(true);
    expect(isOrefProxy('https://something.workers.dev/api/alerts')).toBe(true);
  });

  it('matches workers.dev subdomains', () => {
    expect(isOrefProxy('https://alert-proxy.username.workers.dev/')).toBe(true);
  });

  it('rejects non-proxy URLs', () => {
    expect(isOrefProxy('https://example.com/alerts')).toBe(false);
    expect(isOrefProxy('https://api.openrouteservice.org/v2/directions')).toBe(false);
  });
});

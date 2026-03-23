import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
  parseTagValue: false,
});

interface PlacemarkNode {
  name?: string;
  description?: string;
  [key: string]: unknown;
}

export interface ParsedPlacemark {
  name: string;
  description?: string;
  lat: number;
  lng: number;
}

function isZipArchive(buffer: Buffer): boolean {
  return ZIP_MAGIC.every((byte, index) => buffer[index] === byte);
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function findCoordinateText(node: unknown): string | null {
  if (!node || typeof node !== 'object') {
    return null;
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === 'coordinates' && typeof value === 'string' && value.trim()) {
      return value;
    }
    const nested = findCoordinateText(value);
    if (nested) {
      return nested;
    }
  }

  return null;
}

function collectPlacemarkNodes(node: unknown, acc: PlacemarkNode[]): void {
  if (!node || typeof node !== 'object') {
    return;
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === 'Placemark') {
      acc.push(...asArray(value as PlacemarkNode | PlacemarkNode[]));
      continue;
    }
    collectPlacemarkNodes(value, acc);
  }
}

function parseCoordinatePair(text: string): { lat: number; lng: number } | null {
  const firstTuple = text.trim().split(/\s+/)[0];
  const [lngRaw, latRaw] = firstTuple.split(',');
  const lat = Number.parseFloat(latRaw);
  const lng = Number.parseFloat(lngRaw);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return { lat, lng };
}

export async function extractKml(buffer: Buffer): Promise<string> {
  if (!isZipArchive(buffer)) {
    throw new Error('Input is not a valid KMZ archive');
  }

  const archive = await JSZip.loadAsync(buffer);
  const entry = Object.values(archive.files).find((file) => !file.dir && file.name.toLowerCase().endsWith('.kml'));

  if (!entry) {
    throw new Error('KMZ archive does not contain a .kml file');
  }

  return entry.async('string');
}

export function parseKmlPlacemarks(kml: string): ParsedPlacemark[] {
  const parsed = xmlParser.parse(kml);
  const placemarkNodes: PlacemarkNode[] = [];
  collectPlacemarkNodes(parsed, placemarkNodes);

  return placemarkNodes.flatMap((placemark) => {
    const coordinateText = findCoordinateText(placemark);
    if (!coordinateText) {
      return [];
    }

    const coordinates = parseCoordinatePair(coordinateText);
    if (!coordinates) {
      return [];
    }

    return [{
      name: typeof placemark.name === 'string' ? placemark.name : '',
      description: typeof placemark.description === 'string' ? placemark.description : undefined,
      lat: coordinates.lat,
      lng: coordinates.lng,
    }];
  });
}

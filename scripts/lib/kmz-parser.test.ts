import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { extractKml, parseKmlPlacemarks } from './kmz-parser';

function wrapKml(inner: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
  <kml xmlns="http://www.opengis.net/kml/2.2">
    <Document>
      ${inner}
    </Document>
  </kml>`;
}

describe('kmz-parser', () => {
  it('parses placemarks from minimal KML', () => {
    const kml = wrapKml(`
      <Placemark>
        <name>Shelter A</name>
        <description>Desc A</description>
        <Point>
          <coordinates>34.7818,32.0853,0</coordinates>
        </Point>
      </Placemark>
      <Placemark>
        <name>Shelter B</name>
        <Point>
          <coordinates>35.2137,31.7683,0</coordinates>
        </Point>
      </Placemark>
    `);

    expect(parseKmlPlacemarks(kml)).toEqual([
      {
        name: 'Shelter A',
        description: 'Desc A',
        lat: 32.0853,
        lng: 34.7818,
      },
      {
        name: 'Shelter B',
        description: undefined,
        lat: 31.7683,
        lng: 35.2137,
      },
    ]);
  });

  it('parses placemarks nested inside folders', () => {
    const kml = wrapKml(`
      <Folder>
        <name>Outer</name>
        <Folder>
          <name>Inner</name>
          <Placemark>
            <name>Nested Shelter</name>
            <description>Nested</description>
            <Point>
              <coordinates>34.8,32.1,0</coordinates>
            </Point>
          </Placemark>
        </Folder>
      </Folder>
    `);

    expect(parseKmlPlacemarks(kml)).toEqual([
      {
        name: 'Nested Shelter',
        description: 'Nested',
        lat: 32.1,
        lng: 34.8,
      },
    ]);
  });

  it('skips placemarks without valid coordinates', () => {
    const kml = wrapKml(`
      <Placemark>
        <name>No Coords</name>
      </Placemark>
      <Placemark>
        <name>Bad Coords</name>
        <Point>
          <coordinates>not-a-number,still-bad,0</coordinates>
        </Point>
      </Placemark>
    `);

    expect(parseKmlPlacemarks(kml)).toEqual([]);
  });

  it('rejects non-ZIP buffers', async () => {
    await expect(extractKml(Buffer.from('<!DOCTYPE html>'))).rejects.toThrow(
      'Input is not a valid KMZ archive'
    );
  });

  it('extracts the first .kml file from a generated ZIP archive', async () => {
    const archive = new JSZip();
    archive.file('doc.kml', wrapKml(`
      <Placemark>
        <name>Archived Shelter</name>
        <Point>
          <coordinates>34.9,32.2,0</coordinates>
        </Point>
      </Placemark>
    `));
    archive.file('notes.txt', 'ignored');

    const buffer = await archive.generateAsync({ type: 'nodebuffer' });
    const kml = await extractKml(buffer);

    expect(parseKmlPlacemarks(kml)).toEqual([
      {
        name: 'Archived Shelter',
        description: undefined,
        lat: 32.2,
        lng: 34.9,
      },
    ]);
  });
});

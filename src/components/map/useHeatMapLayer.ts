import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import L from 'leaflet';
import type { Language, TranslationKey } from '../../i18n';
import { translations } from '../../i18n/translations';
import { getHeatMapData, type GeocodedAlert, type HeatMapCell } from '../../services/alertHistoryService';

function tRaw(lang: Language, key: TranslationKey): string {
  return translations[lang][key] ?? key;
}

function heatMapCellStyle(intensity: number): { color: string; fillOpacity: number } {
  if (intensity >= 0.66) return { color: '#D32F2F', fillOpacity: 0.6 };
  if (intensity >= 0.33) return { color: '#F57C00', fillOpacity: 0.4 };
  return { color: '#FBC02D', fillOpacity: 0.2 };
}

function heatMapRadius(zoom: number): number {
  if (zoom >= 14) return 30;
  if (zoom >= 12) return 22;
  if (zoom >= 10) return 16;
  return 10;
}

interface UseHeatMapLayerArgs {
  mapRef: MutableRefObject<L.Map | null>;
  language: Language;
  geocodedAlerts: GeocodedAlert[];
}

export function useHeatMapLayer({ mapRef, language, geocodedAlerts }: UseHeatMapLayerArgs) {
  const heatMapLayerRef = useRef<L.LayerGroup | null>(null);
  const heatMapControlRef = useRef<L.Control | null>(null);
  const heatMapLegendRef = useRef<L.Control | null>(null);
  const [heatMapVisible, setHeatMapVisible] = useState(false);

  const toggleHeatMap = useCallback(() => {
    setHeatMapVisible((prev) => !prev);
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (heatMapControlRef.current) {
      map.removeControl(heatMapControlRef.current);
      heatMapControlRef.current = null;
    }

    const dir = language === 'en' || language === 'ru' ? 'ltr' : 'rtl';
    const HeatMapToggle = L.Control.extend({
      onAdd() {
        const container = L.DomUtil.create('div', 'heatmap-toggle-control');
        container.setAttribute('dir', dir);
        L.DomEvent.disableClickPropagation(container);

        const button = document.createElement('button');
        button.className = 'heatmap-toggle-btn' + (heatMapVisible ? ' heatmap-toggle-active' : '');
        button.textContent = tRaw(language, 'map.heatMapToggle');
        button.setAttribute('aria-pressed', String(heatMapVisible));
        button.addEventListener('click', toggleHeatMap);
        container.appendChild(button);
        return container;
      },
    });

    heatMapControlRef.current = new HeatMapToggle({ position: 'topright' });
    heatMapControlRef.current.addTo(map);

    return () => {
      if (heatMapControlRef.current) {
        map.removeControl(heatMapControlRef.current);
        heatMapControlRef.current = null;
      }
    };
  }, [heatMapVisible, language, mapRef, toggleHeatMap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (heatMapLayerRef.current) {
      heatMapLayerRef.current.clearLayers();
      map.removeLayer(heatMapLayerRef.current);
      heatMapLayerRef.current = null;
    }
    if (heatMapLegendRef.current) {
      map.removeControl(heatMapLegendRef.current);
      heatMapLegendRef.current = null;
    }

    if (!heatMapVisible || geocodedAlerts.length === 0) return;

    const cells = getHeatMapData(geocodedAlerts);
    if (cells.length === 0) return;

    const layerGroup = L.layerGroup();
    const currentZoom = map.getZoom();

    cells.forEach((cell: HeatMapCell) => {
      const style = heatMapCellStyle(cell.intensity);
      L.circleMarker([cell.lat, cell.lng], {
        radius: heatMapRadius(currentZoom),
        color: style.color,
        fillColor: style.color,
        fillOpacity: style.fillOpacity,
        weight: 1,
        opacity: 0.5,
        pane: 'overlayPane',
      }).addTo(layerGroup);
    });

    layerGroup.addTo(map);
    heatMapLayerRef.current = layerGroup;

    const onZoom = () => {
      const zoom = map.getZoom();
      const radius = heatMapRadius(zoom);
      layerGroup.eachLayer((layer) => {
        if (layer instanceof L.CircleMarker) {
          layer.setRadius(radius);
        }
      });
    };
    map.on('zoomend', onZoom);

    const dir = language === 'en' || language === 'ru' ? 'ltr' : 'rtl';
    const HeatMapLegend = L.Control.extend({
      onAdd() {
        const container = L.DomUtil.create('div', 'heatmap-legend');
        container.setAttribute('dir', dir);
        L.DomEvent.disableClickPropagation(container);

        const title = document.createElement('div');
        title.className = 'heatmap-legend-title';
        title.textContent = tRaw(language, 'map.heatMapLegendTitle');
        container.appendChild(title);

        const items: Array<{ color: string; label: TranslationKey }> = [
          { color: '#D32F2F', label: 'map.heatMapHigh' },
          { color: '#F57C00', label: 'map.heatMapMedium' },
          { color: '#FBC02D', label: 'map.heatMapLow' },
        ];

        items.forEach(({ color, label }) => {
          const row = document.createElement('div');
          row.className = 'heatmap-legend-item';

          const swatch = document.createElement('span');
          swatch.className = 'heatmap-legend-swatch';
          swatch.style.background = color;

          const text = document.createElement('span');
          text.textContent = tRaw(language, label);

          row.appendChild(swatch);
          row.appendChild(text);
          container.appendChild(row);
        });

        return container;
      },
    });

    heatMapLegendRef.current = new HeatMapLegend({ position: 'bottomright' });
    heatMapLegendRef.current.addTo(map);

    return () => {
      map.off('zoomend', onZoom);
      if (heatMapLayerRef.current) {
        heatMapLayerRef.current.clearLayers();
        map.removeLayer(heatMapLayerRef.current);
        heatMapLayerRef.current = null;
      }
      if (heatMapLegendRef.current) {
        map.removeControl(heatMapLegendRef.current);
        heatMapLegendRef.current = null;
      }
    };
  }, [geocodedAlerts, heatMapVisible, language, mapRef]);
}

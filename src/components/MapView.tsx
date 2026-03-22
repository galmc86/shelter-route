import { useEffect, useRef, useState, useCallback } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import './MapView.css';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { useLanguage, LanguageProvider } from '../i18n';
import type { Language, TranslationKey } from '../i18n';
import { translations } from '../i18n/translations';
import { useRouteContext } from '../contexts/RouteContext';
import { useEmergencyContext } from '../contexts/EmergencyContext';
import { useShelterContext } from '../contexts/ShelterContext';
import { useAlertHistory } from '../hooks/useAlertHistory';
import { getHeatMapData, type HeatMapCell } from '../services/alertHistoryService';
import type { RouteOption, LocationPoint } from '../types';
import type { ShelterWithDistance } from '../hooks/useShelters';
import type { CapacityData } from '../services/capacityService';
import { ShelterPopup } from './ShelterPopup';
interface MapViewProps {
  routes?: RouteOption[];
  onSelectRoute?: (index: number) => void;
  userLocation?: LocationPoint | null;
  onMapReady?: (map: L.Map) => void;
  emergencyCountdown?: number;
  navigationRoute?: RouteOption | null;
  navigatingToShelter?: ShelterWithDistance | null;
  onNavigateToShelter?: (shelter: ShelterWithDistance) => void;
}

const ISRAEL_CENTER: L.LatLngExpression = [31.5, 34.8];

// Distinct colors for each route alternative
const ROUTE_COLORS = ['#4285F4', '#00897B', '#F57C00'];

const SHELTER_ICON_SVG = `<svg width="28" height="34" viewBox="0 0 28 34" xmlns="http://www.w3.org/2000/svg">
  <path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 20 14 20s14-9.5 14-20C28 6.3 21.7 0 14 0z" fill="#0D47A1"/>
  <path d="M14 6L8 10v7h4v-4h4v4h4v-7L14 6z" fill="white"/>
</svg>`;

const SELECTED_SHELTER_SVG = `<svg width="36" height="44" viewBox="0 0 36 44" xmlns="http://www.w3.org/2000/svg">
  <circle cx="18" cy="18" r="17" fill="none" stroke="#FF6F00" stroke-width="2" opacity="0.8"/>
  <g transform="translate(4, 5)">
    <path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 20 14 20s14-9.5 14-20C28 6.3 21.7 0 14 0z" fill="#0D47A1"/>
    <path d="M14 6L8 10v7h4v-4h4v4h4v-7L14 6z" fill="white"/>
  </g>
</svg>`;

const USER_LOCATION_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <circle cx="12" cy="12" r="10" fill="#4285F4" opacity="0.2" stroke="#4285F4" stroke-width="2"/>
  <circle cx="12" cy="12" r="5" fill="#4285F4"/>
</svg>`;

const START_MARKER_SVG = `<svg width="28" height="34" viewBox="0 0 28 34" xmlns="http://www.w3.org/2000/svg">
  <path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 20 14 20s14-9.5 14-20C28 6.3 21.7 0 14 0z" fill="#2E7D32"/>
  <circle cx="14" cy="13" r="5" fill="white"/>
</svg>`;

const END_MARKER_SVG = `<svg width="28" height="34" viewBox="0 0 28 34" xmlns="http://www.w3.org/2000/svg">
  <path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 20 14 20s14-9.5 14-20C28 6.3 21.7 0 14 0z" fill="#C62828"/>
  <circle cx="14" cy="13" r="5" fill="white"/>
</svg>`;

const shelterIcon = L.divIcon({
  html: SHELTER_ICON_SVG,
  className: 'shelter-marker-icon',
  iconSize: [28, 34],
  iconAnchor: [14, 34],
  popupAnchor: [0, -34],
});

const selectedShelterIcon = L.divIcon({
  html: SELECTED_SHELTER_SVG,
  className: 'shelter-marker-icon selected',
  iconSize: [36, 44],
  iconAnchor: [18, 44],
  popupAnchor: [0, -44],
});

const userLocationIcon = L.divIcon({
  html: USER_LOCATION_SVG,
  className: 'user-location-icon',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const startMarkerIcon = L.divIcon({
  html: START_MARKER_SVG,
  className: 'route-endpoint-icon',
  iconSize: [28, 34],
  iconAnchor: [14, 34],
  popupAnchor: [0, -34],
});

const endMarkerIcon = L.divIcon({
  html: END_MARKER_SVG,
  className: 'route-endpoint-icon',
  iconSize: [28, 34],
  iconAnchor: [14, 34],
  popupAnchor: [0, -34],
});

function tRaw(lang: Language, key: TranslationKey): string {
  return translations[lang][key] ?? key;
}

/** Map a heat-map cell intensity (0-1) to a color and fill opacity. */
function heatMapCellStyle(intensity: number): { color: string; fillOpacity: number } {
  if (intensity >= 0.66) return { color: '#D32F2F', fillOpacity: 0.6 };
  if (intensity >= 0.33) return { color: '#F57C00', fillOpacity: 0.4 };
  return { color: '#FBC02D', fillOpacity: 0.2 };
}

/** Compute circleMarker radius based on current zoom level. */
function heatMapRadius(zoom: number): number {
  if (zoom >= 14) return 30;
  if (zoom >= 12) return 22;
  if (zoom >= 10) return 16;
  return 10;
}

// Removed: buildShelterPopupHtml — replaced by ShelterPopup React component

/**
 * Wrapper that syncs the language inside the isolated LanguageProvider
 * used for popup React roots.
 */
function ShelterPopupWithLanguage({
  shelter,
  hasRoute,
  capacityData,
  lang,
  onNavigate,
}: {
  shelter: ShelterWithDistance;
  hasRoute: boolean;
  capacityData?: CapacityData;
  lang: Language;
  onNavigate?: (shelter: ShelterWithDistance) => void;
}) {
  const { setLanguage } = useLanguage();
  // Sync language on mount (LanguageProvider defaults to 'he')
  useEffect(() => {
    setLanguage(lang);
  }, [lang, setLanguage]);

  return (
    <ShelterPopup
      shelter={shelter}
      hasRoute={hasRoute}
      capacityData={capacityData}
      onNavigate={onNavigate}
    />
  );
}

function buildUserLocationPopupElement(lang: Language): HTMLElement {
  const dir = lang === 'en' || lang === 'ru' ? 'ltr' : 'rtl';
  const label = tRaw(lang, 'map.yourLocation');
  const wrapper = document.createElement('div');
  wrapper.style.direction = dir;
  wrapper.style.fontFamily = '-apple-system, sans-serif';
  wrapper.style.textAlign = 'center';
  wrapper.style.padding = '4px';
  const strong = document.createElement('strong');
  strong.textContent = label;
  wrapper.appendChild(strong);
  return wrapper;
}

export function MapView({
  routes,
  onSelectRoute,
  userLocation,
  onMapReady,
  emergencyCountdown,
  navigationRoute,
  navigatingToShelter,
  onNavigateToShelter,
}: MapViewProps) {
  const { routeInfo, selectedRouteIndex, nearbyShelters: shelters } = useRouteContext();
  const { emergencyMode } = useEmergencyContext();
  const { isLoaded, selectedShelterId, onShelterClick, capacityMap } = useShelterContext();
  const { language, t } = useLanguage();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const routeLayersRef = useRef<L.Polyline[]>([]);
  const routeMarkersRef = useRef<L.Marker[]>([]);
  const routePickerRef = useRef<L.Control | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);

  const popupRootsRef = useRef<Map<string, Root>>(new Map());
  const isochroneCircleRef = useRef<L.Circle | null>(null);
  const walkingRadiusRef = useRef<number>(0);
  const heatMapLayerRef = useRef<L.LayerGroup | null>(null);
  const heatMapControlRef = useRef<L.Control | null>(null);
  const heatMapLegendRef = useRef<L.Control | null>(null);
  const [heatMapVisible, setHeatMapVisible] = useState(false);
  const navigationLayerRef = useRef<L.Polyline | null>(null);

  // Fetch alert history for heat map (supplementary — tolerates duplicate fetch)
  const { alerts: geocodedAlerts } = useAlertHistory(routeInfo);

  const toggleHeatMap = useCallback(() => {
    setHeatMapVisible((prev) => !prev);
  }, []);

  // Use a ref for onNavigateToShelter so the shelter markers useEffect
  // doesn't re-run (recreating all markers and closing popups) when
  // the callback reference changes due to parent state updates.
  const onNavigateRef = useRef(onNavigateToShelter);
  useEffect(() => {
    onNavigateRef.current = onNavigateToShelter;
  }, [onNavigateToShelter]);

  // Initialize map
  useEffect(() => {
    if (!isLoaded || !mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: ISRAEL_CENTER,
      zoom: 8,
      zoomControl: true,
      rotate: true,
      bearing: 0,
      touchRotate: true,
      shiftKeyRotate: true,
      rotateControl: {
        closeOnZeroBearing: false,
      },
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Custom pane for navigation polyline so it always renders above route polylines
    map.createPane('navigationPane');
    map.getPane('navigationPane')!.style.zIndex = '650';

    mapInstanceRef.current = map;
    onMapReady?.(map);
    markersLayerRef.current = L.markerClusterGroup({
      maxClusterRadius: 40,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<div class="cluster-icon">${count}</div>`,
          className: 'shelter-cluster',
          iconSize: [36, 36],
        });
      },
    }).addTo(map);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
    };
  }, [isLoaded]); // eslint-disable-line react-hooks/exhaustive-deps -- onMapReady is stable (useCallback with no deps), only needs to run on map init

  // Update routes (selected + alternatives)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing route layers
    routeLayersRef.current.forEach((l) => l.remove());
    routeLayersRef.current = [];
    routeMarkersRef.current.forEach((m) => m.remove());
    routeMarkersRef.current = [];
    if (routePickerRef.current) {
      map.removeControl(routePickerRef.current);
      routePickerRef.current = null;
    }

    const routesToRender = routes && routes.length > 0 ? routes : routeInfo ? [routeInfo] : [];
    if (routesToRender.length === 0) return;

    const activeIndex = routes && routes.length > 0 ? selectedRouteIndex : 0;
    const hasAlternatives = routes && routes.length > 1;

    // Render non-selected routes first (so they appear behind)
    routesToRender.forEach((route, index) => {
      if (index === activeIndex) return;
      if (route.path.length < 2) return;

      const color = hasAlternatives ? (ROUTE_COLORS[index] || '#9E9E9E') : '#9E9E9E';
      const latLngs: L.LatLngExpression[] = route.path.map((p) => [p.lat, p.lng]);
      const polyline = L.polyline(latLngs, {
        color,
        weight: 5,
        opacity: 0.5,
        dashArray: '8 6',
      }).addTo(map);

      polyline.on('click', () => {
        onSelectRoute?.(index);
      });

      routeLayersRef.current.push(polyline);
    });

    // Render selected route on top
    const selected = routesToRender[activeIndex];
    if (selected && selected.path.length >= 2) {
      const selectedColor = hasAlternatives ? (ROUTE_COLORS[activeIndex] || '#4285F4') : '#4285F4';
      const latLngs: L.LatLngExpression[] = selected.path.map((p) => [p.lat, p.lng]);
      const polyline = L.polyline(latLngs, {
        color: selectedColor,
        weight: 6,
        opacity: 0.9,
      }).addTo(map);

      routeLayersRef.current.push(polyline);

      const start = selected.path[0];
      const end = selected.path[selected.path.length - 1];

      const startMarker = L.marker([start.lat, start.lng], {
        icon: startMarkerIcon,
        zIndexOffset: 900,
      }).addTo(map);

      const endMarker = L.marker([end.lat, end.lng], {
        icon: endMarkerIcon,
        zIndexOffset: 900,
      }).addTo(map);

      routeMarkersRef.current = [startMarker, endMarker];

      // Add floating route picker overlay when alternatives exist
      if (hasAlternatives) {
        const dir = language === 'en' ? 'ltr' : 'rtl';
        const RoutePicker = L.Control.extend({
          onAdd() {
            const container = L.DomUtil.create('div', 'route-picker-overlay');
            container.setAttribute('dir', dir);
            L.DomEvent.disableClickPropagation(container);
            L.DomEvent.disableScrollPropagation(container);

            routes!.forEach((route, index) => {
              const isActive = index === activeIndex;
              const color = ROUTE_COLORS[index] || '#9E9E9E';

              const btn = document.createElement('button');
              btn.className = 'route-picker-item' + (isActive ? ' route-picker-item-active' : '');

              const colorSpan = document.createElement('span');
              colorSpan.className = 'route-picker-color';
              colorSpan.style.background = color;

              const infoSpan = document.createElement('span');
              infoSpan.className = 'route-picker-info';

              const durationSpan = document.createElement('span');
              durationSpan.className = 'route-picker-duration';
              durationSpan.textContent = route.duration;

              const distanceSpan = document.createElement('span');
              distanceSpan.className = 'route-picker-distance';
              distanceSpan.textContent = route.distance;

              infoSpan.appendChild(durationSpan);
              infoSpan.appendChild(distanceSpan);
              btn.appendChild(colorSpan);
              btn.appendChild(infoSpan);

              if (route.isFastest) {
                const badge = document.createElement('span');
                badge.className = 'route-picker-fastest-badge';
                badge.textContent = tRaw(language, 'routes.fastest');
                btn.appendChild(badge);
              }

              btn.addEventListener('click', () => {
                onSelectRoute?.(index);
              });

              container.appendChild(btn);
            });

            return container;
          },
        });

        routePickerRef.current = new RoutePicker({ position: 'topright' });
        routePickerRef.current.addTo(map);
      }

      const bounds = L.latLngBounds(
        [selected.bounds.southWest.lat, selected.bounds.southWest.lng],
        [selected.bounds.northEast.lat, selected.bounds.northEast.lng]
      );
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [routeInfo, routes, selectedRouteIndex, onSelectRoute, language]);

  // Update user location marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    if (userLocation) {
      userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], {
        icon: userLocationIcon,
        title: tRaw(language, 'map.yourLocation'),
        zIndexOffset: 1000,
      }).addTo(map);

      userMarkerRef.current.bindPopup(buildUserLocationPopupElement(language));
    }
  }, [userLocation, language]);

  // Walking-time isochrone circle in emergency mode
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove existing circle if conditions no longer apply
    if (!emergencyMode || !emergencyCountdown || !userLocation) {
      if (isochroneCircleRef.current) {
        isochroneCircleRef.current.remove();
        isochroneCircleRef.current = null;
        walkingRadiusRef.current = 0;
      }
      return;
    }

    // Calculate walking distance radius: (seconds * 5000/3600) * 0.8 meters
    const radius = (emergencyCountdown * 5000 / 3600) * 0.8;
    walkingRadiusRef.current = radius;

    if (isochroneCircleRef.current) {
      // Update existing circle
      isochroneCircleRef.current.setLatLng([userLocation.lat, userLocation.lng]);
      isochroneCircleRef.current.setRadius(radius);
    } else {
      // Create new circle
      isochroneCircleRef.current = L.circle([userLocation.lat, userLocation.lng], {
        radius,
        fillColor: '#4CAF50',
        fillOpacity: 0.15,
        color: '#4CAF50',
        weight: 2,
      }).addTo(map);
    }

    return () => {
      if (isochroneCircleRef.current) {
        isochroneCircleRef.current.remove();
        isochroneCircleRef.current = null;
        walkingRadiusRef.current = 0;
      }
    };
  }, [emergencyMode, emergencyCountdown, userLocation]);

  // Fit bounds to show user + nearest shelters in emergency mode
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !userLocation || !shelters.length) return;

    if (!routeInfo) {
      const points: L.LatLngExpression[] = [
        [userLocation.lat, userLocation.lng],
        ...shelters.slice(0, 5).map((s): L.LatLngExpression => [s.lat, s.lon]),
      ];
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [userLocation, shelters, routeInfo]);


  // Heat map toggle button (always present on the map)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove previous control if it exists
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

        const btn = document.createElement('button');
        btn.className = 'heatmap-toggle-btn' + (heatMapVisible ? ' heatmap-toggle-active' : '');
        btn.textContent = tRaw(language, 'map.heatMapToggle');
        btn.setAttribute('aria-pressed', String(heatMapVisible));
        btn.addEventListener('click', toggleHeatMap);
        container.appendChild(btn);
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
  }, [language, heatMapVisible, toggleHeatMap]);

  // Heat map circle markers & legend
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear previous heat map layers
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
        pane: 'overlayPane', // below markers (markerPane)
      }).addTo(layerGroup);
    });

    layerGroup.addTo(map);
    heatMapLayerRef.current = layerGroup;

    // Update radii on zoom change
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

    // Add legend
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
  }, [heatMapVisible, geocodedAlerts, language]);

  // Update shelter markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    const popupRoots = popupRootsRef.current;
    if (!map || !markersLayer) return;

    // Clean up existing popup roots
    popupRoots.forEach((root) => {
      root.unmount();
    });
    popupRoots.clear();

    markersLayer.clearLayers();

    const showDistanceLabels = shelters.length < 20;

    shelters.forEach((shelter) => {
      const distanceMeters = Math.round(shelter.distanceFromRoute);
      const metersAbbr = tRaw(language, 'shelters.distanceMeters');
      const isSelected = selectedShelterId === shelter.id;

      let markerIcon: L.DivIcon;
      if (showDistanceLabels) {
        const svgHtml = isSelected ? SELECTED_SHELTER_SVG : SHELTER_ICON_SVG;
        const iconW = isSelected ? 36 : 28;
        const iconH = isSelected ? 44 : 34;
        markerIcon = L.divIcon({
          html: `<div style="display:flex;flex-direction:column;align-items:center;">
            ${svgHtml}
            <span class="shelter-distance-label">${distanceMeters} ${metersAbbr}</span>
          </div>`,
          className: `shelter-marker-icon${isSelected ? ' selected' : ''}`,
          iconSize: [Math.max(iconW, 48), iconH + 18],
          iconAnchor: [Math.max(iconW, 48) / 2, iconH],
          popupAnchor: [0, -iconH],
        });
      } else {
        markerIcon = isSelected ? selectedShelterIcon : shelterIcon;
      }

      // Determine if shelter is outside the isochrone walking radius
      let markerOpacity = 1;
      if (emergencyMode && userLocation && walkingRadiusRef.current > 0) {
        const shelterLatLng = L.latLng(shelter.lat, shelter.lon);
        const userLatLng = L.latLng(userLocation.lat, userLocation.lng);
        const distToShelter = userLatLng.distanceTo(shelterLatLng);
        if (distToShelter > walkingRadiusRef.current) {
          markerOpacity = 0.4;
        }
      }

      const marker = L.marker([shelter.lat, shelter.lon], {
        icon: markerIcon,
        title: shelter.name,
        opacity: markerOpacity,
      });

      // Create a container element for the React popup
      const popupContainer = document.createElement('div');

      const popup = L.popup({ maxWidth: 280, minWidth: 200 }).setContent(popupContainer);

      marker.bindPopup(popup);

      // Render React component when popup opens
      marker.on('popupopen', () => {
        // Unmount previous root if it exists
        const existingRoot = popupRoots.get(shelter.id);
        if (existingRoot) {
          existingRoot.unmount();
        }

        const root = createRoot(popupContainer);
        popupRoots.set(shelter.id, root);

        const currentCapData = capacityMap?.get(shelter.id);
        root.render(
          <LanguageProvider>
            <ShelterPopupWithLanguage
              shelter={shelter}
              hasRoute={!!routeInfo}
              capacityData={currentCapData}
              lang={language}
              onNavigate={(s) => onNavigateRef.current?.(s)}
            />
          </LanguageProvider>
        );
      });

      // Clean up React root when popup closes
      marker.on('popupclose', () => {
        const root = popupRoots.get(shelter.id);
        if (root) {
          root.unmount();
          popupRoots.delete(shelter.id);
        }
      });

      marker.on('click', () => {
        onShelterClick?.(shelter);
      });

      markersLayer.addLayer(marker);

      // Programmatically open popup for the selected shelter,
      // since the useEffect re-creates markers and interrupts
      // Leaflet's default click-to-open popup behavior.
      if (isSelected) {
        setTimeout(() => marker.openPopup(), 0);
      }
    });

    // Capture ref value for cleanup
    const currentPopupRoots = popupRootsRef.current;
    return () => {
      currentPopupRoots.forEach((root) => {
        root.unmount();
      });
      currentPopupRoots.clear();
    };
  }, [shelters, selectedShelterId, onShelterClick, onNavigateToShelter, routeInfo, language, capacityMap, emergencyMode, userLocation]);

  // Render navigation polyline (walking to shelter)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clean up previous navigation polyline
    if (navigationLayerRef.current) {
      navigationLayerRef.current.remove();
      navigationLayerRef.current = null;
    }

    if (!navigationRoute || !navigatingToShelter) return;

    if (navigationRoute.path.length < 2) return;

    const latLngs: L.LatLngExpression[] = navigationRoute.path.map((p) => [p.lat, p.lng]);
    const polyline = L.polyline(latLngs, {
      color: '#10B981',
      weight: 6,
      opacity: 0.9,
      dashArray: '12 8',
      pane: 'navigationPane',
    }).addTo(map);
    navigationLayerRef.current = polyline;

    // Fit bounds to navigation route
    const bounds = L.latLngBounds(latLngs);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });

    return () => {
      if (navigationLayerRef.current) {
        navigationLayerRef.current.remove();
        navigationLayerRef.current = null;
      }
    };
  }, [navigationRoute, navigatingToShelter]);

  if (!isLoaded) {
    return (
      <div className="map-container map-loading" role="status" aria-label={t('map.loadingAriaLabel')}>
        <div className="loading-spinner" aria-hidden="true" />
        <span>{t('map.loading')}</span>
      </div>
    );
  }

  return <div ref={mapRef} className="map-container" role="application" aria-label={t('map.ariaLabel')} />;
}

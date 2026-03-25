import { useEffect, useRef, type MutableRefObject } from 'react';
import L from 'leaflet';
import type { Language, TranslationKey } from '../../i18n';
import { translations } from '../../i18n/translations';
import type { RouteInfo, RouteOption } from '../../types';

const ROUTE_COLORS = ['#4285F4', '#00897B', '#F57C00'];

const START_MARKER_SVG = `<svg width="28" height="34" viewBox="0 0 28 34" xmlns="http://www.w3.org/2000/svg">
  <path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 20 14 20s14-9.5 14-20C28 6.3 21.7 0 14 0z" fill="#2E7D32"/>
  <circle cx="14" cy="13" r="5" fill="white"/>
</svg>`;

const END_MARKER_SVG = `<svg width="28" height="34" viewBox="0 0 28 34" xmlns="http://www.w3.org/2000/svg">
  <path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 20 14 20s14-9.5 14-20C28 6.3 21.7 0 14 0z" fill="#C62828"/>
  <circle cx="14" cy="13" r="5" fill="white"/>
</svg>`;

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

interface UseRouteLayerArgs {
  mapRef: MutableRefObject<L.Map | null>;
  routeInfo: RouteInfo | null;
  routes?: RouteOption[];
  selectedRouteIndex: number;
  onSelectRoute?: (index: number) => void;
  language: Language;
}

export function useRouteLayer({
  mapRef,
  routeInfo,
  routes,
  selectedRouteIndex,
  onSelectRoute,
  language,
}: UseRouteLayerArgs) {
  const routeLayersRef = useRef<L.Polyline[]>([]);
  const routeMarkersRef = useRef<L.Marker[]>([]);
  const routePickerRef = useRef<L.Control | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const clearRoutePresentation = () => {
      routeLayersRef.current.forEach((layer) => layer.remove());
      routeLayersRef.current = [];
      routeMarkersRef.current.forEach((marker) => marker.remove());
      routeMarkersRef.current = [];
      if (routePickerRef.current) {
        map.removeControl(routePickerRef.current);
        routePickerRef.current = null;
      }
    };

    clearRoutePresentation();

    const routesToRender = routes && routes.length > 0 ? routes : routeInfo ? [routeInfo] : [];
    if (routesToRender.length === 0) {
      return clearRoutePresentation;
    }

    const activeIndex = routes && routes.length > 0 ? selectedRouteIndex : 0;
    const hasAlternatives = Boolean(routes && routes.length > 1);

    routesToRender.forEach((route, index) => {
      if (index === activeIndex || route.path.length < 2) return;

      const color = hasAlternatives ? (ROUTE_COLORS[index] || '#9E9E9E') : '#9E9E9E';
      const latLngs: L.LatLngExpression[] = route.path.map((point) => [point.lat, point.lng]);
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

    const selected = routesToRender[activeIndex];
    if (!selected || selected.path.length < 2) {
      return clearRoutePresentation;
    }

    const selectedColor = hasAlternatives ? (ROUTE_COLORS[activeIndex] || '#4285F4') : '#4285F4';
    const latLngs: L.LatLngExpression[] = selected.path.map((point) => [point.lat, point.lng]);
    const selectedPolyline = L.polyline(latLngs, {
      color: selectedColor,
      weight: 6,
      opacity: 0.9,
    }).addTo(map);

    routeLayersRef.current.push(selectedPolyline);

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

    if (hasAlternatives && routes) {
      const dir = language === 'en' ? 'ltr' : 'rtl';
      const RoutePicker = L.Control.extend({
        onAdd() {
          const container = L.DomUtil.create('div', 'route-picker-overlay');
          container.setAttribute('dir', dir);
          L.DomEvent.disableClickPropagation(container);
          L.DomEvent.disableScrollPropagation(container);

          routes.forEach((route, index) => {
            const isActive = index === activeIndex;
            const color = ROUTE_COLORS[index] || '#9E9E9E';

            const button = document.createElement('button');
            button.className = `route-picker-item${isActive ? ' route-picker-item-active' : ''}`;

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
            button.appendChild(colorSpan);
            button.appendChild(infoSpan);

            if (route.isFastest) {
              const badge = document.createElement('span');
              badge.className = 'route-picker-fastest-badge';
              badge.textContent = tRaw(language, 'routes.fastest');
              button.appendChild(badge);
            }

            button.addEventListener('click', () => {
              onSelectRoute?.(index);
            });

            container.appendChild(button);
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

    return clearRoutePresentation;
  }, [language, mapRef, onSelectRoute, routeInfo, routes, selectedRouteIndex]);
}

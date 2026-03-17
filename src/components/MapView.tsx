import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { useLanguage } from '../i18n';
import type { Language, TranslationKey } from '../i18n';
import { translations } from '../i18n/translations';
import type { RouteInfo, RouteOption, LocationPoint } from '../types';
import type { ShelterWithDistance } from '../hooks/useShelters';

interface MapViewProps {
  isLoaded: boolean;
  routeInfo: RouteInfo | null;
  routes?: RouteOption[];
  selectedRouteIndex?: number;
  onSelectRoute?: (index: number) => void;
  shelters: ShelterWithDistance[];
  onShelterClick?: (shelter: ShelterWithDistance) => void;
  selectedShelterId?: string | null;
  userLocation?: LocationPoint | null;
}

const ISRAEL_CENTER: L.LatLngExpression = [31.5, 34.8];

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

function buildShelterPopupHtml(
  shelter: ShelterWithDistance,
  distanceText: number,
  hasRoute: boolean,
  navUrl: string,
  lang: Language
): string {
  const dir = lang === 'he' ? 'rtl' : 'ltr';
  const name = shelter.name || tRaw(lang, 'shelters.publicShelter');
  const addressHtml = shelter.address
    ? `<div style="font-size: 12px; color: #424242; margin-bottom: 6px; line-height: 1.4;">${shelter.address}</div>`
    : '';
  const distanceLabel = hasRoute
    ? tRaw(lang, 'shelters.fromRoute')
    : tRaw(lang, 'shelters.fromYou');
  const metersLabel = tRaw(lang, 'shelters.meters');
  const navLabel = tRaw(lang, 'shelters.navigateToShelter');

  return `
    <div style="direction: ${dir}; font-family: -apple-system, sans-serif; padding: 4px; min-width: 200px; max-width: 280px;">
      <div style="font-weight: 600; color: #0D47A1; font-size: 14px; margin-bottom: 6px;">
        ${name}
      </div>
      ${addressHtml}
      <div style="font-size: 12px; color: #1565C0; font-weight: 600; margin-top: 8px; padding-top: 8px; border-top: 1px solid #eee;">
        ${distanceText} ${metersLabel} ${distanceLabel}
      </div>
      <a href="${navUrl}" target="_blank" rel="noopener noreferrer"
        style="display: block; text-align: center; margin-top: 8px; padding: 8px; background: #1565C0; color: white; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 500;">
        ${navLabel}
      </a>
    </div>
  `;
}

function buildUserLocationPopupHtml(lang: Language): string {
  const dir = lang === 'he' ? 'rtl' : 'ltr';
  const label = tRaw(lang, 'map.yourLocation');
  return `<div style="direction: ${dir}; font-family: -apple-system, sans-serif; text-align: center; padding: 4px;"><strong>${label}</strong></div>`;
}

export function MapView({
  isLoaded,
  routeInfo,
  routes,
  selectedRouteIndex = 0,
  onSelectRoute,
  shelters,
  onShelterClick,
  selectedShelterId,
  userLocation,
}: MapViewProps) {
  const { language, t } = useLanguage();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const routeLayersRef = useRef<L.Polyline[]>([]);
  const routeLabelsRef = useRef<L.Marker[]>([]);
  const routeMarkersRef = useRef<L.Marker[]>([]);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);

  // Initialize map
  useEffect(() => {
    if (!isLoaded || !mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: ISRAEL_CENTER,
      zoom: 8,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;
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
  }, [isLoaded]);

  // Update route
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing route layers
    routeLayersRef.current.forEach((l) => l.remove());
    routeLayersRef.current = [];
    routeLabelsRef.current.forEach((m) => m.remove());
    routeLabelsRef.current = [];
    routeMarkersRef.current.forEach((m) => m.remove());
    routeMarkersRef.current = [];

    const routesToRender = routes && routes.length > 0 ? routes : routeInfo ? [routeInfo] : [];
    if (routesToRender.length === 0) return;

    const activeIndex = routes && routes.length > 0 ? selectedRouteIndex : 0;

    // Render non-selected routes first (so they appear behind)
    routesToRender.forEach((route, index) => {
      if (index === activeIndex) return;
      if (route.path.length < 2) return;

      const latLngs: L.LatLngExpression[] = route.path.map((p) => [p.lat, p.lng]);
      const polyline = L.polyline(latLngs, {
        color: '#9E9E9E',
        weight: 4,
        opacity: 0.4,
      }).addTo(map);

      polyline.on('click', () => {
        onSelectRoute?.(index);
      });

      routeLayersRef.current.push(polyline);
    });

    // Render selected route on top
    const selected = routesToRender[activeIndex];
    if (selected && selected.path.length >= 2) {
      const latLngs: L.LatLngExpression[] = selected.path.map((p) => [p.lat, p.lng]);
      const polyline = L.polyline(latLngs, {
        color: '#4285F4',
        weight: 5,
        opacity: 0.8,
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

      // Add route option labels on map when there are alternatives
      if (routes && routes.length > 1) {
        routes.forEach((route, index) => {
          if (route.path.length < 2) return;
          // Place label at ~40% of the path for the route to spread labels apart
          const labelIndex = Math.floor(route.path.length * (index === 0 ? 0.35 : index === 1 ? 0.5 : 0.65));
          const labelPoint = route.path[labelIndex];
          const isActive = index === activeIndex;

          const labelHtml = `<div class="route-map-label ${isActive ? 'route-map-label-active' : 'route-map-label-inactive'}">
            <span class="route-map-label-number">${tRaw(language, 'route.optionLabel')} ${index + 1}</span>
            <span class="route-map-label-stats">${route.duration} · ${route.distance}</span>
          </div>`;

          const labelIcon = L.divIcon({
            html: labelHtml,
            className: 'route-map-label-container',
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          });

          const labelMarker = L.marker([labelPoint.lat, labelPoint.lng], {
            icon: labelIcon,
            interactive: !isActive,
            zIndexOffset: isActive ? 800 : 700,
          }).addTo(map);

          if (!isActive) {
            labelMarker.on('click', () => {
              onSelectRoute?.(index);
            });
          }

          routeLabelsRef.current.push(labelMarker);
        });
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

      userMarkerRef.current.bindPopup(buildUserLocationPopupHtml(language));
    }
  }, [userLocation, language]);

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

  // Update shelter markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

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

      const marker = L.marker([shelter.lat, shelter.lon], {
        icon: markerIcon,
        title: shelter.name,
      });

      const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${shelter.lat},${shelter.lon}&travelmode=walking`;
      const distanceText = Math.round(shelter.distanceFromRoute);

      marker.bindPopup(
        buildShelterPopupHtml(shelter, distanceText, !!routeInfo, navUrl, language),
        { maxWidth: 300 }
      );

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
  }, [shelters, selectedShelterId, onShelterClick, routeInfo, language]);

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

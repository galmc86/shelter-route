import { useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { useLanguage, LanguageProvider } from '../i18n';
import type { Language, TranslationKey } from '../i18n';
import { translations } from '../i18n/translations';
import type { RouteInfo, LocationPoint } from '../types';
import type { ShelterWithDistance } from '../hooks/useShelters';
import type { CapacityData } from '../services/capacityService';
import { ShelterPopup } from './ShelterPopup';

interface MapViewProps {
  isLoaded: boolean;
  routeInfo: RouteInfo | null;
  shelters: ShelterWithDistance[];
  onShelterClick?: (shelter: ShelterWithDistance) => void;
  selectedShelterId?: string | null;
  userLocation?: LocationPoint | null;
  capacityMap?: Map<string, CapacityData>;
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

function tRaw(lang: Language, key: TranslationKey): string {
  return translations[lang][key] ?? key;
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
}: {
  shelter: ShelterWithDistance;
  hasRoute: boolean;
  capacityData?: CapacityData;
  lang: Language;
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
    />
  );
}

function buildUserLocationPopupHtml(lang: Language): string {
  const dir = lang === 'he' ? 'rtl' : 'ltr';
  const label = tRaw(lang, 'map.yourLocation');
  return `<div style="direction: ${dir}; font-family: -apple-system, sans-serif; text-align: center; padding: 4px;"><strong>${label}</strong></div>`;
}

export function MapView({
  isLoaded,
  routeInfo,
  shelters,
  onShelterClick,
  selectedShelterId,
  userLocation,
  capacityMap,
}: MapViewProps) {
  const { language, t } = useLanguage();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const popupRootsRef = useRef<Map<string, Root>>(new Map());

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

    if (routeLayerRef.current) {
      routeLayerRef.current.remove();
      routeLayerRef.current = null;
    }

    if (routeInfo) {
      const latLngs: L.LatLngExpression[] = routeInfo.path.map((p) => [p.lat, p.lng]);
      routeLayerRef.current = L.polyline(latLngs, {
        color: '#4285F4',
        weight: 5,
        opacity: 0.8,
      }).addTo(map);

      const bounds = L.latLngBounds(
        [routeInfo.bounds.southWest.lat, routeInfo.bounds.southWest.lng],
        [routeInfo.bounds.northEast.lat, routeInfo.bounds.northEast.lng]
      );
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [routeInfo]);

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

    // Clean up existing popup roots
    popupRootsRef.current.forEach((root) => {
      root.unmount();
    });
    popupRootsRef.current.clear();

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

      // Create a container element for the React popup
      const popupContainer = document.createElement('div');

      const popup = L.popup({ maxWidth: 300 }).setContent(popupContainer);

      marker.bindPopup(popup);

      // Render React component when popup opens
      marker.on('popupopen', () => {
        // Unmount previous root if it exists
        const existingRoot = popupRootsRef.current.get(shelter.id);
        if (existingRoot) {
          existingRoot.unmount();
        }

        const root = createRoot(popupContainer);
        popupRootsRef.current.set(shelter.id, root);

        const currentCapData = capacityMap?.get(shelter.id);
        root.render(
          <LanguageProvider>
            <ShelterPopupWithLanguage
              shelter={shelter}
              hasRoute={!!routeInfo}
              capacityData={currentCapData}
              lang={language}
            />
          </LanguageProvider>
        );
      });

      // Clean up React root when popup closes
      marker.on('popupclose', () => {
        const root = popupRootsRef.current.get(shelter.id);
        if (root) {
          root.unmount();
          popupRootsRef.current.delete(shelter.id);
        }
      });

      marker.on('click', () => {
        onShelterClick?.(shelter);
      });

      markersLayer.addLayer(marker);
    });

    // Cleanup on unmount
    return () => {
      popupRootsRef.current.forEach((root) => {
        root.unmount();
      });
      popupRootsRef.current.clear();
    };
  }, [shelters, selectedShelterId, onShelterClick, routeInfo, language, capacityMap]);

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

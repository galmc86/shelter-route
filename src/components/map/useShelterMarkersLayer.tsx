import { useEffect, useRef, type MutableRefObject } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import L from 'leaflet';
import { LanguageProvider, useLanguage, type Language, type TranslationKey } from '../../i18n';
import { translations } from '../../i18n/translations';
import type { LocationPoint, RouteInfo } from '../../types';
import type { ShelterWithDistance } from '../../hooks/useShelters';
import type { CapacityData } from '../../services/capacityService';
import { ShelterPopup } from '../ShelterPopup';

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

function tRaw(lang: Language, key: TranslationKey): string {
  return translations[lang][key] ?? key;
}

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

interface UseShelterMarkersLayerArgs {
  markersLayerRef: MutableRefObject<L.LayerGroup | null>;
  shelters: ShelterWithDistance[];
  selectedShelterId: string | null;
  onShelterClick?: (shelter: ShelterWithDistance) => void;
  onNavigateToShelter?: (shelter: ShelterWithDistance) => void;
  routeInfo: RouteInfo | null;
  language: Language;
  capacityMap: Map<string, CapacityData>;
  emergencyMode: boolean;
  userLocation?: LocationPoint | null;
  walkingRadiusMeters: number;
}

export function useShelterMarkersLayer({
  markersLayerRef,
  shelters,
  selectedShelterId,
  onShelterClick,
  onNavigateToShelter,
  routeInfo,
  language,
  capacityMap,
  emergencyMode,
  userLocation,
  walkingRadiusMeters,
}: UseShelterMarkersLayerArgs) {
  const popupRootsRef = useRef<Map<string, Root>>(new Map());
  const onNavigateRef = useRef(onNavigateToShelter);

  useEffect(() => {
    onNavigateRef.current = onNavigateToShelter;
  }, [onNavigateToShelter]);

  useEffect(() => {
    const markersLayer = markersLayerRef.current;
    const popupRoots = popupRootsRef.current;
    if (!markersLayer) return;

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

      let markerOpacity = 1;
      if (emergencyMode && userLocation && walkingRadiusMeters > 0) {
        const shelterLatLng = L.latLng(shelter.lat, shelter.lon);
        const userLatLng = L.latLng(userLocation.lat, userLocation.lng);
        const distToShelter = userLatLng.distanceTo(shelterLatLng);
        if (distToShelter > walkingRadiusMeters) {
          markerOpacity = 0.4;
        }
      }

      const marker = L.marker([shelter.lat, shelter.lon], {
        icon: markerIcon,
        title: shelter.name,
        opacity: markerOpacity,
      });

      const popupContainer = document.createElement('div');
      const popup = L.popup({
        maxWidth: 280,
        minWidth: 200,
        autoPanPaddingTopLeft: L.point(10, 80),
        autoPanPaddingBottomRight: L.point(10, 160),
      }).setContent(popupContainer);

      marker.bindPopup(popup);

      marker.on('popupopen', () => {
        const existingRoot = popupRoots.get(shelter.id);
        if (existingRoot) {
          existingRoot.unmount();
        }

        const root = createRoot(popupContainer);
        popupRoots.set(shelter.id, root);

        const currentCapData = capacityMap.get(shelter.id);
        root.render(
          <LanguageProvider>
            <ShelterPopupWithLanguage
              shelter={shelter}
              hasRoute={!!routeInfo}
              capacityData={currentCapData}
              lang={language}
              onNavigate={(currentShelter) => onNavigateRef.current?.(currentShelter)}
            />
          </LanguageProvider>
        );
      });

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

      if (isSelected) {
        setTimeout(() => marker.openPopup(), 0);
      }
    });

    const currentPopupRoots = popupRootsRef.current;
    return () => {
      currentPopupRoots.forEach((root) => {
        root.unmount();
      });
      currentPopupRoots.clear();
    };
  }, [
    capacityMap,
    emergencyMode,
    language,
    markersLayerRef,
    onShelterClick,
    routeInfo,
    selectedShelterId,
    shelters,
    userLocation,
    walkingRadiusMeters,
  ]);
}

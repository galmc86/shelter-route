import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import L from 'leaflet';
import type { Language, TranslationKey } from '../../i18n';
import { translations } from '../../i18n/translations';
import type { LocationPoint, RouteInfo } from '../../types';
import type { ShelterWithDistance } from '../../hooks/useShelters';

const USER_LOCATION_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <circle cx="12" cy="12" r="10" fill="#4285F4" opacity="0.2" stroke="#4285F4" stroke-width="2"/>
  <circle cx="12" cy="12" r="5" fill="#4285F4"/>
</svg>`;

const userLocationIcon = L.divIcon({
  html: USER_LOCATION_SVG,
  className: 'user-location-icon',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function tRaw(lang: Language, key: TranslationKey): string {
  return translations[lang][key] ?? key;
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

interface UseUserLocationEmergencyLayerArgs {
  mapRef: MutableRefObject<L.Map | null>;
  userLocation?: LocationPoint | null;
  language: Language;
  emergencyMode: boolean;
  emergencyCountdown?: number;
  shelters: ShelterWithDistance[];
  routeInfo: RouteInfo | null;
}

export function useUserLocationEmergencyLayer({
  mapRef,
  userLocation,
  language,
  emergencyMode,
  emergencyCountdown,
  shelters,
  routeInfo,
}: UseUserLocationEmergencyLayerArgs) {
  const userMarkerRef = useRef<L.Marker | null>(null);
  const isochroneCircleRef = useRef<L.Circle | null>(null);
  const [walkingRadiusMeters, setWalkingRadiusMeters] = useState(0);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    if (!userLocation) {
      return;
    }

    userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], {
      icon: userLocationIcon,
      title: tRaw(language, 'map.yourLocation'),
      zIndexOffset: 1000,
    }).addTo(map);

    userMarkerRef.current.bindPopup(buildUserLocationPopupElement(language));

    return () => {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
    };
  }, [language, mapRef, userLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!emergencyMode || !emergencyCountdown || !userLocation) {
      setWalkingRadiusMeters(0);
      if (isochroneCircleRef.current) {
        isochroneCircleRef.current.remove();
        isochroneCircleRef.current = null;
      }
      return;
    }

    const radius = (emergencyCountdown * 5000 / 3600) * 0.8;
    setWalkingRadiusMeters(radius);

    if (isochroneCircleRef.current) {
      isochroneCircleRef.current.setLatLng([userLocation.lat, userLocation.lng]);
      isochroneCircleRef.current.setRadius(radius);
    } else {
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
      }
    };
  }, [emergencyCountdown, emergencyMode, mapRef, userLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userLocation || !shelters.length || routeInfo) return;

    const points: L.LatLngExpression[] = [
      [userLocation.lat, userLocation.lng],
      ...shelters.slice(0, 5).map((shelter): L.LatLngExpression => [shelter.lat, shelter.lon]),
    ];
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
  }, [mapRef, routeInfo, shelters, userLocation]);

  return {
    walkingRadiusMeters,
  };
}

import { useEffect, useRef } from 'react';
import './MapView.css';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { useLanguage } from '../i18n';
import { useRouteContext } from '../contexts/RouteContext';
import { useEmergencyContext } from '../contexts/EmergencyContext';
import { useShelterContext } from '../contexts/ShelterContext';
import { useAlertHistory } from '../hooks/useAlertHistory';
import type { RouteOption, LocationPoint } from '../types';
import type { ShelterWithDistance } from '../hooks/useShelters';
import { useRouteLayer } from './map/useRouteLayer';
import { useShelterMarkersLayer } from './map/useShelterMarkersLayer';
import { useUserLocationEmergencyLayer } from './map/useUserLocationEmergencyLayer';
import { useHeatMapLayer } from './map/useHeatMapLayer';
import { useNavigationRouteLayer } from './map/useNavigationRouteLayer';

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
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  // Fetch alert history for heat map (supplementary — tolerates duplicate fetch)
  const { alerts: geocodedAlerts } = useAlertHistory(routeInfo);

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

  useRouteLayer({
    mapRef: mapInstanceRef,
    routeInfo,
    routes,
    selectedRouteIndex,
    onSelectRoute,
    language,
  });

  const { walkingRadiusMeters } = useUserLocationEmergencyLayer({
    mapRef: mapInstanceRef,
    userLocation,
    language,
    emergencyMode,
    emergencyCountdown,
    shelters,
    routeInfo,
  });

  useShelterMarkersLayer({
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
  });

  useHeatMapLayer({
    mapRef: mapInstanceRef,
    language,
    geocodedAlerts,
  });

  useNavigationRouteLayer({
    mapRef: mapInstanceRef,
    navigationRoute,
    navigatingToShelter,
  });

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

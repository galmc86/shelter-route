import { useEffect, useRef, type MutableRefObject } from 'react';
import L from 'leaflet';
import type { RouteOption } from '../../types';
import type { ShelterWithDistance } from '../../hooks/useShelters';

interface UseNavigationRouteLayerArgs {
  mapRef: MutableRefObject<L.Map | null>;
  navigationRoute?: RouteOption | null;
  navigatingToShelter?: ShelterWithDistance | null;
}

export function useNavigationRouteLayer({
  mapRef,
  navigationRoute,
  navigatingToShelter,
}: UseNavigationRouteLayerArgs) {
  const navigationLayerRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (navigationLayerRef.current) {
      navigationLayerRef.current.remove();
      navigationLayerRef.current = null;
    }

    if (!navigationRoute || !navigatingToShelter || navigationRoute.path.length < 2) {
      return;
    }

    const latLngs: L.LatLngExpression[] = navigationRoute.path.map((point) => [point.lat, point.lng]);
    const polyline = L.polyline(latLngs, {
      color: '#10B981',
      weight: 6,
      opacity: 0.9,
      dashArray: '12 8',
      pane: 'navigationPane',
    }).addTo(map);
    navigationLayerRef.current = polyline;

    const bounds = L.latLngBounds(latLngs);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });

    return () => {
      if (navigationLayerRef.current) {
        navigationLayerRef.current.remove();
        navigationLayerRef.current = null;
      }
    };
  }, [mapRef, navigationRoute, navigatingToShelter]);
}

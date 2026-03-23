import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useLanguage } from '../i18n';
import type { LatLng } from '../types';
import type { ShelterWithDistance } from '../hooks/useShelters';
import { computeWalkingRoute } from '../services/routeService';
import { getShelterKindLabel } from '../utils/shelterKind';

interface ShelterNavigationProps {
  shelter: ShelterWithDistance;
  userLocation: { lat: number; lng: number };
  onStop: () => void;
  onRouteCalculated: (path: LatLng[] | null) => void;
}

/** Direction arrows based on bearing (N, NE, E, SE, S, SW, W, NW) */
const DIRECTION_ARROWS = ['\u2191', '\u2197', '\u2192', '\u2198', '\u2193', '\u2199', '\u2190', '\u2196'] as const;

function bearingBetween(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const dLng = toRad(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

function directionArrow(bearing: number): string {
  const index = Math.round(bearing / 45) % 8;
  return DIRECTION_ARROWS[index];
}

function haversineDistance(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function formatNavDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatNavTime(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hrs = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

export function ShelterNavigation({ shelter, userLocation, onStop, onRouteCalculated }: ShelterNavigationProps) {
  const { t } = useLanguage();
  const kindLabel = getShelterKindLabel(shelter.kind, t);
  const [isCalculating, setIsCalculating] = useState(true);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeDuration, setRouteDuration] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const abortRef = useRef(false);

  const shelterLatLng: LatLng = useMemo(() => ({ lat: shelter.lat, lng: shelter.lon }), [shelter.lat, shelter.lon]);

  const fetchRoute = useCallback(async () => {
    abortRef.current = false;
    setIsCalculating(true);
    setError(false);

    try {
      const result = await computeWalkingRoute(
        { lat: userLocation.lat, lng: userLocation.lng },
        shelterLatLng
      );
      if (abortRef.current) return;

      setRouteDistance(result.distanceMeters);
      setRouteDuration(result.durationSeconds);
      onRouteCalculated(result.path);
      setIsCalculating(false);
    } catch {
      if (abortRef.current) return;
      setError(true);
      setIsCalculating(false);
      onRouteCalculated(null);
    }
  }, [userLocation.lat, userLocation.lng, shelterLatLng, onRouteCalculated]);

  useEffect(() => {
    fetchRoute(); // eslint-disable-line react-hooks/set-state-in-effect -- async fetch, setState called in async callback not synchronously
    return () => {
      abortRef.current = true;
    };
  }, [fetchRoute]);

  // Clean up route on unmount
  useEffect(() => {
    return () => {
      onRouteCalculated(null);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const straightDistance = haversineDistance(userLocation, shelterLatLng);
  const bearing = bearingBetween(userLocation, shelterLatLng);
  const arrow = directionArrow(bearing);
  const isArriving = straightDistance < 30;

  const displayDistance = routeDistance ?? straightDistance;
  const displayTime = routeDuration ?? Math.round(straightDistance / 1.4); // ~5 km/h fallback

  return (
    <div className="shelter-navigation" role="status" aria-live="polite">
      <div className="shelter-nav-content">
        {isCalculating ? (
          <div className="shelter-nav-calculating">
            <div className="loading-spinner" aria-hidden="true" />
            <span>{t('nav.calculating')}</span>
          </div>
        ) : isArriving ? (
          <div className="shelter-nav-arriving">
            <span className="shelter-nav-check" aria-hidden="true">&#10003;</span>
            <span>{t('nav.arriving')}</span>
          </div>
        ) : (
          <div className="shelter-nav-directions">
            <span className="shelter-nav-arrow" aria-hidden="true">{arrow}</span>
            <div className="shelter-nav-info">
              <span className="shelter-nav-distance">{formatNavDistance(displayDistance)}</span>
              <span className="shelter-nav-time">{formatNavTime(displayTime)}</span>
            </div>
            <span className="shelter-nav-name">
              {shelter.name || t('shelters.publicShelter')}
              {kindLabel && <span className="navigation-panel-kind-badge shelter-nav-kind-badge">{kindLabel}</span>}
            </span>
          </div>
        )}
        {error && (
          <span className="shelter-nav-error">{t('error.networkError')}</span>
        )}
      </div>
      <button
        className="shelter-nav-stop"
        onClick={onStop}
        type="button"
        aria-label={t('nav.stop')}
      >
        {t('nav.stop')}
      </button>
    </div>
  );
}

// Alert History Service
// Fetches recent alert history, geocodes to regions, and assesses route risk

import { ALERT_REGIONS, type OrefAlert, type AlertRegion } from './orefAlertService';
import { isPointNearRoute } from '../utils/geometry';
import type { LatLng } from '../types';

export interface GeocodedAlert {
  id: string;
  alertDate: string;
  cities: string[];
  regionName: string;
  regionNameEn: string;
  lat: number;
  lng: number;
  threat: number;
}

export type RiskLevel = 'none' | 'low' | 'moderate' | 'high';

export interface RouteRiskAssessment {
  alertedRegions: GeocodedAlert[];
  totalAlerts: number;
  mostRecentAlert: string | null;
  riskLevel: RiskLevel;
}

const OREF_PROXY_URL = import.meta.env.VITE_OREF_PROXY_URL as string | undefined;

/**
 * Fetch alert history from the OREF proxy worker.
 */
export async function fetchAlertHistory(): Promise<OrefAlert[]> {
  if (!OREF_PROXY_URL) return [];

  const response = await fetch(`${OREF_PROXY_URL}/history`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) return [];

  const data: OrefAlert[] = await response.json();
  return data;
}

/**
 * Match alert city names to ALERT_REGIONS to get coordinates.
 * Uses the same fuzzy matching pattern as matchUserToAlertRegion.
 */
function matchCitiesToRegion(cities: string[]): AlertRegion | null {
  for (const region of ALERT_REGIONS) {
    const matches = cities.some(
      (city) => region.name.includes(city) || city.includes(region.name)
    );
    if (matches) return region;
  }
  return null;
}

/**
 * Convert OrefAlerts to GeocodedAlerts by matching cities to known regions.
 * Alerts that don't match any region are dropped (we can't place them on a map).
 */
export function geocodeAlerts(
  alerts: OrefAlert[],
  hoursFilter: number = 24
): GeocodedAlert[] {
  const cutoff = Date.now() - hoursFilter * 60 * 60 * 1000;
  const seen = new Set<string>();

  return alerts
    .filter((alert) => new Date(alert.alertDate).getTime() > cutoff)
    .reduce<GeocodedAlert[]>((acc, alert) => {
      const region = matchCitiesToRegion(alert.data);
      if (!region) return acc;

      // Deduplicate by region + hour bucket (avoid stacking circles)
      const hourBucket = Math.floor(
        new Date(alert.alertDate).getTime() / (60 * 60 * 1000)
      );
      const key = `${region.name}-${hourBucket}`;
      if (seen.has(key)) return acc;
      seen.add(key);

      acc.push({
        id: alert.id,
        alertDate: alert.alertDate,
        cities: alert.data,
        regionName: region.name,
        regionNameEn: region.nameEn,
        lat: region.lat,
        lng: region.lng,
        threat: parseInt(alert.cat, 10) || 0,
      });
      return acc;
    }, []);
}

/**
 * Assess route risk based on geocoded alert history.
 */
export interface HeatMapCell {
  lat: number;
  lng: number;
  intensity: number; // 0-1
  count: number;
}

/**
 * Aggregate geocoded alerts into grid cells for a heat map layer.
 * Cells are ~0.05 degree squares (~5 km). Alerts are weighted by recency:
 *   last hour = 1.0, last 6 hours = 0.7, last 24 hours = 0.3
 */
export function getHeatMapData(alerts: GeocodedAlert[]): HeatMapCell[] {
  if (alerts.length === 0) return [];

  const GRID_SIZE = 0.05; // ~5 km per cell
  const now = Date.now();
  const ONE_HOUR = 60 * 60 * 1000;
  const SIX_HOURS = 6 * ONE_HOUR;

  // Bucket alerts into grid cells
  const cellMap = new Map<string, { lat: number; lng: number; weight: number; count: number }>();

  for (const alert of alerts) {
    const cellLat = Math.round(alert.lat / GRID_SIZE) * GRID_SIZE;
    const cellLng = Math.round(alert.lng / GRID_SIZE) * GRID_SIZE;
    const key = `${cellLat.toFixed(4)},${cellLng.toFixed(4)}`;

    const age = now - new Date(alert.alertDate).getTime();
    let recencyWeight: number;
    if (age < ONE_HOUR) {
      recencyWeight = 1.0;
    } else if (age < SIX_HOURS) {
      recencyWeight = 0.7;
    } else {
      recencyWeight = 0.3;
    }

    const existing = cellMap.get(key);
    if (existing) {
      existing.weight += recencyWeight;
      existing.count += 1;
    } else {
      cellMap.set(key, { lat: cellLat, lng: cellLng, weight: recencyWeight, count: 1 });
    }
  }

  // Normalize intensity to 0-1 range
  let maxWeight = 0;
  for (const cell of cellMap.values()) {
    if (cell.weight > maxWeight) maxWeight = cell.weight;
  }

  if (maxWeight === 0) return [];

  const result: HeatMapCell[] = [];
  for (const cell of cellMap.values()) {
    result.push({
      lat: cell.lat,
      lng: cell.lng,
      intensity: cell.weight / maxWeight,
      count: cell.count,
    });
  }

  return result;
}

export function assessRouteRisk(
  alerts: GeocodedAlert[],
  routePath: LatLng[] | null
): RouteRiskAssessment {
  const empty: RouteRiskAssessment = {
    alertedRegions: [],
    totalAlerts: 0,
    mostRecentAlert: null,
    riskLevel: 'none',
  };

  if (!routePath || routePath.length === 0 || alerts.length === 0) return empty;

  // Find alerts near the route (5km buffer — region-level proximity)
  const nearRoute = alerts.filter((alert) =>
    isPointNearRoute({ lat: alert.lat, lng: alert.lng }, routePath, 5000)
  );

  if (nearRoute.length === 0) return empty;

  // Find most recent alert
  const sorted = [...nearRoute].sort(
    (a, b) =>
      new Date(b.alertDate).getTime() - new Date(a.alertDate).getTime()
  );
  const mostRecent = sorted[0].alertDate;
  const mostRecentAge = Date.now() - new Date(mostRecent).getTime();
  const oneHour = 60 * 60 * 1000;
  const sixHours = 6 * oneHour;

  // Determine risk level
  let riskLevel: RiskLevel;
  if (mostRecentAge < oneHour) {
    riskLevel = 'high';
  } else if (mostRecentAge < sixHours || nearRoute.length >= 3) {
    riskLevel = 'moderate';
  } else {
    riskLevel = 'low';
  }

  return {
    alertedRegions: sorted,
    totalAlerts: nearRoute.length,
    mostRecentAlert: mostRecent,
    riskLevel,
  };
}

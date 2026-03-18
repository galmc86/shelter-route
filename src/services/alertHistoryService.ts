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

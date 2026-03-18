import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  fetchAlertHistory,
  geocodeAlerts,
  assessRouteRisk,
  type GeocodedAlert,
  type RouteRiskAssessment,
} from '../services/alertHistoryService';
import type { RouteInfo } from '../types';

export type TimeFilter = 1 | 6 | 24;

interface UseAlertHistoryResult {
  alerts: GeocodedAlert[];
  routeRisk: RouteRiskAssessment | null;
  isLoading: boolean;
  timeFilter: TimeFilter;
  setTimeFilter: (hours: TimeFilter) => void;
}

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function useAlertHistory(
  selectedRoute: RouteInfo | null
): UseAlertHistoryResult {
  const [allAlerts, setAllAlerts] = useState<GeocodedAlert[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>(24);
  const [fetchedOnce, setFetchedOnce] = useState(false);

  const proxyUrl = import.meta.env.VITE_OREF_PROXY_URL as string | undefined;

  const doFetch = useCallback(async () => {
    if (!proxyUrl) return;
    try {
      setIsLoading(true);
      const alerts = await fetchAlertHistory();
      // Geocode with max window (24h), filter later
      const geocoded = geocodeAlerts(alerts, 24);
      setAllAlerts(geocoded);
      setFetchedOnce(true);
    } catch {
      // Silent failure — history is supplementary
    } finally {
      setIsLoading(false);
    }
  }, [proxyUrl]);

  // Fetch on mount, refresh every 5 min
  useEffect(() => {
    doFetch();
    const interval = setInterval(doFetch, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [doFetch]);

  // Filter by time
  const filteredAlerts = useMemo(() => {
    if (timeFilter === 24) return allAlerts;
    const cutoff = Date.now() - timeFilter * 60 * 60 * 1000;
    return allAlerts.filter(
      (a) => new Date(a.alertDate).getTime() > cutoff
    );
  }, [allAlerts, timeFilter]);

  // Compute route risk
  const routeRisk = useMemo(() => {
    if (!selectedRoute || filteredAlerts.length === 0) return null;
    return assessRouteRisk(filteredAlerts, selectedRoute.path);
  }, [selectedRoute, filteredAlerts]);

  return {
    alerts: filteredAlerts,
    routeRisk,
    isLoading: isLoading && !fetchedOnce,
    timeFilter,
    setTimeFilter,
  };
}

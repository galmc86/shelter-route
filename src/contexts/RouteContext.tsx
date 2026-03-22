import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { TravelMode, LatLng, RouteInfo, RouteWithShelters } from '../types';
import type { ShelterWithDistance } from '../hooks/useShelters';
import type { RouteRiskAssessment } from '../services/alertHistoryService';
import type { TimeFilter } from '../hooks/useAlertHistory';

export interface RouteContextValue {
  routeInfo: RouteInfo | null;
  selectedRouteIndex: number;
  routesWithShelters: RouteWithShelters[];
  nearbyShelters: ShelterWithDistance[];
  sheltersLoading: boolean;
  searchError: string | null;
  isSearching: boolean;
  onSearch: (origin: LatLng, destination: LatLng, travelMode: TravelMode) => void;
  onRouteSelect: (index: number) => void;
  shareOrigin: LatLng | null;
  shareDestination: LatLng | null;
  shareTravelMode: TravelMode;
  routeRisk: RouteRiskAssessment | null;
  timeFilter: TimeFilter;
  onTimeFilterChange: (hours: TimeFilter) => void;
}

const RouteContext = createContext<RouteContextValue | null>(null);

export function RouteProvider({
  value,
  children,
}: {
  value: RouteContextValue;
  children: ReactNode;
}) {
  return <RouteContext.Provider value={value}>{children}</RouteContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useRouteContext(): RouteContextValue {
  const ctx = useContext(RouteContext);
  if (!ctx) {
    throw new Error('useRouteContext must be used within a RouteProvider');
  }
  return ctx;
}

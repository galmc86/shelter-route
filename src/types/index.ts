export type ShelterKind = 'shelter' | 'migunit' | 'protected-space' | 'community-protection';

export interface Shelter {
  id: string;
  name: string;
  address?: string;
  lat: number;
  lon: number;
  city: string;
  kind?: ShelterKind;
  walkingTimeMinutes?: number;
  isAccessible?: boolean;
  hasElevator?: boolean;
  floorLevel?: number;
  capacity?: number;
  currentOccupancy?: number;
  lastUpdated?: string;
}

export type ShelterSortMode = 'recommended' | 'distance' | 'walkingTime';

export type TravelMode = 'WALKING' | 'BICYCLING' | 'DRIVING';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface LatLngBounds {
  southWest: LatLng;
  northEast: LatLng;
}

export interface RouteInfo {
  path: LatLng[];
  bounds: LatLngBounds;
  duration: string;
  distance: string;
}

export interface RouteOption extends RouteInfo {
  durationSeconds: number;
  distanceMeters: number;
  isFastest?: boolean;
}

export interface PlaceResult {
  lat: number;
  lng: number;
  displayName: string;
  placeId?: string; // Google Places ID (for deferred detail fetch)
}

// Backward compatibility alias
export type NominatimResult = PlaceResult;

export interface LocationPoint {
  lat: number;
  lng: number;
  address?: string;
}

export interface RouteWithShelters {
  route: RouteOption;
  shelterCount: number;
}

export interface SavedRouteData {
  duration: string;
  distance: string;
  durationSeconds: number;
  distanceMeters: number;
  shelterCount: number;
  savedAt: number;
}

export interface SearchHistoryEntry {
  id: string;
  origin: LatLng;
  destination: LatLng;
  originName: string;
  destName: string;
  travelMode: TravelMode;
  timestamp: number;
  shelterCount?: number;
  pinned?: boolean;
  label?: string;
  routeData?: SavedRouteData;
}

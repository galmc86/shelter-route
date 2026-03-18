export interface Shelter {
  id: string;
  name: string;
  address?: string;
  lat: number;
  lon: number;
  city: string;
  walkingTimeMinutes?: number;
  isAccessible?: boolean;
  hasElevator?: boolean;
  floorLevel?: number;
}

export type ShelterSortMode = 'distance' | 'walkingTime';

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

export interface LocationPoint {
  lat: number;
  lng: number;
  address?: string;
}

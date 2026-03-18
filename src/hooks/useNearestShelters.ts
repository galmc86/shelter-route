import { useState, useCallback } from 'react';
import type { Shelter } from '../types';
import type { ShelterWithDistance } from './useShelters';
import { calculateWalkingTime } from './useShelters';

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      sinLng *
      sinLng;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function useNearestShelters() {
  const [nearestShelters, setNearestShelters] = useState<ShelterWithDistance[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const findNearest = useCallback(
    (allShelters: Shelter[], lat: number, lng: number, count = 10) => {
      setIsSearching(true);
      setError(null);

      if (!allShelters.length) {
        setError('לא נטענו מקלטים. נסה לרענן את הדף.');
        setIsSearching(false);
        return;
      }

      const withDistance: ShelterWithDistance[] = allShelters
        .map((shelter) => {
          const distance = Math.round(
            haversineDistance(lat, lng, shelter.lat, shelter.lon)
          );
          return {
            ...shelter,
            distanceFromRoute: distance,
            walkingTimeMinutes: calculateWalkingTime(distance),
          };
        })
        .sort((a, b) => a.distanceFromRoute - b.distanceFromRoute)
        .slice(0, count);

      setNearestShelters(withDistance);
      setIsSearching(false);
    },
    []
  );

  const clear = useCallback(() => {
    setNearestShelters([]);
    setError(null);
  }, []);

  return { nearestShelters, isSearching, error, findNearest, clear };
}

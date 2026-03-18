import { useState, useCallback } from 'react';
import type { Shelter } from '../types';
import type { ShelterWithDistance } from './useShelters';
import { calculateWalkingTime } from './useShelters';
import { haversineDistance } from '../utils/geometry';

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
            haversineDistance({ lat, lng }, { lat: shelter.lat, lng: shelter.lon })
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

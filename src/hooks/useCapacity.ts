import { useState, useEffect } from 'react';
import type { Shelter } from '../types';
import {
  initCapacitySimulation,
  stopCapacitySimulation,
  subscribeCapacity,
  type CapacityData,
} from '../services/capacityService';

/**
 * Hook that initializes capacity simulation for the given shelters
 * and returns a live map of shelter ID -> capacity data.
 */
export function useCapacity(shelters: Shelter[]) {
  const [capacityMap, setCapacityMap] = useState<Map<string, CapacityData>>(
    new Map()
  );

  useEffect(() => {
    if (shelters.length === 0) return;

    initCapacitySimulation(shelters);

    const unsubscribe = subscribeCapacity((data) => {
      setCapacityMap(data);
    });

    return () => {
      unsubscribe();
      stopCapacitySimulation();
    };
  }, [shelters]);

  return capacityMap;
}

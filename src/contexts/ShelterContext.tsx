import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { Shelter } from '../types';
import type { ShelterWithDistance } from '../hooks/useShelters';
import type { CapacityData } from '../services/capacityService';

export interface ShelterContextValue {
  selectedShelterId: string | null;
  onShelterClick: (shelter: ShelterWithDistance) => void;
  onNavigateToShelter?: (shelter: ShelterWithDistance) => void;
  capacityMap: Map<string, CapacityData>;
  isLoaded: boolean;
  allShelters: Shelter[];
}

const ShelterContext = createContext<ShelterContextValue | null>(null);

export function ShelterProvider({
  value,
  children,
}: {
  value: ShelterContextValue;
  children: ReactNode;
}) {
  return (
    <ShelterContext.Provider value={value}>{children}</ShelterContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useShelterContext(): ShelterContextValue {
  const ctx = useContext(ShelterContext);
  if (!ctx) {
    throw new Error('useShelterContext must be used within a ShelterProvider');
  }
  return ctx;
}

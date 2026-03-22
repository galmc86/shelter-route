import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { LocationPoint } from '../types';

export interface EmergencyContextValue {
  emergencyMode: boolean;
  onEmergencyClick: () => void;
  onExitEmergency: () => void;
  currentLocation: LocationPoint | null;
  isLoadingLocation: boolean;
  locationError: string | null;
  onGetLocation: () => void;
  nearMeMode: boolean;
  onNearMeClick: () => void;
  onExitNearMe: () => void;
  onUseMapCenter: () => void;
}

const EmergencyContext = createContext<EmergencyContextValue | null>(null);

export function EmergencyProvider({
  value,
  children,
}: {
  value: EmergencyContextValue;
  children: ReactNode;
}) {
  return (
    <EmergencyContext.Provider value={value}>
      {children}
    </EmergencyContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useEmergencyContext(): EmergencyContextValue {
  const ctx = useContext(EmergencyContext);
  if (!ctx) {
    throw new Error('useEmergencyContext must be used within an EmergencyProvider');
  }
  return ctx;
}

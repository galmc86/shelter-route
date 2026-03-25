import { createContext, useContext, type ReactNode } from 'react';
import type { FamilyRepository } from '../services/familyRepository';

const FamilyRepositoryContext = createContext<FamilyRepository | null>(null);

export function FamilyRepositoryProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: FamilyRepository;
}) {
  return (
    <FamilyRepositoryContext.Provider value={value}>
      {children}
    </FamilyRepositoryContext.Provider>
  );
}

export function useFamilyRepositoryContext(): FamilyRepository | null {
  return useContext(FamilyRepositoryContext);
}


import { getMockFamilyRemoteGateway } from './mockFamilyRemoteGateway';
import type { FamilyGroup } from './familySafetyService';

export interface FamilyRemoteGateway {
  getGroup(groupCode: string): FamilyGroup | null;
  upsertGroup(group: FamilyGroup): FamilyGroup;
  clearGroup(groupCode: string): void;
  subscribe(groupCode: string, listener: () => void): () => void;
}

const familyRemoteGateway = getMockFamilyRemoteGateway();

export function getFamilyRemoteGateway(): FamilyRemoteGateway {
  return familyRemoteGateway;
}


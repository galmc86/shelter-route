import { getMockFamilyRemoteGateway } from './mockFamilyRemoteGateway';
import type { FamilyRemoteGroupRecord } from './familyRemoteModel';

export interface FamilyRemoteGateway {
  getGroup(groupCode: string): FamilyRemoteGroupRecord | null;
  upsertGroup(group: FamilyRemoteGroupRecord): FamilyRemoteGroupRecord;
  clearGroup(groupCode: string): void;
  subscribe(groupCode: string, listener: () => void): () => void;
}

const familyRemoteGateway = getMockFamilyRemoteGateway();

export function getFamilyRemoteGateway(): FamilyRemoteGateway {
  return familyRemoteGateway;
}

import { getMockFamilyRemoteGateway } from './mockFamilyRemoteGateway';
import type { FamilyRemoteGroupRecord } from './familyRemoteModel';
import type { FamilyRemoteSession } from './familyRemoteSessionService';

export interface FamilyRemoteGateway {
  getGroup(groupCode: string, session: FamilyRemoteSession): FamilyRemoteGroupRecord | null;
  upsertGroup(group: FamilyRemoteGroupRecord, session: FamilyRemoteSession): FamilyRemoteGroupRecord;
  clearGroup(groupCode: string, session: FamilyRemoteSession): void;
  subscribe(groupCode: string, session: FamilyRemoteSession, listener: () => void): () => void;
}

const familyRemoteGateway = getMockFamilyRemoteGateway();

export function getFamilyRemoteGateway(): FamilyRemoteGateway {
  return familyRemoteGateway;
}

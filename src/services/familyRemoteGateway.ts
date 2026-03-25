import { getBackendFamilyRemoteGateway } from './backendFamilyRemoteGateway';
import type { FamilyRemoteChangeEvent } from './familyRemoteChangeEvent';
import {
  getFamilyRemoteGatewayMode,
  type FamilyRemoteGatewayMode,
} from './familyRemoteGatewayModeService';
import { getMockFamilyRemoteGateway } from './mockFamilyRemoteGateway';
import type { FamilyRemoteGroupRecord } from './familyRemoteModel';
import type { FamilyRemoteSession } from './familyRemoteSessionService';

export interface FamilyRemoteGateway {
  getGroup(groupCode: string, session: FamilyRemoteSession): FamilyRemoteGroupRecord | null;
  upsertGroup(group: FamilyRemoteGroupRecord, session: FamilyRemoteSession): FamilyRemoteGroupRecord;
  clearGroup(groupCode: string, session: FamilyRemoteSession): void;
  subscribe(
    groupCode: string,
    session: FamilyRemoteSession,
    listener: (event: FamilyRemoteChangeEvent) => void
  ): () => void;
}

export function createFamilyRemoteGateway({
  mode = getFamilyRemoteGatewayMode(),
}: {
  mode?: FamilyRemoteGatewayMode;
} = {}): FamilyRemoteGateway {
  return mode === 'backend'
    ? getBackendFamilyRemoteGateway()
    : getMockFamilyRemoteGateway();
}

export function getFamilyRemoteGateway(): FamilyRemoteGateway {
  return createFamilyRemoteGateway();
}

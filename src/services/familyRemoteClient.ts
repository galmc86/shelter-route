import type { FamilyRemoteChangeEvent } from './familyRemoteChangeEvent';
import type { FamilyRemoteGroupRecord } from './familyRemoteModel';
import type { FamilyRemoteSession } from './familyRemoteSessionService';

export interface FamilyRemoteClient {
  fetchGroup(groupCode: string, session: FamilyRemoteSession): FamilyRemoteGroupRecord | null;
  upsertGroup(group: FamilyRemoteGroupRecord, session: FamilyRemoteSession): FamilyRemoteGroupRecord;
  clearGroup(groupCode: string, session: FamilyRemoteSession): void;
  subscribe(
    groupCode: string,
    session: FamilyRemoteSession,
    listener: (event: FamilyRemoteChangeEvent) => void
  ): () => void;
}

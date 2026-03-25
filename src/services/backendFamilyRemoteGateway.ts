import type { FamilyRemoteChangeEvent } from './familyRemoteChangeEvent';
import { getBackendFamilyRemoteClient } from './backendFamilyRemoteClient';
import type { FamilyRemoteClient } from './familyRemoteClient';
import type { FamilyRemoteGateway } from './familyRemoteGateway';
import type { FamilyRemoteGroupRecord } from './familyRemoteModel';
import type { FamilyRemoteSession } from './familyRemoteSessionService';

class BackendFamilyRemoteGateway implements FamilyRemoteGateway {
  private readonly client: FamilyRemoteClient;

  constructor(client: FamilyRemoteClient) {
    this.client = client;
  }

  getGroup(groupCode: string, session: FamilyRemoteSession): FamilyRemoteGroupRecord | null {
    return this.client.fetchGroup(groupCode, session);
  }

  upsertGroup(group: FamilyRemoteGroupRecord, session: FamilyRemoteSession): FamilyRemoteGroupRecord {
    return this.client.upsertGroup(group, session);
  }

  clearGroup(groupCode: string, session: FamilyRemoteSession): void {
    this.client.clearGroup(groupCode, session);
  }

  subscribe(
    groupCode: string,
    session: FamilyRemoteSession,
    listener: (event: FamilyRemoteChangeEvent) => void
  ): () => void {
    return this.client.subscribe(groupCode, session, listener);
  }
}

export function createBackendFamilyRemoteGateway({
  client = getBackendFamilyRemoteClient(),
}: {
  client?: FamilyRemoteClient;
} = {}): FamilyRemoteGateway {
  return new BackendFamilyRemoteGateway(client);
}

const backendFamilyRemoteGateway = createBackendFamilyRemoteGateway();

export function getBackendFamilyRemoteGateway(): FamilyRemoteGateway {
  return backendFamilyRemoteGateway;
}

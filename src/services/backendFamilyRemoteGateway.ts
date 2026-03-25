import type { FamilyRemoteGateway } from './familyRemoteGateway';
import type { FamilyRemoteGroupRecord } from './familyRemoteModel';
import type { FamilyRemoteSession } from './familyRemoteSessionService';

export class FamilyRemoteGatewayNotConfiguredError extends Error {
  constructor() {
    super('Family remote gateway backend is not configured');
    this.name = 'FamilyRemoteGatewayNotConfiguredError';
  }
}

class BackendFamilyRemoteGateway implements FamilyRemoteGateway {
  getGroup(_groupCode: string, _session: FamilyRemoteSession): FamilyRemoteGroupRecord | null {
    return null;
  }

  upsertGroup(_group: FamilyRemoteGroupRecord, _session: FamilyRemoteSession): FamilyRemoteGroupRecord {
    throw new FamilyRemoteGatewayNotConfiguredError();
  }

  clearGroup(_groupCode: string, _session: FamilyRemoteSession): void {
    throw new FamilyRemoteGatewayNotConfiguredError();
  }

  subscribe(_groupCode: string, _session: FamilyRemoteSession, _listener: () => void): () => void {
    return () => {};
  }
}

const backendFamilyRemoteGateway = new BackendFamilyRemoteGateway();

export function getBackendFamilyRemoteGateway(): FamilyRemoteGateway {
  return backendFamilyRemoteGateway;
}


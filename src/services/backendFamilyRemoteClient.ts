import type { FamilyRemoteClient } from './familyRemoteClient';
import { getFamilyRemoteClientMode, type FamilyRemoteClientMode } from './familyRemoteClientModeService';
import { getHttpFamilyRemoteClient } from './httpFamilyRemoteClient';
import type { FamilyRemoteGroupRecord } from './familyRemoteModel';
import type { FamilyRemoteSession } from './familyRemoteSessionService';

export class FamilyRemoteClientNotConfiguredError extends Error {
  constructor() {
    super('Family remote backend client is not configured');
    this.name = 'FamilyRemoteClientNotConfiguredError';
  }
}

class BackendFamilyRemoteClient implements FamilyRemoteClient {
  fetchGroup(_groupCode: string, _session: FamilyRemoteSession): FamilyRemoteGroupRecord | null {
    return null;
  }

  upsertGroup(_group: FamilyRemoteGroupRecord, _session: FamilyRemoteSession): FamilyRemoteGroupRecord {
    throw new FamilyRemoteClientNotConfiguredError();
  }

  clearGroup(_groupCode: string, _session: FamilyRemoteSession): void {
    throw new FamilyRemoteClientNotConfiguredError();
  }

  subscribe(_groupCode: string, _session: FamilyRemoteSession, _listener: () => void): () => void {
    return () => {};
  }
}

const backendFamilyRemoteClient = new BackendFamilyRemoteClient();

export function createBackendFamilyRemoteClient({
  mode = getFamilyRemoteClientMode(),
}: {
  mode?: FamilyRemoteClientMode;
} = {}): FamilyRemoteClient {
  return mode === 'http'
    ? getHttpFamilyRemoteClient()
    : backendFamilyRemoteClient;
}

export function getBackendFamilyRemoteClient(): FamilyRemoteClient {
  return createBackendFamilyRemoteClient();
}

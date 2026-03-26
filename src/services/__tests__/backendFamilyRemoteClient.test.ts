import { beforeEach, describe, expect, it } from 'vitest';
import {
  createBackendFamilyRemoteClient,
  FamilyRemoteClientNotConfiguredError,
  getBackendFamilyRemoteClient,
} from '../backendFamilyRemoteClient';
import { getFamilyRemoteSession } from '../familyRemoteSessionService';

describe('backendFamilyRemoteClient', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns no group by default and throws for mutating operations', () => {
    const client = getBackendFamilyRemoteClient();
    const session = getFamilyRemoteSession();

    expect(client.fetchGroup('ABC123', session)).toBeNull();
    expect(() => client.upsertGroup({
      id: 'family:ABC123',
      inviteCode: 'ABC123',
      version: 1,
      createdAt: '2026-03-25T23:30:00.000Z',
      updatedAt: '2026-03-25T23:30:00.000Z',
      createdByMemberId: 'member-1',
      members: [],
    }, session)).toThrow(FamilyRemoteClientNotConfiguredError);
  });

  it('can create the http-backed client shell explicitly', () => {
    const client = createBackendFamilyRemoteClient({ mode: 'http' });
    const session = getFamilyRemoteSession();

    expect(client.fetchGroup('ABC123', session)).toBeNull();
  });
});

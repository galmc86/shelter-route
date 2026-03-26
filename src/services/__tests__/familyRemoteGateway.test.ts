import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFamilyRemoteGateway, getFamilyRemoteGateway } from '../familyRemoteGateway';
import { getFamilyRemoteSession } from '../familyRemoteSessionService';
import { FAMILY_REMOTE_GATEWAY_STORAGE_KEY } from '../familyRemoteGatewayModeService';
import { FamilyRemoteClientNotConfiguredError } from '../backendFamilyRemoteClient';

describe('familyRemoteGateway', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
  });

  it('uses the mock gateway by default', () => {
    const gateway = getFamilyRemoteGateway();
    const session = getFamilyRemoteSession();

    expect(gateway.getGroup('ABC123', session)).toBeNull();
  });

  it('can create the backend stub gateway explicitly', () => {
    const gateway = createFamilyRemoteGateway({ mode: 'backend' });
    const session = getFamilyRemoteSession();

    expect(() => gateway.upsertGroup({
      id: 'family:ABC123',
      inviteCode: 'ABC123',
      version: 1,
      createdAt: '2026-03-25T23:00:00.000Z',
      updatedAt: '2026-03-25T23:00:00.000Z',
      createdByMemberId: 'member-1',
      members: [],
    }, session)).toThrow(FamilyRemoteClientNotConfiguredError);
  });

  it('selects the backend stub from persisted mode', () => {
    localStorage.setItem(FAMILY_REMOTE_GATEWAY_STORAGE_KEY, 'backend');
    const gateway = getFamilyRemoteGateway();
    const session = getFamilyRemoteSession();

    expect(() => gateway.clearGroup('ABC123', session)).toThrow(FamilyRemoteClientNotConfiguredError);
  });
});

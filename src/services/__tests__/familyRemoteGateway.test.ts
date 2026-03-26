import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getFamilyRemoteSession } from '../familyRemoteSessionService';
import { FAMILY_REMOTE_GATEWAY_STORAGE_KEY } from '../familyRemoteGatewayModeService';

describe('familyRemoteGateway', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_FAMILY_REMOTE_URL', '');
    vi.stubEnv('VITE_FAMILY_REMOTE_CLIENT', '');
  });

  it('uses the mock gateway by default', async () => {
    const { getFamilyRemoteGateway } = await import('../familyRemoteGateway');
    const gateway = getFamilyRemoteGateway();
    const session = getFamilyRemoteSession();

    expect(gateway.getGroup('ABC123', session)).toBeNull();
  });

  it('can create the backend stub gateway explicitly', async () => {
    const { createFamilyRemoteGateway } = await import('../familyRemoteGateway');
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
    }, session)).toThrow('Family remote backend client is not configured');
  });

  it('selects the backend stub from persisted mode', async () => {
    localStorage.setItem(FAMILY_REMOTE_GATEWAY_STORAGE_KEY, 'backend');
    const { getFamilyRemoteGateway } = await import('../familyRemoteGateway');
    const gateway = getFamilyRemoteGateway();
    const session = getFamilyRemoteSession();

    expect(() => gateway.clearGroup('ABC123', session)).toThrow('Family remote backend client is not configured');
  });
});

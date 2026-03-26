import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  decodeFamilyRemoteGroupResponse,
  encodeFamilyRemotePushSubscriptionRequest,
  encodeFamilyRemoteGroupRequest,
  getFamilyRemoteGroupEndpoint,
  getFamilyRemotePushPublicKeyEndpoint,
  getFamilyRemotePushSubscriptionRegisterEndpoint,
  getFamilyRemotePushSubscriptionUnregisterEndpoint,
} from '../familyRemoteHttpContract';

describe('familyRemoteHttpContract', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_FAMILY_REMOTE_URL', '');
  });

  it('builds the group endpoint from the configured base URL', async () => {
    vi.stubEnv('VITE_FAMILY_REMOTE_URL', 'https://family.example.com/api');
    const {
      getFamilyRemoteGroupEndpoint: getEndpoint,
      getFamilyRemotePushPublicKeyEndpoint: getPublicKeyEndpoint,
      getFamilyRemotePushSubscriptionRegisterEndpoint: getRegisterEndpoint,
      getFamilyRemotePushSubscriptionUnregisterEndpoint: getUnregisterEndpoint,
    } = await import('../familyRemoteHttpContract');

    expect(getEndpoint('abc123')).toBe('https://family.example.com/api/ABC123');
    expect(getPublicKeyEndpoint()).toBe('https://family.example.com/api/push/public-key');
    expect(getRegisterEndpoint('abc123')).toBe('https://family.example.com/api/ABC123/push-subscriptions');
    expect(getUnregisterEndpoint('abc123')).toBe('https://family.example.com/api/ABC123/push-subscriptions/unregister');
  });

  it('encodes and decodes the remote group payload shape', () => {
    const record = encodeFamilyRemoteGroupRequest({
      id: 'family:ABC123',
      inviteCode: 'abc123',
      version: 2,
      createdAt: '2026-03-26T00:30:00.000Z',
      updatedAt: '2026-03-26T00:30:00.000Z',
      createdByMemberId: 'member-1',
      members: [
        {
          id: 'member-1',
          name: 'Dana',
          role: 'owner',
          status: 'safe',
          joinedAt: '2026-03-26T00:30:00.000Z',
        },
      ],
    });

    expect(record.inviteCode).toBe('ABC123');
    expect(decodeFamilyRemoteGroupResponse(record)).toEqual(record);
  });

  it('throws on malformed response payloads', () => {
    expect(() => decodeFamilyRemoteGroupResponse({ inviteCode: 'ABC123' })).toThrow();
  });

  it('defaults missing record versions to zero for older stored payloads', () => {
    const record = decodeFamilyRemoteGroupResponse({
      id: 'family:ABC123',
      inviteCode: 'ABC123',
      createdAt: '2026-03-26T00:30:00.000Z',
      updatedAt: '2026-03-26T00:30:00.000Z',
      createdByMemberId: 'member-1',
      members: [],
    });

    expect(record.version).toBe(0);
  });

  it('returns null endpoint when the base URL is missing', () => {
    expect(getFamilyRemoteGroupEndpoint('ABC123')).toBeNull();
    expect(getFamilyRemotePushPublicKeyEndpoint()).toBeNull();
    expect(getFamilyRemotePushSubscriptionRegisterEndpoint('ABC123')).toBeNull();
    expect(getFamilyRemotePushSubscriptionUnregisterEndpoint('ABC123')).toBeNull();
  });

  it('encodes browser push subscriptions for the backend contract', () => {
    expect(encodeFamilyRemotePushSubscriptionRequest({
      endpoint: 'https://push.example.com/subscription',
      expirationTime: null,
      keys: {
        p256dh: 'p256dh-key',
        auth: 'auth-key',
      },
    })).toEqual({
      endpoint: 'https://push.example.com/subscription',
      expirationTime: null,
      keys: {
        p256dh: 'p256dh-key',
        auth: 'auth-key',
      },
    });
  });
});

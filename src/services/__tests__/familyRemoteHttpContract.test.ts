import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  decodeFamilyRemoteGroupResponse,
  encodeFamilyRemoteGroupRequest,
  getFamilyRemoteGroupEndpoint,
} from '../familyRemoteHttpContract';

describe('familyRemoteHttpContract', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('builds the group endpoint from the configured base URL', async () => {
    vi.stubEnv('VITE_FAMILY_REMOTE_URL', 'https://family.example.com/api');
    const { getFamilyRemoteGroupEndpoint: getEndpoint } = await import('../familyRemoteHttpContract');

    expect(getEndpoint('abc123')).toBe('https://family.example.com/api/ABC123');
  });

  it('encodes and decodes the remote group payload shape', () => {
    const record = encodeFamilyRemoteGroupRequest({
      id: 'family:ABC123',
      inviteCode: 'abc123',
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

  it('returns null endpoint when the base URL is missing', () => {
    expect(getFamilyRemoteGroupEndpoint('ABC123')).toBeNull();
  });
});


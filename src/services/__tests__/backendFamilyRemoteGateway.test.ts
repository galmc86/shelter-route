import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBackendFamilyRemoteGateway } from '../backendFamilyRemoteGateway';
import type { FamilyRemoteClient } from '../familyRemoteClient';
import { getFamilyRemoteSession } from '../familyRemoteSessionService';

describe('backendFamilyRemoteGateway', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('delegates fetch, upsert, clear, and subscribe to the backend client', () => {
    const session = getFamilyRemoteSession();
    const listener = vi.fn();
    const unsubscribe = vi.fn();
    const client: FamilyRemoteClient = {
      fetchGroup: vi.fn(() => null),
      upsertGroup: vi.fn((record) => record),
      clearGroup: vi.fn(),
      subscribe: vi.fn(() => unsubscribe),
    };

    const gateway = createBackendFamilyRemoteGateway({ client });
    const record = {
      id: 'family:ABC123',
      inviteCode: 'ABC123',
      version: 1,
      createdAt: '2026-03-25T23:35:00.000Z',
      updatedAt: '2026-03-25T23:35:00.000Z',
      createdByMemberId: 'member-1',
      members: [],
    };

    expect(gateway.getGroup('ABC123', session)).toBeNull();
    expect(gateway.upsertGroup(record, session)).toEqual(record);
    gateway.clearGroup('ABC123', session);
    const teardown = gateway.subscribe('ABC123', session, listener);
    teardown();

    expect(client.fetchGroup).toHaveBeenCalledWith('ABC123', session);
    expect(client.upsertGroup).toHaveBeenCalledWith(record, session);
    expect(client.clearGroup).toHaveBeenCalledWith('ABC123', session);
    expect(client.subscribe).toHaveBeenCalledWith('ABC123', session, listener);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});

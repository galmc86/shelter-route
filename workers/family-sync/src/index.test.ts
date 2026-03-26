import { describe, expect, it } from 'vitest';
import worker, {
  decodeFamilyRemoteGroupRecord,
  getCorsHeaders,
  normalizeGroupCode,
  type Env,
  type FamilyRemoteGroupRecord,
  type KeyValueStore,
} from './index';

class MemoryStore implements KeyValueStore {
  private readonly store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

function createEnv(): Env {
  return {
    FAMILY_GROUPS: new MemoryStore(),
    ALLOWED_ORIGINS: 'https://shelter-route.pages.dev,http://localhost:5174',
  };
}

const recordFixture: FamilyRemoteGroupRecord = {
  id: 'family:ABC123',
  inviteCode: 'ABC123',
  version: 0,
  createdAt: '2026-03-26T10:00:00.000Z',
  updatedAt: '2026-03-26T10:00:00.000Z',
  createdByMemberId: 'member-1',
  members: [
    {
      id: 'member-1',
      name: 'Dana',
      deviceId: 'device-1',
      role: 'owner',
      status: 'safe',
      joinedAt: '2026-03-26T10:00:00.000Z',
      lastStatusAt: '2026-03-26T10:00:00.000Z',
      lastSeenAt: '2026-03-26T10:00:00.000Z',
    },
  ],
};

describe('family-sync worker', () => {
  it('normalizes family group codes', () => {
    expect(normalizeGroupCode(' abc123 ')).toBe('ABC123');
    expect(normalizeGroupCode('../bad')).toBeNull();
  });

  it('builds CORS headers only for allowed origins', () => {
    const env = createEnv();

    expect(getCorsHeaders('https://shelter-route.pages.dev', env)['Access-Control-Allow-Origin'])
      .toBe('https://shelter-route.pages.dev');
    expect(getCorsHeaders('https://example.com', env)).toEqual({});
  });

  it('validates family group payloads against the request path', () => {
    expect(() => decodeFamilyRemoteGroupRecord(recordFixture, 'ABC123')).not.toThrow();
    expect(() => decodeFamilyRemoteGroupRecord({ ...recordFixture, inviteCode: 'ZZZ999' }, 'ABC123'))
      .toThrow('Family remote group code does not match request path');
  });

  it('supports PUT/GET/DELETE round-trips for family groups', async () => {
    const env = createEnv();
    const origin = 'https://shelter-route.pages.dev';

    const putResponse = await worker.fetch(new Request('https://family-sync.example/ABC123', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Origin: origin,
      },
      body: JSON.stringify(recordFixture),
    }), env);

    expect(putResponse.status).toBe(200);
    const created = await putResponse.json() as FamilyRemoteGroupRecord;
    expect(created.id).toBe(recordFixture.id);
    expect(created.inviteCode).toBe(recordFixture.inviteCode);
    expect(created.version).toBe(1);
    expect(created.createdAt).toBe(recordFixture.createdAt);
    expect(created.createdByMemberId).toBe(recordFixture.createdByMemberId);
    expect(created.members).toEqual(recordFixture.members);
    expect(created.updatedAt).not.toBe(recordFixture.updatedAt);

    const getResponse = await worker.fetch(new Request('https://family-sync.example/abc123', {
      headers: { Origin: origin },
    }), env);

    expect(getResponse.status).toBe(200);
    expect(await getResponse.json()).toEqual(created);

    const deleteResponse = await worker.fetch(new Request('https://family-sync.example/ABC123', {
      method: 'DELETE',
      headers: { Origin: origin },
    }), env);

    expect(deleteResponse.status).toBe(200);
    expect(await deleteResponse.json()).toEqual({ deleted: true });

    const missingResponse = await worker.fetch(new Request('https://family-sync.example/ABC123', {
      headers: { Origin: origin },
    }), env);

    expect(missingResponse.status).toBe(404);
  });

  it('rejects stale writes with a 409 and returns the latest stored record', async () => {
    const env = createEnv();
    const origin = 'https://shelter-route.pages.dev';

    const firstPut = await worker.fetch(new Request('https://family-sync.example/ABC123', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Origin: origin,
      },
      body: JSON.stringify(recordFixture),
    }), env);

    expect(firstPut.status).toBe(200);
    const current = await firstPut.json() as FamilyRemoteGroupRecord;
    expect(current.version).toBe(1);

    const secondPut = await worker.fetch(new Request('https://family-sync.example/ABC123', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Origin: origin,
      },
      body: JSON.stringify({
        ...current,
        members: [
          ...current.members,
          {
            id: 'member-2',
            name: 'Noam',
            role: 'member',
            status: 'needs_check_in',
            joinedAt: '2026-03-26T10:05:00.000Z',
          },
        ],
      }),
    }), env);

    expect(secondPut.status).toBe(200);
    const updated = await secondPut.json() as FamilyRemoteGroupRecord;
    expect(updated.version).toBe(2);

    const stalePut = await worker.fetch(new Request('https://family-sync.example/ABC123', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Origin: origin,
      },
      body: JSON.stringify(current),
    }), env);

    expect(stalePut.status).toBe(409);
    expect(await stalePut.json()).toEqual({
      error: 'Family record version conflict',
      latest: updated,
    });
  });
});

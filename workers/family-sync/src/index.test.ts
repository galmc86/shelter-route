import { describe, expect, it } from 'vitest';
import worker, {
  FamilyGroupDurableObject,
  decodeFamilyRemoteGroupRecord,
  type DurableObjectNamespaceLike,
  type DurableObjectStateLike,
  type DurableObjectStorageLike,
  getCorsHeaders,
  normalizeGroupCode,
  type Env,
  type FamilyRemoteGroupRecord,
} from './index';

class MemoryDurableObjectStorage implements DurableObjectStorageLike {
  private readonly store = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    return this.store.get(key) as T | undefined;
  }

  async put<T>(key: string, value: T): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }
}

class MemoryDurableObjectState implements DurableObjectStateLike {
  storage = new MemoryDurableObjectStorage();
}

class MemoryDurableObjectNamespace implements DurableObjectNamespaceLike {
  private readonly states = new Map<string, MemoryDurableObjectState>();
  private env: Env | null = null;

  attachEnv(env: Env): void {
    this.env = env;
  }

  idFromName(name: string): string {
    return name.toUpperCase();
  }

  get(id: unknown) {
    const key = String(id);
    let state = this.states.get(key);
    if (!state) {
      state = new MemoryDurableObjectState();
      this.states.set(key, state);
    }

    return {
      fetch: (input: Request | string, init?: RequestInit) => {
        if (!this.env) {
          throw new Error('Memory durable object namespace is not attached to an env');
        }

        const request = input instanceof Request
          ? new Request(input, init)
          : new Request(input, init);
        const object = new FamilyGroupDurableObject(state, this.env);
        return object.fetch(request);
      },
    };
  }
}

function createEnv(): Env {
  const namespace = new MemoryDurableObjectNamespace();
  const env: Env = {
    FAMILY_GROUPS_DO: namespace,
    ALLOWED_ORIGINS: 'https://shelter-route.pages.dev,http://localhost:5174',
  };
  namespace.attachEnv(env);
  return env;
}

function createSessionHeaders({
  deviceId,
  userId,
  authState = 'anonymous',
  origin = 'https://shelter-route.pages.dev',
}: {
  deviceId?: string;
  userId?: string;
  authState?: 'anonymous' | 'authenticated';
  origin?: string;
} = {}): Record<string, string> {
  return {
    Origin: origin,
    ...(deviceId ? { 'X-Family-Device-Id': deviceId } : {}),
    ...(userId ? { 'X-Family-User-Id': userId } : {}),
    'X-Family-Auth-State': authState,
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
        ...createSessionHeaders({ deviceId: 'device-1', origin }),
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
      headers: createSessionHeaders({ deviceId: 'device-1', origin }),
    }), env);

    expect(deleteResponse.status).toBe(200);
    expect(await deleteResponse.json()).toEqual({ deleted: true });

    const missingResponse = await worker.fetch(new Request('https://family-sync.example/ABC123', {
      headers: { Origin: origin },
    }), env);

    expect(missingResponse.status).toBe(404);
  });

  it('exposes the configured web push public key at the top-level endpoint', async () => {
    const env = createEnv();
    env.WEB_PUSH_PUBLIC_KEY = 'public-key-value';
    env.WEB_PUSH_PRIVATE_KEY = 'private-key-value';

    const response = await worker.fetch(new Request('https://family-sync.example/push/public-key', {
      headers: { Origin: 'https://shelter-route.pages.dev' },
    }), env);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      enabled: true,
      publicKey: 'public-key-value',
    });
  });

  it('registers and unregisters family push subscriptions per group', async () => {
    const env = createEnv();
    const origin = 'https://shelter-route.pages.dev';

    const putResponse = await worker.fetch(new Request('https://family-sync.example/ABC123', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...createSessionHeaders({ deviceId: 'device-1', origin }),
      },
      body: JSON.stringify(recordFixture),
    }), env);

    expect(putResponse.status).toBe(200);

    const registerResponse = await worker.fetch(new Request('https://family-sync.example/ABC123/push-subscriptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...createSessionHeaders({ deviceId: 'device-1', origin }),
      },
      body: JSON.stringify({
        subscription: {
          endpoint: 'https://push.example.com/subscription-1',
          expirationTime: null,
          keys: {
            p256dh: 'p256dh-key',
            auth: 'auth-key',
          },
        },
      }),
    }), env);

    expect(registerResponse.status).toBe(200);
    expect(await registerResponse.json()).toEqual({ registered: true });

    const unregisterResponse = await worker.fetch(new Request('https://family-sync.example/ABC123/push-subscriptions/unregister', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...createSessionHeaders({ deviceId: 'device-1', origin }),
      },
      body: JSON.stringify({
        endpoint: 'https://push.example.com/subscription-1',
      }),
    }), env);

    expect(unregisterResponse.status).toBe(200);
    expect(await unregisterResponse.json()).toEqual({ unregistered: true });
  });

  it('rejects stale writes with a 409 and returns the latest stored record', async () => {
    const env = createEnv();
    const origin = 'https://shelter-route.pages.dev';

    const firstPut = await worker.fetch(new Request('https://family-sync.example/ABC123', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...createSessionHeaders({ deviceId: 'device-1', origin }),
      },
      body: JSON.stringify(recordFixture),
    }), env);

    expect(firstPut.status).toBe(200);
    const current = await firstPut.json() as FamilyRemoteGroupRecord;
    expect(current.version).toBe(1);

    const joinPayload: FamilyRemoteGroupRecord = {
      ...current,
      members: [
        {
          id: 'member-2',
          name: 'Noam',
          deviceId: 'device-2',
          role: 'member',
          status: 'needs_check_in',
          joinedAt: '2026-03-26T10:05:00.000Z',
        },
        ...current.members,
      ],
    };

    const secondPut = await worker.fetch(new Request('https://family-sync.example/ABC123', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...createSessionHeaders({ deviceId: 'device-2', origin }),
      },
      body: JSON.stringify(joinPayload),
    }), env);

    expect(secondPut.status).toBe(200);
    const updated = await secondPut.json() as FamilyRemoteGroupRecord;
    expect(updated.version).toBe(2);

    const stalePut = await worker.fetch(new Request('https://family-sync.example/ABC123', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...createSessionHeaders({ deviceId: 'device-2', origin }),
      },
      body: JSON.stringify(joinPayload),
    }), env);

    expect(stalePut.status).toBe(409);
    expect(await stalePut.json()).toEqual({
      error: 'Family record version conflict',
      latest: updated,
    });
  });

  it('rejects creating a family group when the request session is not present in the payload', async () => {
    const env = createEnv();

    const response = await worker.fetch(new Request('https://family-sync.example/ABC123', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...createSessionHeaders({ deviceId: 'device-999' }),
      },
      body: JSON.stringify(recordFixture),
    }), env);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: 'Family sync write is not authorized for this session',
    });
  });

  it('allows a second device to join an existing family without modifying existing members', async () => {
    const env = createEnv();

    const initialResponse = await worker.fetch(new Request('https://family-sync.example/ABC123', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...createSessionHeaders({ deviceId: 'device-1' }),
      },
      body: JSON.stringify(recordFixture),
    }), env);
    const current = await initialResponse.json() as FamilyRemoteGroupRecord;

    const joinResponse = await worker.fetch(new Request('https://family-sync.example/ABC123', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...createSessionHeaders({ deviceId: 'device-2' }),
      },
      body: JSON.stringify({
        ...current,
        members: [
          {
            id: 'member-2',
            name: 'Noam',
            deviceId: 'device-2',
            role: 'member',
            status: 'unknown',
            joinedAt: '2026-03-26T10:05:00.000Z',
          },
          ...current.members,
        ],
      }),
    }), env);

    expect(joinResponse.status).toBe(200);
    const updated = await joinResponse.json() as FamilyRemoteGroupRecord;
    expect(updated.version).toBe(2);
    expect(updated.members.map((member) => member.deviceId)).toEqual(['device-2', 'device-1']);
  });

  it('rejects non-member updates that rewrite an existing family group', async () => {
    const env = createEnv();

    const initialResponse = await worker.fetch(new Request('https://family-sync.example/ABC123', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...createSessionHeaders({ deviceId: 'device-1' }),
      },
      body: JSON.stringify(recordFixture),
    }), env);
    const current = await initialResponse.json() as FamilyRemoteGroupRecord;

    const maliciousResponse = await worker.fetch(new Request('https://family-sync.example/ABC123', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...createSessionHeaders({ deviceId: 'device-2' }),
      },
      body: JSON.stringify({
        ...current,
        members: [
          {
            ...current.members[0],
            status: 'needs_check_in',
          },
          {
            id: 'member-2',
            name: 'Noam',
            deviceId: 'device-2',
            role: 'member',
            status: 'unknown',
            joinedAt: '2026-03-26T10:05:00.000Z',
          },
        ],
      }),
    }), env);

    expect(maliciousResponse.status).toBe(403);
    expect(await maliciousResponse.json()).toEqual({
      error: 'Family sync write is not authorized for this session',
    });
  });

  it('allows an existing member to update their own status', async () => {
    const env = createEnv();

    const initialResponse = await worker.fetch(new Request('https://family-sync.example/ABC123', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...createSessionHeaders({ deviceId: 'device-1' }),
      },
      body: JSON.stringify(recordFixture),
    }), env);
    const current = await initialResponse.json() as FamilyRemoteGroupRecord;

    const updateResponse = await worker.fetch(new Request('https://family-sync.example/ABC123', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...createSessionHeaders({ deviceId: 'device-1' }),
      },
      body: JSON.stringify({
        ...current,
        members: current.members.map((member) => (
          member.deviceId === 'device-1'
            ? {
                ...member,
                status: 'needs_check_in',
                lastStatusAt: '2026-03-26T10:10:00.000Z',
              }
            : member
        )),
      }),
    }), env);

    expect(updateResponse.status).toBe(200);
    const updated = await updateResponse.json() as FamilyRemoteGroupRecord;
    expect(updated.members[0].status).toBe('needs_check_in');
  });

  it('rejects deleting a family group when the requester is not the last remaining member', async () => {
    const env = createEnv();

    const initialResponse = await worker.fetch(new Request('https://family-sync.example/ABC123', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...createSessionHeaders({ deviceId: 'device-1' }),
      },
      body: JSON.stringify({
        ...recordFixture,
        members: [
          ...recordFixture.members,
          {
            id: 'member-2',
            name: 'Noam',
            deviceId: 'device-2',
            role: 'member',
            status: 'unknown',
            joinedAt: '2026-03-26T10:05:00.000Z',
          },
        ],
      }),
    }), env);

    expect(initialResponse.status).toBe(200);

    const deleteResponse = await worker.fetch(new Request('https://family-sync.example/ABC123', {
      method: 'DELETE',
      headers: createSessionHeaders({ deviceId: 'device-1' }),
    }), env);

    expect(deleteResponse.status).toBe(403);
    expect(await deleteResponse.json()).toEqual({
      error: 'Family sync delete is not authorized for this session',
    });
  });

  it('rejects deleting a family group when the requester does not belong to it', async () => {
    const env = createEnv();

    const initialResponse = await worker.fetch(new Request('https://family-sync.example/ABC123', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...createSessionHeaders({ deviceId: 'device-1' }),
      },
      body: JSON.stringify(recordFixture),
    }), env);

    expect(initialResponse.status).toBe(200);

    const deleteResponse = await worker.fetch(new Request('https://family-sync.example/ABC123', {
      method: 'DELETE',
      headers: createSessionHeaders({ deviceId: 'device-2' }),
    }), env);

    expect(deleteResponse.status).toBe(403);
    expect(await deleteResponse.json()).toEqual({
      error: 'Family sync delete is not authorized for this session',
    });
  });
});

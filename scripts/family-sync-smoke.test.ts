import { describe, expect, it } from 'vitest';
import worker, {
  FamilyGroupDurableObject,
  type DurableObjectNamespaceLike,
  type DurableObjectStateLike,
  type DurableObjectStorageLike,
  type Env,
} from '../workers/family-sync/src/index';
import {
  readFamilySyncSmokeCliOptions,
  runFamilySyncSmokeTest,
} from './family-sync-smoke';

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
  };
  namespace.attachEnv(env);
  return env;
}

describe('family-sync-smoke script', () => {
  it('exercises the worker contract across create, join, leave, and delete', async () => {
    const env = createEnv();

    const result = await runFamilySyncSmokeTest({
      baseUrl: 'https://family-sync.example',
      groupCode: 'SMOKE1',
      fetchImpl: (input, init) => {
        const request = input instanceof Request
          ? new Request(input, init)
          : new Request(typeof input === 'string' ? input : input.toString(), init);

        return worker.fetch(request, env);
      },
    });

    expect(result.groupCode).toBe('SMOKE1');

    const finalResponse = await worker.fetch(new Request('https://family-sync.example/SMOKE1'), env);
    expect(finalResponse.status).toBe(404);
  });

  it('parses CLI flags for a fixed group code and optional auth-rejoin disable', () => {
    const options = readFamilySyncSmokeCliOptions(
      ['--url=https://family-sync.example/', '--group-code=smoke9', '--no-auth-rejoin'],
      {}
    );

    expect(options).toEqual({
      baseUrl: 'https://family-sync.example/',
      groupCode: 'SMOKE9',
      includeAuthenticatedRejoin: false,
    });
  });
});

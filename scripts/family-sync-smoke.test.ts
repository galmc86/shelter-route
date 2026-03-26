import { describe, expect, it } from 'vitest';
import worker, {
  type Env,
  type KeyValueStore,
} from '../workers/family-sync/src/index';
import {
  readFamilySyncSmokeCliOptions,
  runFamilySyncSmokeTest,
} from './family-sync-smoke';

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
  };
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

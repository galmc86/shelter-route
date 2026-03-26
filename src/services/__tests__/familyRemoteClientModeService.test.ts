import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FAMILY_REMOTE_CLIENT_STORAGE_KEY } from '../familyRemoteClientModeService';

describe('familyRemoteClientModeService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('defaults to the stub backend client', async () => {
    vi.stubEnv('VITE_FAMILY_REMOTE_URL', '');
    vi.stubEnv('VITE_FAMILY_REMOTE_CLIENT', '');
    const { getFamilyRemoteClientMode } = await import('../familyRemoteClientModeService');

    expect(getFamilyRemoteClientMode()).toBe('stub');
  });

  it('accepts an http client override from the query string', async () => {
    const { initializeFamilyRemoteClientModeFromUrl } = await import('../familyRemoteClientModeService');

    expect(initializeFamilyRemoteClientModeFromUrl('?familyRemoteClient=http')).toBe('http');
    expect(localStorage.getItem(FAMILY_REMOTE_CLIENT_STORAGE_KEY)).toBe('http');
  });

  it('falls back to the env client mode when no query or storage override is present', async () => {
    vi.stubEnv('VITE_FAMILY_REMOTE_CLIENT', 'http');
    const { getFamilyRemoteClientMode } = await import('../familyRemoteClientModeService');

    expect(getFamilyRemoteClientMode()).toBe('http');
  });

  it('defaults to the http client when a family remote URL is configured', async () => {
    vi.stubEnv('VITE_FAMILY_REMOTE_URL', 'https://family-sync.example');
    const { getFamilyRemoteClientMode } = await import('../familyRemoteClientModeService');

    expect(getFamilyRemoteClientMode()).toBe('http');
  });
});

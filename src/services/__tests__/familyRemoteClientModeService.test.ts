import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FAMILY_REMOTE_CLIENT_STORAGE_KEY,
  getFamilyRemoteClientMode,
  initializeFamilyRemoteClientModeFromUrl,
} from '../familyRemoteClientModeService';

describe('familyRemoteClientModeService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
  });

  it('defaults to the stub backend client', () => {
    expect(getFamilyRemoteClientMode()).toBe('stub');
  });

  it('accepts an http client override from the query string', () => {
    expect(initializeFamilyRemoteClientModeFromUrl('?familyRemoteClient=http')).toBe('http');
    expect(localStorage.getItem(FAMILY_REMOTE_CLIENT_STORAGE_KEY)).toBe('http');
  });

  it('falls back to the env client mode when no query or storage override is present', () => {
    vi.stubEnv('VITE_FAMILY_REMOTE_CLIENT', 'http');

    expect(getFamilyRemoteClientMode()).toBe('http');
  });
});


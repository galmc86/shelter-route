import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FAMILY_SYNC_MODE_STORAGE_KEY,
  getFamilySyncMode,
  initializeFamilySyncModeFromUrl,
} from '../familySyncModeService';

describe('familySyncModeService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_FAMILY_REMOTE_URL', '');
    vi.stubEnv('VITE_FAMILY_SYNC_MODE', '');
  });

  it('defaults to local mode', () => {
    expect(getFamilySyncMode()).toBe('local');
  });

  it('accepts a hybrid mode override from the query string', () => {
    expect(initializeFamilySyncModeFromUrl('?familySyncMode=hybrid')).toBe('hybrid');
    expect(localStorage.getItem(FAMILY_SYNC_MODE_STORAGE_KEY)).toBe('hybrid');
  });

  it('falls back to the env mode when no query or storage override is present', () => {
    vi.stubEnv('VITE_FAMILY_SYNC_MODE', 'hybrid');

    expect(getFamilySyncMode()).toBe('hybrid');
  });

  it('implicitly enables hybrid mode when a family backend URL is configured', () => {
    vi.stubEnv('VITE_FAMILY_REMOTE_URL', 'https://family-sync.example');

    expect(getFamilySyncMode()).toBe('hybrid');
  });

  it('migrates stale local storage to hybrid when a family backend URL is configured', () => {
    vi.stubEnv('VITE_FAMILY_REMOTE_URL', 'https://family-sync.example');
    localStorage.setItem(FAMILY_SYNC_MODE_STORAGE_KEY, 'local');

    expect(initializeFamilySyncModeFromUrl()).toBe('hybrid');
    expect(localStorage.getItem(FAMILY_SYNC_MODE_STORAGE_KEY)).toBe('hybrid');
  });

  it('still allows an explicit local query override even when a family backend URL is configured', () => {
    vi.stubEnv('VITE_FAMILY_REMOTE_URL', 'https://family-sync.example');

    expect(initializeFamilySyncModeFromUrl('?familySyncMode=local')).toBe('local');
    expect(localStorage.getItem(FAMILY_SYNC_MODE_STORAGE_KEY)).toBe('local');
  });
});

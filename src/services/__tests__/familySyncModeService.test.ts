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
});


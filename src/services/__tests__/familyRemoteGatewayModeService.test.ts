import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FAMILY_REMOTE_GATEWAY_STORAGE_KEY,
  getFamilyRemoteGatewayMode,
  initializeFamilyRemoteGatewayModeFromUrl,
} from '../familyRemoteGatewayModeService';

describe('familyRemoteGatewayModeService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
  });

  it('defaults to the mock gateway', () => {
    expect(getFamilyRemoteGatewayMode()).toBe('mock');
  });

  it('accepts a backend mode override from the query string', () => {
    expect(initializeFamilyRemoteGatewayModeFromUrl('?familyRemoteGateway=backend')).toBe('backend');
    expect(localStorage.getItem(FAMILY_REMOTE_GATEWAY_STORAGE_KEY)).toBe('backend');
  });

  it('falls back to the env gateway mode when no query or storage override is present', () => {
    vi.stubEnv('VITE_FAMILY_REMOTE_GATEWAY', 'backend');

    expect(getFamilyRemoteGatewayMode()).toBe('backend');
  });

  it('defaults to the backend gateway when a family remote URL is configured', () => {
    vi.stubEnv('VITE_FAMILY_REMOTE_URL', 'https://family-sync.example');

    expect(getFamilyRemoteGatewayMode()).toBe('backend');
  });
});

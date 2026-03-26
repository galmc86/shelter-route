import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FAMILY_REMOTE_AUTH_STATE_STORAGE_KEY,
  FAMILY_REMOTE_USER_ID_STORAGE_KEY,
  getFamilyRemoteSession,
  initializeFamilyRemoteSessionFromUrl,
} from '../familyRemoteSessionService';

describe('familyRemoteSessionService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
  });

  it('provides a stable anonymous remote session by default', () => {
    const first = getFamilyRemoteSession();
    const second = getFamilyRemoteSession();

    expect(first.authState).toBe('anonymous');
    expect(first.userId).toBeNull();
    expect(first.deviceId).toBe(second.deviceId);
  });

  it('accepts an authenticated session override from the query string', () => {
    const session = initializeFamilyRemoteSessionFromUrl(
      '?familyRemoteAuthState=authenticated&familyRemoteUserId=user-123'
    );

    expect(session.authState).toBe('authenticated');
    expect(session.userId).toBe('user-123');
    expect(localStorage.getItem(FAMILY_REMOTE_AUTH_STATE_STORAGE_KEY)).toBe('authenticated');
    expect(localStorage.getItem(FAMILY_REMOTE_USER_ID_STORAGE_KEY)).toBe('user-123');
  });

  it('allows the query string to clear an authenticated session back to anonymous', () => {
    localStorage.setItem(FAMILY_REMOTE_AUTH_STATE_STORAGE_KEY, 'authenticated');
    localStorage.setItem(FAMILY_REMOTE_USER_ID_STORAGE_KEY, 'user-123');

    const session = initializeFamilyRemoteSessionFromUrl('?familyRemoteAuthState=anonymous');

    expect(session.authState).toBe('anonymous');
    expect(session.userId).toBeNull();
    expect(localStorage.getItem(FAMILY_REMOTE_AUTH_STATE_STORAGE_KEY)).toBe('anonymous');
    expect(localStorage.getItem(FAMILY_REMOTE_USER_ID_STORAGE_KEY)).toBeNull();
  });

  it('falls back to env-configured authenticated identity when no query or storage override is present', () => {
    vi.stubEnv('VITE_FAMILY_REMOTE_AUTH_STATE', 'authenticated');
    vi.stubEnv('VITE_FAMILY_REMOTE_USER_ID', 'env-user');

    const session = getFamilyRemoteSession();

    expect(session.authState).toBe('authenticated');
    expect(session.userId).toBe('env-user');
  });
});

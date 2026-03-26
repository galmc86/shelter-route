import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearFamilyRemoteAuthSessionConfig,
  FAMILY_REMOTE_AUTH_STATE_STORAGE_KEY,
  FAMILY_REMOTE_USER_ID_STORAGE_KEY,
  getFamilyRemoteSession,
  initializeFamilyRemoteSessionFromUrl,
  registerFamilyRemoteAuthProvider,
  setFamilyRemoteAuthSessionConfig,
  subscribeToFamilyRemoteAuthChanges,
} from '../familyRemoteSessionService';

describe('familyRemoteSessionService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
    registerFamilyRemoteAuthProvider(null);
    setFamilyRemoteAuthSessionConfig(null);
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

  it('lets the built-in auth bridge set an authenticated family sync session', () => {
    const session = setFamilyRemoteAuthSessionConfig({
      authState: 'authenticated',
      userId: 'bridge-user',
    });

    expect(session.authState).toBe('authenticated');
    expect(session.userId).toBe('bridge-user');
    expect(localStorage.getItem(FAMILY_REMOTE_AUTH_STATE_STORAGE_KEY)).toBe('authenticated');
    expect(localStorage.getItem(FAMILY_REMOTE_USER_ID_STORAGE_KEY)).toBe('bridge-user');
  });

  it('lets the built-in auth bridge clear back to anonymous', () => {
    setFamilyRemoteAuthSessionConfig({
      authState: 'authenticated',
      userId: 'bridge-user',
    });

    const session = clearFamilyRemoteAuthSessionConfig();

    expect(session.authState).toBe('anonymous');
    expect(session.userId).toBeNull();
    expect(localStorage.getItem(FAMILY_REMOTE_AUTH_STATE_STORAGE_KEY)).toBe('anonymous');
    expect(localStorage.getItem(FAMILY_REMOTE_USER_ID_STORAGE_KEY)).toBeNull();
  });

  it('lets the built-in auth bridge reset back to no override', () => {
    vi.stubEnv('VITE_FAMILY_REMOTE_AUTH_STATE', 'authenticated');
    vi.stubEnv('VITE_FAMILY_REMOTE_USER_ID', 'env-user');
    setFamilyRemoteAuthSessionConfig({
      authState: 'authenticated',
      userId: 'bridge-user',
    });

    const session = setFamilyRemoteAuthSessionConfig(null);

    expect(session.authState).toBe('authenticated');
    expect(session.userId).toBe('env-user');
    expect(localStorage.getItem(FAMILY_REMOTE_AUTH_STATE_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(FAMILY_REMOTE_USER_ID_STORAGE_KEY)).toBeNull();
  });

  it('prefers a registered auth provider over query, storage, and env bootstrap', () => {
    localStorage.setItem(FAMILY_REMOTE_AUTH_STATE_STORAGE_KEY, 'anonymous');
    vi.stubEnv('VITE_FAMILY_REMOTE_AUTH_STATE', 'authenticated');
    vi.stubEnv('VITE_FAMILY_REMOTE_USER_ID', 'env-user');
    registerFamilyRemoteAuthProvider({
      getSessionConfig: () => ({
        authState: 'authenticated',
        userId: 'provider-user',
      }),
    });

    const session = getFamilyRemoteSession('?familyRemoteAuthState=anonymous');

    expect(session.authState).toBe('authenticated');
    expect(session.userId).toBe('provider-user');
  });

  it('forwards auth-provider change subscriptions when a provider exposes them', () => {
    const listeners = new Set<() => void>();
    const listener = vi.fn();
    registerFamilyRemoteAuthProvider({
      getSessionConfig: () => null,
      subscribe: (nextListener) => {
        listeners.add(nextListener);
        return () => listeners.delete(nextListener);
      },
    });

    const unsubscribe = subscribeToFamilyRemoteAuthChanges(listener);
    listeners.forEach((nextListener) => nextListener());

    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    listeners.forEach((nextListener) => nextListener());

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notifies bridge subscribers when the built-in auth bridge changes', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToFamilyRemoteAuthChanges(listener);

    setFamilyRemoteAuthSessionConfig({
      authState: 'authenticated',
      userId: 'bridge-user',
    });
    clearFamilyRemoteAuthSessionConfig();

    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
  });
});

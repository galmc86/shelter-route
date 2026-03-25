import { beforeEach, describe, expect, it } from 'vitest';
import { getFamilyRemoteSession } from '../familyRemoteSessionService';

describe('familyRemoteSessionService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('provides a stable anonymous remote session by default', () => {
    const first = getFamilyRemoteSession();
    const second = getFamilyRemoteSession();

    expect(first.authState).toBe('anonymous');
    expect(first.userId).toBeNull();
    expect(first.deviceId).toBe(second.deviceId);
  });
});


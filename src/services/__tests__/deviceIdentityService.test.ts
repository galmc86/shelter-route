import { beforeEach, describe, expect, it } from 'vitest';
import { getDeviceId } from '../deviceIdentityService';

describe('deviceIdentityService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns the same device id across calls', () => {
    const first = getDeviceId();
    const second = getDeviceId();

    expect(first).toBeTruthy();
    expect(first).toBe(second);
    expect(localStorage.getItem('shelter-route:device-id')).toBe(first);
  });
});


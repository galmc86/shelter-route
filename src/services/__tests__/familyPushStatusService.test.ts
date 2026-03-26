import { beforeEach, describe, expect, it } from 'vitest';
import {
  getFamilyPushStatus,
  patchFamilyPushStatus,
  resetFamilyPushStatus,
} from '../familyPushStatusService';

describe('familyPushStatusService', () => {
  beforeEach(() => {
    localStorage.clear();
    resetFamilyPushStatus();
  });

  it('persists patched push status values', () => {
    patchFamilyPushStatus({
      permission: 'granted',
      state: 'active',
      registeredGroupCode: 'abc123',
      lastSuccessAt: '2026-03-26T10:00:00.000Z',
    });

    expect(getFamilyPushStatus()).toEqual({
      permission: 'granted',
      state: 'active',
      environmentHint: 'none',
      registeredGroupCode: 'ABC123',
      lastAttemptAt: null,
      lastSuccessAt: '2026-03-26T10:00:00.000Z',
      lastFailureAt: null,
      lastError: null,
    });
  });
});

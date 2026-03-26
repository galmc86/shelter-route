import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getFamilySyncStatus,
  recordFamilySyncFailure,
  recordFamilySyncSuccess,
  resetFamilySyncStatus,
  setFamilySyncPendingCount,
  subscribeToFamilySyncStatusChanges,
} from '../familySyncStatusService';

describe('familySyncStatusService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('tracks pending count and sync outcomes', () => {
    setFamilySyncPendingCount(2);
    recordFamilySyncFailure('2026-03-25T22:00:00.000Z', 'offline');

    expect(getFamilySyncStatus()).toEqual({
      pendingCount: 2,
      lastAttemptAt: '2026-03-25T22:00:00.000Z',
      lastSuccessAt: null,
      lastFailureAt: '2026-03-25T22:00:00.000Z',
      lastError: 'offline',
    });

    setFamilySyncPendingCount(0);
    recordFamilySyncSuccess('2026-03-25T22:01:00.000Z');

    expect(getFamilySyncStatus()).toEqual({
      pendingCount: 0,
      lastAttemptAt: '2026-03-25T22:01:00.000Z',
      lastSuccessAt: '2026-03-25T22:01:00.000Z',
      lastFailureAt: '2026-03-25T22:00:00.000Z',
      lastError: null,
    });
  });

  it('can reset sync status back to defaults', () => {
    setFamilySyncPendingCount(1);
    recordFamilySyncFailure('2026-03-25T22:02:00.000Z', 'failed');

    resetFamilySyncStatus();

    expect(getFamilySyncStatus()).toEqual({
      pendingCount: 0,
      lastAttemptAt: null,
      lastSuccessAt: null,
      lastFailureAt: null,
      lastError: null,
    });
  });

  it('notifies listeners when sync status changes', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToFamilySyncStatusChanges(listener);

    setFamilySyncPendingCount(1);
    recordFamilySyncFailure('2026-03-25T22:02:00.000Z', 'failed');

    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    resetFamilySyncStatus();

    expect(listener).toHaveBeenCalledTimes(2);
  });
});

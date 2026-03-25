import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearPendingFamilySyncMutations,
  getPendingFamilySyncMutation,
  getPendingFamilySyncMutations,
  queueFamilySyncMutation,
} from '../familySyncQueueService';

describe('familySyncQueueService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores only the latest mutation per group', () => {
    queueFamilySyncMutation({
      kind: 'clear',
      groupCode: 'abc123',
      queuedAt: '2026-03-25T21:00:00.000Z',
    });
    queueFamilySyncMutation({
      kind: 'clear',
      groupCode: 'ABC123',
      queuedAt: '2026-03-25T21:01:00.000Z',
    });

    expect(getPendingFamilySyncMutations()).toEqual([
      {
        kind: 'clear',
        groupCode: 'ABC123',
        queuedAt: '2026-03-25T21:01:00.000Z',
      },
    ]);
  });

  it('returns the queued mutation for a specific group and can clear the queue', () => {
    queueFamilySyncMutation({
      kind: 'clear',
      groupCode: 'ABC123',
      queuedAt: '2026-03-25T21:02:00.000Z',
    });

    expect(getPendingFamilySyncMutation('abc123')).toEqual({
      kind: 'clear',
      groupCode: 'ABC123',
      queuedAt: '2026-03-25T21:02:00.000Z',
    });

    clearPendingFamilySyncMutations();

    expect(getPendingFamilySyncMutations()).toEqual([]);
  });
});


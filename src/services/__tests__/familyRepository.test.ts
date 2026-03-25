import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getFamilyRepository } from '../familyRepository';

describe('familyRepository', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('wraps the current local family state and derives a share link only when a group exists', () => {
    const repository = getFamilyRepository();

    expect(repository.getSnapshot()).toBeNull();
    expect(repository.getShareLink()).toBeNull();

    const group = repository.createGroup('Dana');

    expect(group.groupCode).toHaveLength(6);
    expect(repository.getSnapshot()?.memberName).toBe('Dana');
    expect(repository.getShareLink()).toContain(group.groupCode);
  });

  it('notifies repository subscribers when local family state changes', () => {
    const repository = getFamilyRepository();
    const listener = vi.fn();
    const unsubscribe = repository.subscribe(listener);

    repository.createGroup('Dana');

    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    repository.markCurrentMemberSafe();

    expect(listener).toHaveBeenCalledTimes(1);
  });
});

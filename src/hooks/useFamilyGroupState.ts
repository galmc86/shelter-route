import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFamilyRepositoryContext } from '../contexts/FamilyRepositoryContext';
import {
  type FamilyGroup,
  type FamilyMember,
} from '../services/familySafetyService';
import { getFamilyRepository } from '../services/familyRepository';

export interface UseFamilyGroupStateResult {
  group: FamilyGroup | null;
  currentMember: FamilyMember | null;
  hasGroup: boolean;
  isCurrentMemberSafe: boolean;
  safeMembersCount: number;
  waitingMembersCount: number;
  shareLink: string | null;
  createFamilyGroup: (name: string) => FamilyGroup | null;
  joinFamilyGroup: (code: string, name: string) => FamilyGroup | null;
  markFamilySafe: () => FamilyGroup | null;
  markNeedsCheckIn: () => FamilyGroup | null;
  leaveFamilyGroup: () => void;
}

export function useFamilyGroupState(): UseFamilyGroupStateResult {
  const repositoryFromContext = useFamilyRepositoryContext();
  const repository = useMemo(
    () => repositoryFromContext ?? getFamilyRepository(),
    [repositoryFromContext]
  );
  const [group, setGroup] = useState<FamilyGroup | null>(() => repository.getSnapshot());

  useEffect(() => {
    setGroup(repository.getSnapshot());
    return repository.subscribe(() => {
      setGroup(repository.getSnapshot());
    });
  }, [repository]);

  const createFamilyGroup = useCallback((name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return null;
    const nextGroup = repository.createGroup(trimmedName);
    setGroup(nextGroup);
    return nextGroup;
  }, [repository]);

  const joinFamilyGroup = useCallback((code: string, name: string) => {
    const trimmedCode = code.trim();
    const trimmedName = name.trim();
    if (!trimmedCode || !trimmedName) return null;
    const nextGroup = repository.joinGroup(trimmedCode, trimmedName);
    setGroup(nextGroup);
    return nextGroup;
  }, [repository]);

  const markFamilySafe = useCallback(() => {
    const updated = repository.markCurrentMemberSafe();
    if (updated) {
      setGroup(updated);
    }
    return updated;
  }, [repository]);

  const markNeedsCheckIn = useCallback(() => {
    const updated = repository.markCurrentMemberNeedsCheckIn();
    if (updated) {
      setGroup(updated);
    }
    return updated;
  }, [repository]);

  const leaveFamilyGroup = useCallback(() => {
    repository.leaveGroup();
    setGroup(null);
  }, [repository]);

  const currentMember = useMemo(() => (
    group?.members.find((member) => member.name === group.memberName) ?? null
  ), [group]);

  const safeMembersCount = group?.members.filter((member) => member.isSafe).length ?? 0;
  const waitingMembersCount = group ? Math.max(0, group.members.length - safeMembersCount) : 0;

  return {
    group,
    currentMember,
    hasGroup: Boolean(group),
    isCurrentMemberSafe: currentMember?.isSafe ?? false,
    safeMembersCount,
    waitingMembersCount,
    shareLink: group ? repository.getShareLink() : null,
    createFamilyGroup,
    joinFamilyGroup,
    markFamilySafe,
    markNeedsCheckIn,
    leaveFamilyGroup,
  };
}

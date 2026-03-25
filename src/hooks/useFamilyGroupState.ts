import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createGroup,
  getGroup,
  getShareLink,
  joinGroup,
  leaveGroup,
  markCurrentMemberNeedsCheckIn,
  setImSafe,
  subscribeToFamilyGroupChanges,
  type FamilyGroup,
  type FamilyMember,
} from '../services/familySafetyService';

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
  const [group, setGroup] = useState<FamilyGroup | null>(() => getGroup());

  useEffect(() => {
    setGroup(getGroup());
    return subscribeToFamilyGroupChanges(() => {
      setGroup(getGroup());
    });
  }, []);

  const createFamilyGroup = useCallback((name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return null;
    const nextGroup = createGroup(trimmedName);
    setGroup(nextGroup);
    return nextGroup;
  }, []);

  const joinFamilyGroup = useCallback((code: string, name: string) => {
    const trimmedCode = code.trim();
    const trimmedName = name.trim();
    if (!trimmedCode || !trimmedName) return null;
    const nextGroup = joinGroup(trimmedCode, trimmedName);
    setGroup(nextGroup);
    return nextGroup;
  }, []);

  const markFamilySafe = useCallback(() => {
    const updated = setImSafe();
    if (updated) {
      setGroup(updated);
    }
    return updated;
  }, []);

  const markNeedsCheckIn = useCallback(() => {
    const updated = markCurrentMemberNeedsCheckIn();
    if (updated) {
      setGroup(updated);
    }
    return updated;
  }, []);

  const leaveFamilyGroup = useCallback(() => {
    leaveGroup();
    setGroup(null);
  }, []);

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
    shareLink: group ? getShareLink() : null,
    createFamilyGroup,
    joinFamilyGroup,
    markFamilySafe,
    markNeedsCheckIn,
    leaveFamilyGroup,
  };
}

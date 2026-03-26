import type { FamilyGroup, FamilyMember } from './familySafetyService';

export type FamilySyncNotificationEventType =
  | 'member_joined'
  | 'member_left'
  | 'member_safe'
  | 'member_needs_check_in';

export interface FamilySyncNotificationEvent {
  type: FamilySyncNotificationEventType;
  memberName: string;
  memberId: string;
  notificationKey: string;
}

export function getFamilySyncNotificationEvents(
  previousGroup: FamilyGroup | null,
  nextGroup: FamilyGroup | null
): FamilySyncNotificationEvent[] {
  if (!previousGroup || !nextGroup || previousGroup.groupCode !== nextGroup.groupCode) {
    return [];
  }

  const localCurrentMember = resolveLocalCurrentMember(previousGroup, nextGroup);
  const previousMembers = previousGroup.members.filter((member) => !isSameMemberIdentity(member, localCurrentMember));
  const nextMembers = nextGroup.members.filter((member) => !isSameMemberIdentity(member, localCurrentMember));
  const events: FamilySyncNotificationEvent[] = [];

  for (const nextMember of nextMembers) {
    const previousMember = findMatchingMember(previousMembers, nextMember);
    if (!previousMember) {
      events.push({
        type: 'member_joined',
        memberName: nextMember.name,
        memberId: nextMember.id,
        notificationKey: buildNotificationKey('member_joined', nextMember.id, nextMember.lastSeen),
      });
      continue;
    }

    if (previousMember.isSafe !== nextMember.isSafe) {
      if (nextMember.isSafe === true) {
        events.push({
          type: 'member_safe',
          memberName: nextMember.name,
          memberId: nextMember.id,
          notificationKey: buildNotificationKey('member_safe', nextMember.id, nextMember.lastSeen),
        });
      } else if (nextMember.isSafe === false && previousMember.isSafe === true) {
        events.push({
          type: 'member_needs_check_in',
          memberName: nextMember.name,
          memberId: nextMember.id,
          notificationKey: buildNotificationKey('member_needs_check_in', nextMember.id, nextMember.lastSeen),
        });
      }
    }
  }

  for (const previousMember of previousMembers) {
    if (!findMatchingMember(nextMembers, previousMember)) {
      events.push({
        type: 'member_left',
        memberName: previousMember.name,
        memberId: previousMember.id,
        notificationKey: buildNotificationKey('member_left', previousMember.id, nextGroup.members.find((member) => member.id === nextGroup.currentMemberId)?.lastSeen),
      });
    }
  }

  return events;
}

function buildNotificationKey(
  type: FamilySyncNotificationEventType,
  memberId: string,
  timestamp: string | undefined
): string {
  const normalizedTimestamp = timestamp
    ? String(Date.parse(timestamp) || timestamp)
    : String(Date.now());

  return `family-${type}-${memberId}-${normalizedTimestamp}`;
}

function resolveLocalCurrentMember(
  previousGroup: FamilyGroup,
  nextGroup: FamilyGroup
): FamilyMember | undefined {
  return (
    nextGroup.members.find((member) => member.id === nextGroup.currentMemberId)
    ?? previousGroup.members.find((member) => member.id === previousGroup.currentMemberId)
  );
}

function findMatchingMember(
  members: FamilyMember[],
  target: FamilyMember
): FamilyMember | undefined {
  return members.find((candidate) => isSameMemberIdentity(candidate, target));
}

function isSameMemberIdentity(
  left: Pick<FamilyMember, 'id' | 'deviceId'> | undefined,
  right: Pick<FamilyMember, 'id' | 'deviceId'> | undefined
): boolean {
  if (!left || !right) {
    return false;
  }

  return left.id === right.id || (
    Boolean(left.deviceId)
    && Boolean(right.deviceId)
    && left.deviceId === right.deviceId
  );
}

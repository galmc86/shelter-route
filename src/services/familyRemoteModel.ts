import type { FamilyGroup, FamilyMember } from './familySafetyService';

export type FamilyRemoteMemberStatus = 'safe' | 'needs_check_in' | 'unknown';

export interface FamilyRemoteMemberRecord {
  id: string;
  userId?: string;
  deviceId?: string;
  name: string;
  role: 'owner' | 'member';
  status: FamilyRemoteMemberStatus;
  lastStatusAt?: string;
  lastSeenAt?: string;
  joinedAt: string;
}

export interface FamilyRemoteGroupRecord {
  id: string;
  inviteCode: string;
  displayName?: string;
  createdAt: string;
  updatedAt: string;
  createdByMemberId: string;
  members: FamilyRemoteMemberRecord[];
}

export function mapFamilyGroupToRemoteRecord(
  group: FamilyGroup,
  previousRecord: FamilyRemoteGroupRecord | null = null
): FamilyRemoteGroupRecord {
  const now = new Date().toISOString();
  const previousMembers = new Map(previousRecord?.members.map((member) => [member.id, member]) ?? []);

  return {
    id: previousRecord?.id ?? `family:${group.groupCode}`,
    inviteCode: group.groupCode,
    displayName: previousRecord?.displayName,
    createdAt: previousRecord?.createdAt ?? group.members[0]?.lastSeen ?? now,
    updatedAt: now,
    createdByMemberId: previousRecord?.createdByMemberId ?? group.currentMemberId,
    members: group.members.map((member) => mapFamilyMemberToRemoteRecord(
      member,
      group.currentMemberId,
      previousMembers.get(member.id),
      now
    )),
  };
}

export function mapRemoteRecordToFamilyGroup(
  record: FamilyRemoteGroupRecord,
  previousGroup: FamilyGroup | null = null
): FamilyGroup | null {
  if (record.members.length === 0) {
    return previousGroup;
  }

  const currentMemberId = resolveCurrentMemberId(record, previousGroup);
  const currentMember = record.members.find((member) => member.id === currentMemberId) ?? record.members[0];

  return {
    groupCode: record.inviteCode.toUpperCase(),
    memberName: previousGroup?.memberName ?? currentMember.name,
    currentMemberId: currentMember.id,
    members: record.members.map(mapRemoteMemberToFamilyMember),
  };
}

function mapFamilyMemberToRemoteRecord(
  member: FamilyMember,
  currentMemberId: string,
  previousMember: FamilyRemoteMemberRecord | undefined,
  now: string
): FamilyRemoteMemberRecord {
  return {
    id: member.id,
    deviceId: member.deviceId,
    name: member.name,
    role: member.id === currentMemberId ? 'owner' : previousMember?.role ?? 'member',
    status: member.isSafe === true ? 'safe' : member.isSafe === false ? 'needs_check_in' : 'unknown',
    lastStatusAt: member.lastSeen ?? previousMember?.lastStatusAt,
    lastSeenAt: member.lastSeen ?? previousMember?.lastSeenAt,
    joinedAt: previousMember?.joinedAt ?? member.lastSeen ?? now,
  };
}

function mapRemoteMemberToFamilyMember(member: FamilyRemoteMemberRecord): FamilyMember {
  return {
    id: member.id,
    name: member.name,
    deviceId: member.deviceId,
    lastSeen: member.lastSeenAt ?? member.lastStatusAt,
    isSafe: member.status === 'safe' ? true : member.status === 'needs_check_in' ? false : undefined,
  };
}

function resolveCurrentMemberId(
  record: FamilyRemoteGroupRecord,
  previousGroup: FamilyGroup | null
): string {
  const candidateIds = [
    previousGroup?.currentMemberId,
    record.createdByMemberId,
    record.members[0]?.id,
  ];

  for (const candidateId of candidateIds) {
    if (candidateId && record.members.some((member) => member.id === candidateId)) {
      return candidateId;
    }
  }

  return record.members[0].id;
}


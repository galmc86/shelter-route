import { ServiceError } from './serviceResult';
import type {
  FamilyRemoteGroupRecord,
  FamilyRemoteMemberRecord,
  FamilyRemoteMemberStatus,
} from './familyRemoteModel';

function getFamilyRemoteBaseUrl(): string | null {
  const baseUrl = (import.meta.env.VITE_FAMILY_REMOTE_URL as string | undefined)?.trim();
  return baseUrl || null;
}

export function getFamilyRemoteGroupEndpoint(groupCode: string): string | null {
  const baseUrl = getFamilyRemoteBaseUrl();
  if (!baseUrl) {
    return null;
  }

  return `${baseUrl.replace(/\/+$/, '')}/${encodeURIComponent(groupCode.toUpperCase())}`;
}

export function encodeFamilyRemoteGroupRequest(record: FamilyRemoteGroupRecord): FamilyRemoteGroupRecord {
  return {
    ...record,
    inviteCode: record.inviteCode.toUpperCase(),
    members: record.members.map((member) => ({
      ...member,
      status: normalizeStatus(member.status),
    })),
  };
}

export function decodeFamilyRemoteGroupResponse(payload: unknown): FamilyRemoteGroupRecord {
  if (!payload || typeof payload !== 'object') {
    throw new ServiceError('PARSE', 'Family remote group payload is malformed');
  }

  const candidate = payload as Partial<FamilyRemoteGroupRecord>;
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.inviteCode !== 'string' ||
    typeof candidate.createdAt !== 'string' ||
    typeof candidate.updatedAt !== 'string' ||
    typeof candidate.createdByMemberId !== 'string' ||
    !Array.isArray(candidate.members)
  ) {
    throw new ServiceError('PARSE', 'Family remote group payload is malformed');
  }

  return {
    id: candidate.id,
    inviteCode: candidate.inviteCode.toUpperCase(),
    version: typeof candidate.version === 'number' && candidate.version >= 0 ? candidate.version : 0,
    displayName: typeof candidate.displayName === 'string' ? candidate.displayName : undefined,
    createdAt: candidate.createdAt,
    updatedAt: candidate.updatedAt,
    createdByMemberId: candidate.createdByMemberId,
    members: candidate.members.map(decodeFamilyRemoteMember),
  };
}

function decodeFamilyRemoteMember(payload: unknown): FamilyRemoteMemberRecord {
  if (!payload || typeof payload !== 'object') {
    throw new ServiceError('PARSE', 'Family remote member payload is malformed');
  }

  const candidate = payload as Partial<FamilyRemoteMemberRecord>;
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.name !== 'string' ||
    typeof candidate.role !== 'string' ||
    typeof candidate.joinedAt !== 'string'
  ) {
    throw new ServiceError('PARSE', 'Family remote member payload is malformed');
  }

  return {
    id: candidate.id,
    userId: typeof candidate.userId === 'string' ? candidate.userId : undefined,
    deviceId: typeof candidate.deviceId === 'string' ? candidate.deviceId : undefined,
    name: candidate.name,
    role: candidate.role === 'owner' ? 'owner' : 'member',
    status: normalizeStatus(candidate.status),
    lastStatusAt: typeof candidate.lastStatusAt === 'string' ? candidate.lastStatusAt : undefined,
    lastSeenAt: typeof candidate.lastSeenAt === 'string' ? candidate.lastSeenAt : undefined,
    joinedAt: candidate.joinedAt,
  };
}

function normalizeStatus(status: unknown): FamilyRemoteMemberStatus {
  return status === 'safe' || status === 'needs_check_in' ? status : 'unknown';
}

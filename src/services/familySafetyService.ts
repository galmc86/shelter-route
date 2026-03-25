import { getDeviceId } from './deviceIdentityService';

const STORAGE_KEY = 'shelter-route:family-group';
const FAMILY_GROUP_UPDATED_EVENT = 'family-group-updated';
const STORAGE_VERSION = 2;

export interface FamilyMember {
  id: string;
  name: string;
  deviceId?: string;
  lastSeen?: string; // ISO timestamp
  isSafe?: boolean;
}

export interface FamilyGroup {
  groupCode: string;
  memberName: string;
  currentMemberId: string;
  members: FamilyMember[];
}

interface FamilyGroupStorageData {
  version: number;
  group: FamilyGroup;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

function generateGroupCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusing chars (0/O, 1/I)
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function getGroup(): FamilyGroup | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FamilyGroupStorageData | FamilyGroup;
    const candidate = 'group' in parsed ? parsed.group : parsed;
    const sanitized = sanitizeGroup(candidate);
    if (!sanitized) return null;

    if ('group' in parsed && parsed.version === STORAGE_VERSION) {
      return sanitized;
    }

    saveGroup(sanitized);
    return sanitized;
  } catch {
    return null;
  }
}

function saveGroup(group: FamilyGroup): void {
  try {
    const data: FamilyGroupStorageData = {
      version: STORAGE_VERSION,
      group,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    notifyFamilyGroupChanged();
  } catch {
    // storage full or unavailable
  }
}

export function replaceStoredGroup(group: FamilyGroup | null): void {
  if (!group) {
    leaveGroup();
    return;
  }

  saveGroup(group);
}

function sanitizeGroup(raw: unknown): FamilyGroup | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const candidate = raw as Partial<FamilyGroup>;
  if (
    typeof candidate.groupCode !== 'string' ||
    typeof candidate.memberName !== 'string' ||
    !Array.isArray(candidate.members)
  ) {
    return null;
  }

  const members = candidate.members
    .map((member) => sanitizeMember(member))
    .filter((member): member is FamilyMember => member !== null);

  const currentMemberId = resolveCurrentMemberId(
    typeof candidate.currentMemberId === 'string' ? candidate.currentMemberId : undefined,
    candidate.memberName,
    members
  );

  if (!currentMemberId) {
    return null;
  }

  const hydratedMembers = members.map((member) => (
    member.id === currentMemberId && !member.deviceId
      ? { ...member, deviceId: getDeviceId() }
      : member
  ));

  return {
    groupCode: candidate.groupCode.toUpperCase(),
    memberName: candidate.memberName,
    currentMemberId,
    members: hydratedMembers,
  };
}

function resolveCurrentMemberId(
  currentMemberId: string | undefined,
  memberName: string,
  members: FamilyMember[]
): string | null {
  if (currentMemberId && members.some((member) => member.id === currentMemberId)) {
    return currentMemberId;
  }

  const matchedByName = members.find((member) => member.name === memberName);
  if (matchedByName) {
    return matchedByName.id;
  }

  return members[0]?.id ?? null;
}

function sanitizeMember(raw: unknown): FamilyMember | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const candidate = raw as Partial<FamilyMember>;
  if (typeof candidate.id !== 'string' || typeof candidate.name !== 'string') {
    return null;
  }

  return {
    id: candidate.id,
    name: candidate.name,
    deviceId: typeof candidate.deviceId === 'string' ? candidate.deviceId : undefined,
    lastSeen: typeof candidate.lastSeen === 'string' ? candidate.lastSeen : undefined,
    isSafe: typeof candidate.isSafe === 'boolean' ? candidate.isSafe : undefined,
  };
}

function notifyFamilyGroupChanged(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(FAMILY_GROUP_UPDATED_EVENT));
}

export function createGroup(name: string): FamilyGroup {
  const memberId = generateId();
  const group: FamilyGroup = {
    groupCode: generateGroupCode(),
    memberName: name,
    currentMemberId: memberId,
    members: [
      {
        id: memberId,
        name,
        deviceId: getDeviceId(),
        lastSeen: new Date().toISOString(),
        isSafe: false,
      },
    ],
  };
  saveGroup(group);
  return group;
}

export function joinGroup(code: string, name: string): FamilyGroup {
  const existing = getGroup();
  // If already in this group, just return it
  if (existing && existing.groupCode === code.toUpperCase()) {
    return existing;
  }
  const memberId = generateId();
  const group: FamilyGroup = {
    groupCode: code.toUpperCase(),
    memberName: name,
    currentMemberId: memberId,
    members: [
      {
        id: memberId,
        name,
        deviceId: getDeviceId(),
        lastSeen: new Date().toISOString(),
        isSafe: false,
      },
    ],
  };
  saveGroup(group);
  return group;
}

export function setImSafe(): FamilyGroup | null {
  const group = getGroup();
  if (!group) return null;
  const now = new Date().toISOString();
  group.members = group.members.map((m) =>
    m.id === group.currentMemberId
      ? { ...m, isSafe: true, lastSeen: now }
      : m
  );
  saveGroup(group);
  return group;
}

export function markCurrentMemberNeedsCheckIn(): FamilyGroup | null {
  const group = getGroup();
  if (!group) return null;

  const now = new Date().toISOString();
  group.members = group.members.map((member) =>
    member.id === group.currentMemberId
      ? { ...member, isSafe: false, lastSeen: now }
      : member
  );
  saveGroup(group);
  return group;
}

export function leaveGroup(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    notifyFamilyGroupChanged();
  } catch {
    // ignore
  }
}

export function subscribeToFamilyGroupChanges(listener: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleCustomUpdate = () => listener();
  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) {
      listener();
    }
  };

  window.addEventListener(FAMILY_GROUP_UPDATED_EVENT, handleCustomUpdate);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(FAMILY_GROUP_UPDATED_EVENT, handleCustomUpdate);
    window.removeEventListener('storage', handleStorage);
  };
}

export function getShareLink(): string {
  const group = getGroup();
  if (!group) return window.location.href;
  const url = new URL(window.location.href);
  // Clean existing params
  url.search = '';
  url.searchParams.set('familyGroup', group.groupCode);
  return url.toString();
}

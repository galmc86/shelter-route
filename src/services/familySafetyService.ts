const STORAGE_KEY = 'shelter-route:family-group';

export interface FamilyMember {
  id: string;
  name: string;
  lastSeen?: string; // ISO timestamp
  isSafe?: boolean;
}

export interface FamilyGroup {
  groupCode: string;
  memberName: string;
  members: FamilyMember[];
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
    return JSON.parse(raw) as FamilyGroup;
  } catch {
    return null;
  }
}

function saveGroup(group: FamilyGroup): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(group));
  } catch {
    // storage full or unavailable
  }
}

export function createGroup(name: string): FamilyGroup {
  const memberId = generateId();
  const group: FamilyGroup = {
    groupCode: generateGroupCode(),
    memberName: name,
    members: [
      {
        id: memberId,
        name,
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
    members: [
      {
        id: memberId,
        name,
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
    m.name === group.memberName
      ? { ...m, isSafe: true, lastSeen: now }
      : m
  );
  saveGroup(group);
  return group;
}

export function leaveGroup(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
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

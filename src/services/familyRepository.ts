import {
  createGroup as createLocalGroup,
  getGroup,
  getShareLink,
  joinGroup as joinLocalGroup,
  leaveGroup as leaveLocalGroup,
  markCurrentMemberNeedsCheckIn,
  replaceStoredGroup,
  setImSafe,
  subscribeToFamilyGroupChanges,
  type FamilyGroup,
} from './familySafetyService';
import { getFamilyRemoteGateway, type FamilyRemoteGateway } from './familyRemoteGateway';
import {
  mapFamilyGroupToRemoteRecord,
  mapRemoteRecordToFamilyGroup,
} from './familyRemoteModel';
import { getFamilySyncMode, type FamilySyncMode } from './familySyncModeService';

export interface FamilyRepository {
  getSnapshot(): FamilyGroup | null;
  subscribe(listener: () => void): () => void;
  createGroup(name: string): FamilyGroup;
  joinGroup(code: string, name: string): FamilyGroup;
  markCurrentMemberSafe(): FamilyGroup | null;
  markCurrentMemberNeedsCheckIn(): FamilyGroup | null;
  leaveGroup(): void;
  getShareLink(): string | null;
}

interface MutableFamilyRepository extends FamilyRepository {
  replaceSnapshot(group: FamilyGroup | null): void;
}

export class LocalFamilyRepository implements MutableFamilyRepository {
  getSnapshot(): FamilyGroup | null {
    return getGroup();
  }

  subscribe(listener: () => void): () => void {
    return subscribeToFamilyGroupChanges(listener);
  }

  createGroup(name: string): FamilyGroup {
    return createLocalGroup(name);
  }

  joinGroup(code: string, name: string): FamilyGroup {
    return joinLocalGroup(code, name);
  }

  markCurrentMemberSafe(): FamilyGroup | null {
    return setImSafe();
  }

  markCurrentMemberNeedsCheckIn(): FamilyGroup | null {
    return markCurrentMemberNeedsCheckIn();
  }

  leaveGroup(): void {
    leaveLocalGroup();
  }

  getShareLink(): string | null {
    const group = this.getSnapshot();
    return group ? getShareLink() : null;
  }

  replaceSnapshot(group: FamilyGroup | null): void {
    replaceStoredGroup(group);
  }
}

export class HybridFamilyRepository implements FamilyRepository {
  private readonly localRepository: MutableFamilyRepository;
  private readonly remoteGateway: FamilyRemoteGateway;
  private remoteUnsubscribe: (() => void) | null = null;
  private subscribedGroupCode: string | null = null;

  constructor(localRepository: MutableFamilyRepository, remoteGateway: FamilyRemoteGateway) {
    this.localRepository = localRepository;
    this.remoteGateway = remoteGateway;
  }

  getSnapshot(): FamilyGroup | null {
    const localGroup = this.localRepository.getSnapshot();
    if (!localGroup) {
      return null;
    }

    return this.hydrateFromRemote(localGroup.groupCode);
  }

  subscribe(listener: () => void): () => void {
    this.ensureRemoteSubscription();

    const unsubscribeLocal = this.localRepository.subscribe(() => {
      this.ensureRemoteSubscription();
      listener();
    });

    return () => {
      unsubscribeLocal();
      this.remoteUnsubscribe?.();
      this.remoteUnsubscribe = null;
      this.subscribedGroupCode = null;
    };
  }

  createGroup(name: string): FamilyGroup {
    const group = this.localRepository.createGroup(name);
    this.remoteGateway.upsertGroup(
      mapFamilyGroupToRemoteRecord(group, this.remoteGateway.getGroup(group.groupCode))
    );
    this.ensureRemoteSubscription();
    return this.hydrateFromRemote(group.groupCode) ?? group;
  }

  joinGroup(code: string, name: string): FamilyGroup {
    const group = this.localRepository.joinGroup(code, name);
    this.remoteGateway.upsertGroup(
      mapFamilyGroupToRemoteRecord(group, this.remoteGateway.getGroup(group.groupCode))
    );
    this.ensureRemoteSubscription();
    return this.hydrateFromRemote(group.groupCode) ?? group;
  }

  markCurrentMemberSafe(): FamilyGroup | null {
    const updated = this.localRepository.markCurrentMemberSafe();
    if (!updated) {
      return null;
    }

    this.remoteGateway.upsertGroup(
      mapFamilyGroupToRemoteRecord(updated, this.remoteGateway.getGroup(updated.groupCode))
    );
    return this.hydrateFromRemote(updated.groupCode);
  }

  markCurrentMemberNeedsCheckIn(): FamilyGroup | null {
    const updated = this.localRepository.markCurrentMemberNeedsCheckIn();
    if (!updated) {
      return null;
    }

    this.remoteGateway.upsertGroup(
      mapFamilyGroupToRemoteRecord(updated, this.remoteGateway.getGroup(updated.groupCode))
    );
    return this.hydrateFromRemote(updated.groupCode);
  }

  leaveGroup(): void {
    const groupCode = this.localRepository.getSnapshot()?.groupCode;
    this.localRepository.leaveGroup();
    if (groupCode) {
      this.remoteGateway.clearGroup(groupCode);
    }
    this.remoteUnsubscribe?.();
    this.remoteUnsubscribe = null;
    this.subscribedGroupCode = null;
  }

  getShareLink(): string | null {
    return this.localRepository.getShareLink();
  }

  private ensureRemoteSubscription(): void {
    const groupCode = this.localRepository.getSnapshot()?.groupCode ?? null;

    if (groupCode === this.subscribedGroupCode) {
      return;
    }

    this.remoteUnsubscribe?.();
    this.remoteUnsubscribe = null;
    this.subscribedGroupCode = groupCode;

    if (!groupCode) {
      return;
    }

    this.remoteUnsubscribe = this.remoteGateway.subscribe(groupCode, () => {
      this.hydrateFromRemote(groupCode);
    });
  }

  private hydrateFromRemote(groupCode: string): FamilyGroup | null {
    const localGroup = this.localRepository.getSnapshot();
    const remoteRecord = this.remoteGateway.getGroup(groupCode);
    const remoteGroup = remoteRecord
      ? mapRemoteRecordToFamilyGroup(remoteRecord, localGroup)
      : null;
    const mergedGroup = mergeFamilyGroups(localGroup, remoteGroup);

    if (mergedGroup && !areGroupsEqual(localGroup, mergedGroup)) {
      this.localRepository.replaceSnapshot(mergedGroup);
    }

    return mergedGroup ?? localGroup;
  }
}

function mergeFamilyGroups(localGroup: FamilyGroup | null, remoteGroup: FamilyGroup | null): FamilyGroup | null {
  if (!remoteGroup) {
    return localGroup;
  }

  if (!localGroup || localGroup.groupCode !== remoteGroup.groupCode) {
    return remoteGroup;
  }

  const localMembers = new Map(localGroup.members.map((member) => [member.id, member]));
  const mergedMembers = remoteGroup.members.map((remoteMember) =>
    mergeFamilyMembers(localMembers.get(remoteMember.id), remoteMember)
  );

  for (const localMember of localGroup.members) {
    if (!mergedMembers.some((member) => member.id === localMember.id)) {
      mergedMembers.push(localMember);
    }
  }

  return {
    ...remoteGroup,
    memberName: localGroup.memberName,
    currentMemberId: localGroup.currentMemberId,
    members: mergedMembers,
  };
}

function mergeFamilyMembers(
  localMember: FamilyGroup['members'][number] | undefined,
  remoteMember: FamilyGroup['members'][number]
): FamilyGroup['members'][number] {
  if (!localMember) {
    return remoteMember;
  }

  const localTimestamp = parseTimestamp(localMember.lastSeen);
  const remoteTimestamp = parseTimestamp(remoteMember.lastSeen);
  const preferLocal = localTimestamp > remoteTimestamp;
  const mergedMember = preferLocal
    ? { ...remoteMember, ...localMember }
    : { ...localMember, ...remoteMember };

  return {
    ...mergedMember,
    deviceId: mergedMember.deviceId ?? localMember.deviceId ?? remoteMember.deviceId,
  };
}

function parseTimestamp(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function areGroupsEqual(a: FamilyGroup | null, b: FamilyGroup | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function createFamilyRepository({
  mode = getFamilySyncMode(),
  remoteGateway = getFamilyRemoteGateway(),
}: {
  mode?: FamilySyncMode;
  remoteGateway?: FamilyRemoteGateway;
} = {}): FamilyRepository {
  const localRepository = new LocalFamilyRepository();

  if (mode === 'hybrid') {
    return new HybridFamilyRepository(localRepository, remoteGateway);
  }

  return localRepository;
}

export function getFamilyRepository(): FamilyRepository {
  return createFamilyRepository();
}

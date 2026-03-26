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
import {
  getFamilyRemoteSession,
  type FamilyRemoteSession,
} from './familyRemoteSessionService';
import {
  clearPendingFamilySyncMutation,
  clearPendingFamilySyncMutations,
  getPendingFamilySyncMutation,
  getPendingFamilySyncMutations,
  queueFamilySyncMutation,
  savePendingFamilySyncMutations,
  type FamilySyncMutation,
} from './familySyncQueueService';
import { getFamilySyncMode, type FamilySyncMode } from './familySyncModeService';
import {
  recordFamilySyncFailure,
  recordFamilySyncSuccess,
} from './familySyncStatusService';

export interface FamilyRepository {
  getSnapshot(): FamilyGroup | null;
  subscribe(listener: () => void): () => void;
  createGroup(name: string): FamilyGroup;
  joinGroup(code: string, name: string): FamilyGroup;
  markCurrentMemberSafe(): FamilyGroup | null;
  markCurrentMemberNeedsCheckIn(): FamilyGroup | null;
  retrySync(): FamilyGroup | null;
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

  retrySync(): FamilyGroup | null {
    return this.getSnapshot();
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
  private readonly remoteSession: FamilyRemoteSession;
  private remoteUnsubscribe: (() => void) | null = null;
  private onlineUnsubscribe: (() => void) | null = null;
  private subscribedGroupCode: string | null = null;

  constructor(
    localRepository: MutableFamilyRepository,
    remoteGateway: FamilyRemoteGateway,
    remoteSession: FamilyRemoteSession
  ) {
    this.localRepository = localRepository;
    this.remoteGateway = remoteGateway;
    this.remoteSession = remoteSession;
  }

  getSnapshot(): FamilyGroup | null {
    this.flushPendingMutations();
    const localGroup = this.localRepository.getSnapshot();
    if (!localGroup) {
      return null;
    }

    return this.hydrateFromRemote(localGroup.groupCode);
  }

  subscribe(listener: () => void): () => void {
    this.flushPendingMutations();
    this.ensureRemoteSubscription();
    this.ensureOnlineRetry(listener);

    const unsubscribeLocal = this.localRepository.subscribe(() => {
      this.flushPendingMutations();
      this.ensureRemoteSubscription();
      listener();
    });

    return () => {
      unsubscribeLocal();
      this.remoteUnsubscribe?.();
      this.onlineUnsubscribe?.();
      this.remoteUnsubscribe = null;
      this.onlineUnsubscribe = null;
      this.subscribedGroupCode = null;
    };
  }

  createGroup(name: string): FamilyGroup {
    const group = this.localRepository.createGroup(name);
    this.enqueueOrApplyMutation(this.createUpsertMutation(group));
    this.ensureRemoteSubscription();
    return this.hydrateFromRemote(group.groupCode) ?? group;
  }

  joinGroup(code: string, name: string): FamilyGroup {
    const group = this.localRepository.joinGroup(code, name);
    this.enqueueOrApplyMutation(this.createUpsertMutation(group));
    this.ensureRemoteSubscription();
    return this.hydrateFromRemote(group.groupCode) ?? group;
  }

  markCurrentMemberSafe(): FamilyGroup | null {
    const updated = this.localRepository.markCurrentMemberSafe();
    if (!updated) {
      return null;
    }

    this.enqueueOrApplyMutation(this.createUpsertMutation(updated));
    return this.hydrateFromRemote(updated.groupCode);
  }

  markCurrentMemberNeedsCheckIn(): FamilyGroup | null {
    const updated = this.localRepository.markCurrentMemberNeedsCheckIn();
    if (!updated) {
      return null;
    }

    this.enqueueOrApplyMutation(this.createUpsertMutation(updated));
    return this.hydrateFromRemote(updated.groupCode);
  }

  retrySync(): FamilyGroup | null {
    this.flushPendingMutations();
    this.ensureRemoteSubscription();
    const groupCode = this.localRepository.getSnapshot()?.groupCode;
    if (!groupCode) {
      return null;
    }

    return this.hydrateFromRemote(groupCode);
  }

  leaveGroup(): void {
    const groupCode = this.localRepository.getSnapshot()?.groupCode;
    this.localRepository.leaveGroup();
    if (groupCode) {
      this.enqueueOrApplyMutation({
        kind: 'clear',
        groupCode,
        queuedAt: new Date().toISOString(),
      });
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

    this.remoteUnsubscribe = this.remoteGateway.subscribe(groupCode, this.remoteSession, (event) => {
      if (event.kind === 'cleared') {
        clearPendingFamilySyncMutation(event.groupCode);
        if (this.localRepository.getSnapshot()?.groupCode === event.groupCode) {
          this.localRepository.replaceSnapshot(null);
        }
        return;
      }

      this.flushPendingMutations();
      this.hydrateFromRemote(event.groupCode);
    });
  }

  private ensureOnlineRetry(listener: () => void): void {
    if (this.onlineUnsubscribe || typeof window === 'undefined') {
      return;
    }

    const handleOnline = () => {
      this.flushPendingMutations();
      const groupCode = this.localRepository.getSnapshot()?.groupCode;
      if (groupCode) {
        this.hydrateFromRemote(groupCode);
      }
      listener();
    };

    window.addEventListener('online', handleOnline);
    this.onlineUnsubscribe = () => {
      window.removeEventListener('online', handleOnline);
    };
  }

  private hydrateFromRemote(groupCode: string): FamilyGroup | null {
    const localGroup = this.localRepository.getSnapshot();
    const remoteRecord = this.remoteGateway.getGroup(groupCode, this.remoteSession);
    const remoteGroup = remoteRecord
      ? mapRemoteRecordToFamilyGroup(remoteRecord, localGroup)
      : null;
    const mergedGroup = mergeFamilyGroups(localGroup, remoteGroup);

    if (mergedGroup && !areGroupsEqual(localGroup, mergedGroup)) {
      this.localRepository.replaceSnapshot(mergedGroup);
    }

    return mergedGroup ?? localGroup;
  }

  private createUpsertMutation(group: FamilyGroup): FamilySyncMutation {
    const previousRecord =
      this.safeGetRemoteRecord(group.groupCode)
      ?? this.getQueuedRemoteRecord(group.groupCode);

    return {
      kind: 'upsert',
      groupCode: group.groupCode,
      queuedAt: new Date().toISOString(),
      record: mapFamilyGroupToRemoteRecord(group, previousRecord),
    };
  }

  private getQueuedRemoteRecord(groupCode: string) {
    const pendingMutation = getPendingFamilySyncMutation(groupCode);
    return pendingMutation?.kind === 'upsert' ? pendingMutation.record : null;
  }

  private safeGetRemoteRecord(groupCode: string) {
    try {
      return this.remoteGateway.getGroup(groupCode, this.remoteSession);
    } catch {
      return null;
    }
  }

  private enqueueOrApplyMutation(mutation: FamilySyncMutation): void {
    if (!this.applyMutation(mutation)) {
      queueFamilySyncMutation(mutation);
      return;
    }

    this.flushPendingMutations();
  }

  private flushPendingMutations(): void {
    const pendingMutations = getPendingFamilySyncMutations();
    if (pendingMutations.length === 0) {
      return;
    }

    const remainingMutations = pendingMutations.filter((mutation) => !this.applyMutation(mutation));

    if (remainingMutations.length === 0) {
      clearPendingFamilySyncMutations();
      return;
    }

    savePendingFamilySyncMutations(remainingMutations);
  }

  private applyMutation(mutation: FamilySyncMutation): boolean {
    const attemptedAt = new Date().toISOString();

    try {
      if (mutation.kind === 'clear') {
        this.remoteGateway.clearGroup(mutation.groupCode, this.remoteSession);
      } else {
        this.remoteGateway.upsertGroup(mutation.record, this.remoteSession);
      }

      recordFamilySyncSuccess(attemptedAt);
      return true;
    } catch (error) {
      recordFamilySyncFailure(
        attemptedAt,
        error instanceof Error ? error.message : 'family sync failed'
      );
      return false;
    }
  }
}

function mergeFamilyGroups(localGroup: FamilyGroup | null, remoteGroup: FamilyGroup | null): FamilyGroup | null {
  if (!remoteGroup) {
    return localGroup;
  }

  if (!localGroup || localGroup.groupCode !== remoteGroup.groupCode) {
    return remoteGroup;
  }

  const matchedLocalMemberIds = new Set<string>();
  const mergedMembers = remoteGroup.members.map((remoteMember) => {
    const matchedLocalMember = findMatchingLocalMember(localGroup.members, remoteMember);
    if (matchedLocalMember) {
      matchedLocalMemberIds.add(matchedLocalMember.id);
    }

    return mergeFamilyMembers(matchedLocalMember, remoteMember);
  });

  for (const localMember of localGroup.members) {
    const alreadyMerged = mergedMembers.some((member) => (
      member.id === localMember.id
      || (
        member.deviceId
        && localMember.deviceId
        && member.deviceId === localMember.deviceId
      )
    ));

    if (!alreadyMerged && !matchedLocalMemberIds.has(localMember.id)) {
      mergedMembers.push(localMember);
    }
  }

  const localCurrentMember = localGroup.members.find((member) => member.id === localGroup.currentMemberId);
  const mergedCurrentMember = mergedMembers.find((member) => (
    member.id === localGroup.currentMemberId
    || (
      localCurrentMember?.deviceId
      && member.deviceId === localCurrentMember.deviceId
    )
  ));

  return {
    ...remoteGroup,
    memberName: localGroup.memberName,
    currentMemberId: mergedCurrentMember?.id ?? remoteGroup.currentMemberId,
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

function findMatchingLocalMember(
  localMembers: FamilyGroup['members'],
  remoteMember: FamilyGroup['members'][number]
): FamilyGroup['members'][number] | undefined {
  const byId = localMembers.find((member) => member.id === remoteMember.id);
  if (byId) {
    return byId;
  }

  if (!remoteMember.deviceId) {
    return undefined;
  }

  return localMembers.find((member) => member.deviceId === remoteMember.deviceId);
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
  remoteSession = getFamilyRemoteSession(),
}: {
  mode?: FamilySyncMode;
  remoteGateway?: FamilyRemoteGateway;
  remoteSession?: FamilyRemoteSession;
} = {}): FamilyRepository {
  const localRepository = new LocalFamilyRepository();

  if (mode === 'hybrid') {
    return new HybridFamilyRepository(localRepository, remoteGateway, remoteSession);
  }

  return localRepository;
}

export function getFamilyRepository(): FamilyRepository {
  return createFamilyRepository();
}

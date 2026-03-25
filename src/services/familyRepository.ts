import {
  createGroup as createLocalGroup,
  getGroup,
  getShareLink,
  joinGroup as joinLocalGroup,
  leaveGroup as leaveLocalGroup,
  markCurrentMemberNeedsCheckIn,
  setImSafe,
  subscribeToFamilyGroupChanges,
  type FamilyGroup,
} from './familySafetyService';

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

class LocalFamilyRepository implements FamilyRepository {
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
}

const familyRepository = new LocalFamilyRepository();

export function getFamilyRepository(): FamilyRepository {
  return familyRepository;
}


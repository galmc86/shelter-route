import type { FamilyRemoteGateway } from './familyRemoteGateway';
import type { FamilyRemoteGroupRecord } from './familyRemoteModel';
import type { FamilyRemoteSession } from './familyRemoteSessionService';

const STORAGE_KEY_PREFIX = 'shelter-route:family-remote-group:';
const REMOTE_GROUP_UPDATED_EVENT = 'family-remote-group-updated';

function getStorageKey(groupCode: string): string {
  return `${STORAGE_KEY_PREFIX}${groupCode.toUpperCase()}`;
}

function cloneGroup(group: FamilyRemoteGroupRecord): FamilyRemoteGroupRecord {
  return JSON.parse(JSON.stringify(group)) as FamilyRemoteGroupRecord;
}

function notifyRemoteGroupChanged(groupCode: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(REMOTE_GROUP_UPDATED_EVENT, {
    detail: { groupCode: groupCode.toUpperCase() },
  }));
}

class MockFamilyRemoteGateway implements FamilyRemoteGateway {
  getGroup(groupCode: string, _session: FamilyRemoteSession): FamilyRemoteGroupRecord | null {
    try {
      const raw = localStorage.getItem(getStorageKey(groupCode));
      if (!raw) {
        return null;
      }

      return JSON.parse(raw) as FamilyRemoteGroupRecord;
    } catch {
      return null;
    }
  }

  upsertGroup(group: FamilyRemoteGroupRecord, _session: FamilyRemoteSession): FamilyRemoteGroupRecord {
    const nextGroup = cloneGroup(group);

    try {
      localStorage.setItem(getStorageKey(nextGroup.inviteCode), JSON.stringify(nextGroup));
      notifyRemoteGroupChanged(nextGroup.inviteCode);
    } catch {
      // ignore storage failures in mock gateway
    }

    return nextGroup;
  }

  clearGroup(groupCode: string, _session: FamilyRemoteSession): void {
    try {
      localStorage.removeItem(getStorageKey(groupCode));
      notifyRemoteGroupChanged(groupCode);
    } catch {
      // ignore storage failures in mock gateway
    }
  }

  subscribe(groupCode: string, _session: FamilyRemoteSession, listener: () => void): () => void {
    if (typeof window === 'undefined') {
      return () => {};
    }

    const normalizedCode = groupCode.toUpperCase();
    const key = getStorageKey(normalizedCode);

    const handleCustomUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ groupCode?: string }>;
      if (customEvent.detail?.groupCode?.toUpperCase() === normalizedCode) {
        listener();
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === key) {
        listener();
      }
    };

    window.addEventListener(REMOTE_GROUP_UPDATED_EVENT, handleCustomUpdate as EventListener);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(REMOTE_GROUP_UPDATED_EVENT, handleCustomUpdate as EventListener);
      window.removeEventListener('storage', handleStorage);
    };
  }
}

const mockFamilyRemoteGateway = new MockFamilyRemoteGateway();

export function getMockFamilyRemoteGateway(): FamilyRemoteGateway {
  return mockFamilyRemoteGateway;
}

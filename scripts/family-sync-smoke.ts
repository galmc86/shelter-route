import process from 'node:process';
import { pathToFileURL } from 'node:url';

type SessionAuthState = 'anonymous' | 'authenticated';

export interface FamilySyncSmokeSession {
  deviceId: string;
  userId?: string | null;
  authState?: SessionAuthState;
}

export interface FamilySyncSmokeMember {
  id: string;
  userId?: string;
  name: string;
  deviceId: string;
  role: 'owner' | 'member';
  status: 'safe' | 'needs_check_in' | 'unknown';
  joinedAt: string;
  lastSeenAt?: string;
  lastStatusAt?: string;
}

export interface FamilySyncSmokeGroupRecord {
  id: string;
  inviteCode: string;
  version: number;
  displayName?: string;
  createdAt: string;
  updatedAt: string;
  createdByMemberId: string;
  members: FamilySyncSmokeMember[];
}

export interface FamilySyncSmokeTestOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  ownerSession?: FamilySyncSmokeSession;
  rejoinSession?: FamilySyncSmokeSession | null;
  joinerSession?: FamilySyncSmokeSession;
  groupCode?: string;
  log?: (message: string) => void;
  now?: () => string;
}

export interface FamilySyncSmokeTestResult {
  baseUrl: string;
  groupCode: string;
}

function getHeaders(session: FamilySyncSmokeSession): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'X-Family-Device-Id': session.deviceId,
    ...(session.userId ? { 'X-Family-User-Id': session.userId } : {}),
    'X-Family-Auth-State': session.authState ?? 'anonymous',
  };
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function createGroupCode(): string {
  return `SMOKE${Math.random().toString(36).slice(2, 8).toUpperCase()}`.slice(0, 10);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function requestJson<T>(
  fetchImpl: typeof fetch,
  url: string,
  init?: RequestInit
): Promise<{ status: number; data: T | { error?: string; latest?: unknown } | null }> {
  const response = await fetchImpl(url, init);

  if (response.status === 204) {
    return { status: response.status, data: null };
  }

  try {
    return {
      status: response.status,
      data: (await response.json()) as T,
    };
  } catch {
    return { status: response.status, data: null };
  }
}

function createOwnerRecord(groupCode: string, ownerNow: string, ownerSession: FamilySyncSmokeSession): FamilySyncSmokeGroupRecord {
  return {
    id: `family:${groupCode}`,
    inviteCode: groupCode,
    version: 0,
    createdAt: ownerNow,
    updatedAt: ownerNow,
    createdByMemberId: 'member-1',
    members: [
      {
        id: 'member-1',
        ...(ownerSession.userId ? { userId: ownerSession.userId } : {}),
        name: 'Smoke Owner',
        deviceId: ownerSession.deviceId,
        role: 'owner',
        status: 'unknown',
        joinedAt: ownerNow,
        lastSeenAt: ownerNow,
      },
    ],
  };
}

export async function runFamilySyncSmokeTest({
  baseUrl,
  fetchImpl = fetch,
  ownerSession = {
    deviceId: 'smoke-device-owner',
    authState: 'authenticated',
    userId: 'smoke-owner-user',
  },
  rejoinSession = null,
  joinerSession = { deviceId: 'smoke-device-joiner', authState: 'anonymous' },
  groupCode = createGroupCode(),
  log = () => {},
  now = () => new Date().toISOString(),
}: FamilySyncSmokeTestOptions): Promise<FamilySyncSmokeTestResult> {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const groupUrl = `${normalizedBaseUrl}/${groupCode}`;
  const createdAt = now();
  const resolvedRejoinSession = rejoinSession ?? (
    ownerSession.authState === 'authenticated' && ownerSession.userId
      ? {
          deviceId: `${ownerSession.deviceId}-rejoin`,
          authState: 'authenticated',
          userId: ownerSession.userId,
        }
      : null
  );
  const expectedOwnerDeviceId = resolvedRejoinSession?.deviceId ?? ownerSession.deviceId;

  log(`Creating group ${groupCode}`);
  const ownerRecord = createOwnerRecord(groupCode, createdAt, ownerSession);
  const createResponse = await requestJson<FamilySyncSmokeGroupRecord>(fetchImpl, groupUrl, {
    method: 'PUT',
    headers: getHeaders(ownerSession),
    body: JSON.stringify(ownerRecord),
  });
  assert(createResponse.status === 200, `Owner create failed with status ${createResponse.status}`);
  const createdGroup = createResponse.data as FamilySyncSmokeGroupRecord;
  assert(createdGroup.version === 1, `Expected created version 1, got ${createdGroup.version}`);

  if (resolvedRejoinSession?.userId) {
    log(`Rejoining group ${groupCode} as the same authenticated user on another device`);
    const rejoinFetchResponse = await requestJson<FamilySyncSmokeGroupRecord>(fetchImpl, groupUrl, {
      method: 'GET',
      headers: getHeaders(resolvedRejoinSession),
    });
    assert(rejoinFetchResponse.status === 200, `Authenticated rejoin fetch failed with status ${rejoinFetchResponse.status}`);
    const rejoinFetchedGroup = rejoinFetchResponse.data as FamilySyncSmokeGroupRecord;
    const currentOwner = rejoinFetchedGroup.members.find((member) => (
      (ownerSession.userId && member.userId === ownerSession.userId)
      || member.deviceId === ownerSession.deviceId
    ));
    assert(currentOwner, 'Expected to find the authenticated owner before rejoin');

    const rejoinResponse = await requestJson<FamilySyncSmokeGroupRecord>(fetchImpl, groupUrl, {
      method: 'PUT',
      headers: getHeaders(resolvedRejoinSession),
      body: JSON.stringify({
        ...rejoinFetchedGroup,
        members: rejoinFetchedGroup.members.map((member) => (
          member.id === currentOwner.id
            ? {
                ...member,
                userId: resolvedRejoinSession.userId ?? undefined,
                deviceId: resolvedRejoinSession.deviceId,
                lastSeenAt: now(),
              }
            : member
        )),
      } satisfies FamilySyncSmokeGroupRecord),
    });
    assert(rejoinResponse.status === 200, `Authenticated rejoin upsert failed with status ${rejoinResponse.status}`);
    const rejoinedGroup = rejoinResponse.data as FamilySyncSmokeGroupRecord;
    assert(rejoinedGroup.members.length === 1, `Expected 1 member after authenticated rejoin, got ${rejoinedGroup.members.length}`);
    assert(rejoinedGroup.members[0].id === currentOwner.id, 'Authenticated rejoin changed the member identity instead of reusing it');
    assert(rejoinedGroup.members[0].deviceId === resolvedRejoinSession.deviceId, 'Authenticated rejoin did not update the member device identity');
  }

  log(`Fetching group ${groupCode} as joiner`);
  const joinerFetchResponse = await requestJson<FamilySyncSmokeGroupRecord>(fetchImpl, groupUrl, {
    method: 'GET',
    headers: getHeaders(joinerSession),
  });
  assert(joinerFetchResponse.status === 200, `Joiner fetch failed with status ${joinerFetchResponse.status}`);
  const joinerFetchedGroup = joinerFetchResponse.data as FamilySyncSmokeGroupRecord;
  assert(joinerFetchedGroup.members.length === 1, `Expected 1 member before join, got ${joinerFetchedGroup.members.length}`);

  log(`Joining group ${groupCode} as second device`);
  const joinResponse = await requestJson<FamilySyncSmokeGroupRecord>(fetchImpl, groupUrl, {
    method: 'PUT',
    headers: getHeaders(joinerSession),
    body: JSON.stringify({
      ...joinerFetchedGroup,
      members: [
        {
          id: 'member-2',
          name: 'Smoke Joiner',
          deviceId: joinerSession.deviceId,
          role: 'member',
          status: 'unknown',
          joinedAt: now(),
          lastSeenAt: now(),
        },
        ...joinerFetchedGroup.members,
      ],
    } satisfies FamilySyncSmokeGroupRecord),
  });
  assert(joinResponse.status === 200, `Joiner upsert failed with status ${joinResponse.status}`);
  const joinedGroup = joinResponse.data as FamilySyncSmokeGroupRecord;
  assert(joinedGroup.members.length === 2, `Expected 2 members after join, got ${joinedGroup.members.length}`);

  log(`Leaving group ${groupCode} as second device`);
  const leaveResponse = await requestJson<FamilySyncSmokeGroupRecord>(fetchImpl, groupUrl, {
    method: 'PUT',
    headers: getHeaders(joinerSession),
    body: JSON.stringify({
      ...joinedGroup,
      members: joinedGroup.members.filter((member) => member.deviceId !== joinerSession.deviceId),
    } satisfies FamilySyncSmokeGroupRecord),
  });
  assert(leaveResponse.status === 200, `Joiner leave failed with status ${leaveResponse.status}`);
  const afterLeaveGroup = leaveResponse.data as FamilySyncSmokeGroupRecord;
  assert(afterLeaveGroup.members.length === 1, `Expected 1 member after leave, got ${afterLeaveGroup.members.length}`);
  assert(afterLeaveGroup.members[0].deviceId === expectedOwnerDeviceId, 'Owner was not preserved after joiner leave');

  log(`Deleting final group ${groupCode} as owner`);
  const deleteResponse = await requestJson<{ deleted: boolean }>(fetchImpl, groupUrl, {
    method: 'DELETE',
    headers: getHeaders(ownerSession),
  });
  assert(deleteResponse.status === 200, `Owner delete failed with status ${deleteResponse.status}`);

  const finalGetResponse = await requestJson<FamilySyncSmokeGroupRecord>(fetchImpl, groupUrl, {
    method: 'GET',
    headers: getHeaders(ownerSession),
  });
  assert(finalGetResponse.status === 404, `Expected group to be deleted, got status ${finalGetResponse.status}`);

  return {
    baseUrl: normalizedBaseUrl,
    groupCode,
  };
}

function readCliBaseUrl(): string | null {
  const arg = process.argv.slice(2).find((entry) => entry.startsWith('--url='));
  const value = arg ? arg.slice('--url='.length).trim() : (process.env.VITE_FAMILY_REMOTE_URL ?? '').trim();
  return value || null;
}

async function main(): Promise<void> {
  const baseUrl = readCliBaseUrl();
  if (!baseUrl) {
    throw new Error('VITE_FAMILY_REMOTE_URL or --url=<worker-url> is required');
  }

  const result = await runFamilySyncSmokeTest({
    baseUrl,
    log: (message) => console.log(`[family-sync-smoke] ${message}`),
  });

  console.log(
    `[family-sync-smoke] passed for ${result.groupCode} via ${result.baseUrl}`
  );
}

const isEntrypoint = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isEntrypoint) {
  main().catch((error) => {
    console.error(
      `[family-sync-smoke] failed: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exitCode = 1;
  });
}

import {
  isFamilyPushEnabled,
  sendFamilyPushNotification,
  type FamilyPushPayload,
  type FamilyPushSubscriptionRecord,
} from './familyPush';

export interface FamilyRemoteMemberRecord {
  id: string;
  userId?: string;
  deviceId?: string;
  name: string;
  role: 'owner' | 'member';
  status: 'safe' | 'needs_check_in' | 'unknown';
  lastStatusAt?: string;
  lastSeenAt?: string;
  joinedAt: string;
}

export interface FamilyRemoteGroupRecord {
  id: string;
  inviteCode: string;
  version: number;
  displayName?: string;
  createdAt: string;
  updatedAt: string;
  createdByMemberId: string;
  members: FamilyRemoteMemberRecord[];
}

export interface DurableObjectStorageLike {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean | void>;
}

export interface DurableObjectStateLike {
  storage: DurableObjectStorageLike;
}

export interface DurableObjectStubLike {
  fetch(input: Request | string, init?: RequestInit): Promise<Response>;
}

export interface DurableObjectNamespaceLike {
  idFromName(name: string): unknown;
  get(id: unknown): DurableObjectStubLike;
}

export interface Env {
  FAMILY_GROUPS_DO: DurableObjectNamespaceLike;
  ALLOWED_ORIGINS?: string;
  ALLOWED_ORIGIN?: string;
  WEB_PUSH_PUBLIC_KEY?: string;
  WEB_PUSH_PRIVATE_KEY?: string;
  WEB_PUSH_SUBJECT?: string;
}

interface FamilySyncRequestSession {
  deviceId: string | null;
  userId: string | null;
  authState: 'anonymous' | 'authenticated';
}

interface FamilyPushSubscriptionRequest {
  subscription: FamilyPushSubscriptionRecord;
}

interface FamilyPushUnregisterRequest {
  endpoint: string;
}

interface FamilyPushNotificationEvent {
  type: 'member_joined' | 'member_left' | 'member_safe' | 'member_needs_check_in';
  memberId: string;
  memberName: string;
}

const FAMILY_GROUP_RECORD_STORAGE_KEY = 'family-group-record';
const FAMILY_PUSH_SUBSCRIPTIONS_STORAGE_KEY = 'family-push-subscriptions';

export function parseAllowedOrigins(env: Env): string[] {
  const raw = env.ALLOWED_ORIGINS || env.ALLOWED_ORIGIN || '';
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

export function getCorsHeaders(origin: string, env: Env): Record<string, string> {
  const allowedOrigins = parseAllowedOrigins(env);

  if (!origin || !allowedOrigins.includes(origin)) {
    return {};
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Family-Device-Id, X-Family-User-Id, X-Family-Auth-State',
    'Access-Control-Max-Age': '86400',
  };
}

export function normalizeGroupCode(raw: string): string | null {
  const normalized = raw.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{1,64}$/.test(normalized)) {
    return null;
  }

  return normalized;
}

export function decodeFamilyRemoteGroupRecord(
  payload: unknown,
  expectedGroupCode?: string
): FamilyRemoteGroupRecord {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Family remote group payload is malformed');
  }

  const candidate = payload as Partial<FamilyRemoteGroupRecord>;
  if (
    typeof candidate.id !== 'string'
    || typeof candidate.inviteCode !== 'string'
    || typeof candidate.createdAt !== 'string'
    || typeof candidate.updatedAt !== 'string'
    || typeof candidate.createdByMemberId !== 'string'
    || !Array.isArray(candidate.members)
  ) {
    throw new Error('Family remote group payload is malformed');
  }

  const inviteCode = normalizeGroupCode(candidate.inviteCode);
  if (!inviteCode || (expectedGroupCode && inviteCode !== expectedGroupCode)) {
    throw new Error('Family remote group code does not match request path');
  }

  return {
    id: candidate.id,
    inviteCode,
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
    throw new Error('Family remote member payload is malformed');
  }

  const candidate = payload as Partial<FamilyRemoteMemberRecord>;
  if (
    typeof candidate.id !== 'string'
    || typeof candidate.name !== 'string'
    || typeof candidate.joinedAt !== 'string'
  ) {
    throw new Error('Family remote member payload is malformed');
  }

  return {
    id: candidate.id,
    userId: typeof candidate.userId === 'string' ? candidate.userId : undefined,
    deviceId: typeof candidate.deviceId === 'string' ? candidate.deviceId : undefined,
    name: candidate.name,
    role: candidate.role === 'owner' ? 'owner' : 'member',
    status: normalizeMemberStatus(candidate.status),
    lastStatusAt: typeof candidate.lastStatusAt === 'string' ? candidate.lastStatusAt : undefined,
    lastSeenAt: typeof candidate.lastSeenAt === 'string' ? candidate.lastSeenAt : undefined,
    joinedAt: candidate.joinedAt,
  };
}

function normalizeMemberStatus(status: unknown): FamilyRemoteMemberRecord['status'] {
  return status === 'safe' || status === 'needs_check_in' ? status : 'unknown';
}

function decodeFamilyPushSubscriptionRecord(payload: unknown): FamilyPushSubscriptionRecord {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Family push subscription payload is malformed');
  }

  const candidate = payload as Partial<FamilyPushSubscriptionRecord>;
  if (
    typeof candidate.endpoint !== 'string'
    || !candidate.keys
    || typeof candidate.keys !== 'object'
    || typeof candidate.keys.p256dh !== 'string'
    || typeof candidate.keys.auth !== 'string'
  ) {
    throw new Error('Family push subscription payload is malformed');
  }

  return {
    endpoint: candidate.endpoint,
    expirationTime: typeof candidate.expirationTime === 'number' ? candidate.expirationTime : null,
    keys: {
      p256dh: candidate.keys.p256dh,
      auth: candidate.keys.auth,
    },
    deviceId: typeof candidate.deviceId === 'string' ? candidate.deviceId : undefined,
    userId: typeof candidate.userId === 'string' ? candidate.userId : undefined,
    authState: candidate.authState === 'authenticated' ? 'authenticated' : 'anonymous',
    createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : new Date().toISOString(),
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : new Date().toISOString(),
  };
}

function getRequestSession(request: Request): FamilySyncRequestSession {
  const rawDeviceId = request.headers.get('X-Family-Device-Id');
  const rawUserId = request.headers.get('X-Family-User-Id');
  const rawAuthState = request.headers.get('X-Family-Auth-State');

  return {
    deviceId: rawDeviceId?.trim() || null,
    userId: rawUserId?.trim() || null,
    authState: rawAuthState === 'authenticated' ? 'authenticated' : 'anonymous',
  };
}

function isSessionMissingIdentity(session: FamilySyncRequestSession): boolean {
  return !session.deviceId;
}

function isSessionMember(
  member: Pick<FamilyRemoteMemberRecord, 'userId' | 'deviceId'>,
  session: FamilySyncRequestSession
): boolean {
  if (session.userId && member.userId === session.userId) {
    return true;
  }

  return Boolean(session.deviceId) && member.deviceId === session.deviceId;
}

function isSameMemberIdentity(
  left: Pick<FamilyRemoteMemberRecord, 'id' | 'userId' | 'deviceId'>,
  right: Pick<FamilyRemoteMemberRecord, 'id' | 'userId' | 'deviceId'>
): boolean {
  return left.id === right.id
    || (Boolean(left.userId) && Boolean(right.userId) && left.userId === right.userId)
    || (Boolean(left.deviceId) && Boolean(right.deviceId) && left.deviceId === right.deviceId);
}

function areMembersEquivalent(
  left: FamilyRemoteMemberRecord,
  right: FamilyRemoteMemberRecord
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function canCreateGroup(
  nextRecord: FamilyRemoteGroupRecord,
  session: FamilySyncRequestSession
): boolean {
  return nextRecord.members.some((member) => isSessionMember(member, session));
}

function canJoinExistingGroup(
  nextRecord: FamilyRemoteGroupRecord,
  existingRecord: FamilyRemoteGroupRecord,
  session: FamilySyncRequestSession
): boolean {
  const incomingSessionMembers = nextRecord.members.filter((member) => isSessionMember(member, session));
  if (incomingSessionMembers.length === 0) {
    return false;
  }

  return existingRecord.members.every((existingMember) => {
    const incomingMember = nextRecord.members.find((member) => isSameMemberIdentity(member, existingMember));
    return Boolean(incomingMember) && areMembersEquivalent(incomingMember!, existingMember);
  });
}

function canUpdateExistingGroup(
  nextRecord: FamilyRemoteGroupRecord,
  existingRecord: FamilyRemoteGroupRecord,
  sessionOwnedMembers: FamilyRemoteMemberRecord[]
): boolean {
  const existingOwnedIds = new Set(sessionOwnedMembers.map((member) => member.id));

  for (const existingMember of existingRecord.members) {
    if (existingOwnedIds.has(existingMember.id)) {
      continue;
    }

    const incomingMember = nextRecord.members.find((member) => isSameMemberIdentity(member, existingMember));
    if (!incomingMember || !areMembersEquivalent(incomingMember, existingMember)) {
      return false;
    }
  }

  return nextRecord.members.every((member) => (
    existingRecord.members.some((existingMember) => isSameMemberIdentity(existingMember, member))
  ));
}

function canWriteGroup(
  nextRecord: FamilyRemoteGroupRecord,
  existingRecord: FamilyRemoteGroupRecord | null,
  session: FamilySyncRequestSession
): boolean {
  if (!existingRecord) {
    return canCreateGroup(nextRecord, session);
  }

  const existingSessionMembers = existingRecord.members.filter((member) => isSessionMember(member, session));
  if (existingSessionMembers.length === 0) {
    return canJoinExistingGroup(nextRecord, existingRecord, session);
  }

  return canUpdateExistingGroup(nextRecord, existingRecord, existingSessionMembers);
}

function canDeleteGroup(
  existingRecord: FamilyRemoteGroupRecord,
  session: FamilySyncRequestSession
): boolean {
  if (existingRecord.members.length !== 1) {
    return false;
  }

  return isSessionMember(existingRecord.members[0], session);
}

function isSubscriptionOwnedBySession(
  subscription: Pick<FamilyPushSubscriptionRecord, 'deviceId' | 'userId'>,
  session: FamilySyncRequestSession
): boolean {
  if (session.userId && subscription.userId === session.userId) {
    return true;
  }

  return Boolean(session.deviceId) && subscription.deviceId === session.deviceId;
}

function jsonResponse(
  data: unknown,
  status: number,
  corsHeaders: Record<string, string>
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function textResponse(
  body: string,
  status: number,
  corsHeaders: Record<string, string>
): Response {
  return new Response(body, {
    status,
    headers: corsHeaders,
  });
}

function parsePathSegments(pathname: string): string[] {
  return pathname
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .filter((segment) => segment.length > 0);
}

async function handleGetGroup(
  groupCode: string,
  state: DurableObjectStateLike,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const decoded = await readStoredGroup(state, groupCode);
  if (!decoded) {
    return jsonResponse({ error: 'Not found' }, 404, corsHeaders);
  }

  return jsonResponse(decoded, 200, corsHeaders);
}

async function handlePutGroup(
  request: Request,
  groupCode: string,
  state: DurableObjectStateLike,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const session = getRequestSession(request);
    if (isSessionMissingIdentity(session)) {
      return jsonResponse({ error: 'Family sync session is missing device identity' }, 401, corsHeaders);
    }

    const decoded = decodeFamilyRemoteGroupRecord(await request.json(), groupCode);
    const now = new Date().toISOString();
    const existingRecord = await readStoredGroup(state, groupCode);

    if (!canWriteGroup(decoded, existingRecord, session)) {
      return jsonResponse({ error: 'Family sync write is not authorized for this session' }, 403, corsHeaders);
    }

    if (existingRecord && decoded.version !== existingRecord.version) {
      return jsonResponse({
        error: 'Family record version conflict',
        latest: existingRecord,
      }, 409, corsHeaders);
    }

    const nextRecord: FamilyRemoteGroupRecord = existingRecord
      ? {
          ...decoded,
          version: existingRecord.version + 1,
          createdAt: existingRecord.createdAt,
          updatedAt: now,
        }
      : {
          ...decoded,
          version: 1,
          createdAt: decoded.createdAt || now,
          updatedAt: now,
        };

    await state.storage.put(FAMILY_GROUP_RECORD_STORAGE_KEY, nextRecord);
    await notifyGroupSubscribers(existingRecord, nextRecord, session, state, groupCode, env);
    return jsonResponse(nextRecord, 200, corsHeaders);
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Invalid family payload' },
      400,
      corsHeaders
    );
  }
}

async function handleDeleteGroup(
  request: Request,
  groupCode: string,
  state: DurableObjectStateLike,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const session = getRequestSession(request);
  if (isSessionMissingIdentity(session)) {
    return jsonResponse({ error: 'Family sync session is missing device identity' }, 401, corsHeaders);
  }

  const existingRecord = await readStoredGroup(state, groupCode);
  if (!existingRecord) {
    return jsonResponse({ deleted: true }, 200, corsHeaders);
  }

  if (!canDeleteGroup(existingRecord, session)) {
    return jsonResponse({ error: 'Family sync delete is not authorized for this session' }, 403, corsHeaders);
  }

  await state.storage.delete(FAMILY_GROUP_RECORD_STORAGE_KEY);
  await state.storage.delete(FAMILY_PUSH_SUBSCRIPTIONS_STORAGE_KEY);
  return jsonResponse({ deleted: true }, 200, corsHeaders);
}

async function handleGetPushPublicKey(
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  return jsonResponse({
    enabled: isFamilyPushEnabled(env),
    publicKey: env.WEB_PUSH_PUBLIC_KEY ?? null,
  }, 200, corsHeaders);
}

async function handleRegisterPushSubscription(
  request: Request,
  groupCode: string,
  state: DurableObjectStateLike,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const session = getRequestSession(request);
  if (isSessionMissingIdentity(session)) {
    return jsonResponse({ error: 'Family sync session is missing device identity' }, 401, corsHeaders);
  }

  const existingRecord = await readStoredGroup(state, groupCode);
  if (!existingRecord) {
    return jsonResponse({ error: 'Not found' }, 404, corsHeaders);
  }

  try {
    const body = await request.json() as FamilyPushSubscriptionRequest;
    const decoded = decodeFamilyPushSubscriptionRecord(body.subscription);
    const subscriptions = await readStoredPushSubscriptions(state);
    const now = new Date().toISOString();
    const existingSubscription = subscriptions.find((entry) => entry.endpoint === decoded.endpoint);
    const nextSubscription: FamilyPushSubscriptionRecord = {
      ...decoded,
      deviceId: session.deviceId ?? undefined,
      userId: session.userId ?? undefined,
      authState: session.authState,
      createdAt: existingSubscription?.createdAt ?? now,
      updatedAt: now,
    };

    await writeStoredPushSubscriptions(state, [
      ...subscriptions.filter((entry) => entry.endpoint !== nextSubscription.endpoint),
      nextSubscription,
    ]);

    return jsonResponse({ registered: true }, 200, corsHeaders);
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Invalid push subscription payload' },
      400,
      corsHeaders
    );
  }
}

async function handleUnregisterPushSubscription(
  request: Request,
  state: DurableObjectStateLike,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const session = getRequestSession(request);
  if (isSessionMissingIdentity(session)) {
    return jsonResponse({ error: 'Family sync session is missing device identity' }, 401, corsHeaders);
  }

  try {
    const body = await request.json() as FamilyPushUnregisterRequest;
    if (!body.endpoint || typeof body.endpoint !== 'string') {
      return jsonResponse({ error: 'Invalid push unsubscribe payload' }, 400, corsHeaders);
    }

    const subscriptions = await readStoredPushSubscriptions(state);
    await writeStoredPushSubscriptions(
      state,
      subscriptions.filter((entry) => !(
        entry.endpoint === body.endpoint && isSubscriptionOwnedBySession(entry, session)
      ))
    );
    return jsonResponse({ unregistered: true }, 200, corsHeaders);
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Invalid push unsubscribe payload' },
      400,
      corsHeaders
    );
  }
}

async function readStoredGroup(
  state: DurableObjectStateLike,
  groupCode: string
): Promise<FamilyRemoteGroupRecord | null> {
  const stored = await state.storage.get<unknown>(FAMILY_GROUP_RECORD_STORAGE_KEY);
  if (!stored) {
    return null;
  }

  try {
    const rawValue = typeof stored === 'string' ? JSON.parse(stored) : stored;
    return decodeFamilyRemoteGroupRecord(rawValue, groupCode);
  } catch {
    throw new Error('Stored family record is malformed');
  }
}

async function readStoredPushSubscriptions(
  state: DurableObjectStateLike
): Promise<FamilyPushSubscriptionRecord[]> {
  const stored = await state.storage.get<unknown>(FAMILY_PUSH_SUBSCRIPTIONS_STORAGE_KEY);
  if (!stored) {
    return [];
  }

  const rawValue = typeof stored === 'string' ? JSON.parse(stored) : stored;
  if (!Array.isArray(rawValue)) {
    throw new Error('Stored family push subscriptions are malformed');
  }

  return rawValue.map(decodeFamilyPushSubscriptionRecord);
}

async function writeStoredPushSubscriptions(
  state: DurableObjectStateLike,
  subscriptions: FamilyPushSubscriptionRecord[]
): Promise<void> {
  if (subscriptions.length === 0) {
    await state.storage.delete(FAMILY_PUSH_SUBSCRIPTIONS_STORAGE_KEY);
    return;
  }

  await state.storage.put(FAMILY_PUSH_SUBSCRIPTIONS_STORAGE_KEY, subscriptions);
}

function getFamilyPushNotificationEvents(
  previousRecord: FamilyRemoteGroupRecord | null,
  nextRecord: FamilyRemoteGroupRecord | null
): FamilyPushNotificationEvent[] {
  if (!previousRecord || !nextRecord || previousRecord.inviteCode !== nextRecord.inviteCode) {
    return [];
  }

  const events: FamilyPushNotificationEvent[] = [];

  for (const nextMember of nextRecord.members) {
    const previousMember = previousRecord.members.find((member) => isSameMemberIdentity(member, nextMember));
    if (!previousMember) {
      events.push({
        type: 'member_joined',
        memberId: nextMember.id,
        memberName: nextMember.name,
      });
      continue;
    }

    if (previousMember.status !== nextMember.status) {
      if (nextMember.status === 'safe') {
        events.push({
          type: 'member_safe',
          memberId: nextMember.id,
          memberName: nextMember.name,
        });
      } else if (previousMember.status === 'safe' && nextMember.status === 'needs_check_in') {
        events.push({
          type: 'member_needs_check_in',
          memberId: nextMember.id,
          memberName: nextMember.name,
        });
      }
    }
  }

  for (const previousMember of previousRecord.members) {
    if (!nextRecord.members.some((member) => isSameMemberIdentity(member, previousMember))) {
      events.push({
        type: 'member_left',
        memberId: previousMember.id,
        memberName: previousMember.name,
      });
    }
  }

  return events;
}

function buildFamilyPushPayload(
  groupCode: string,
  event: FamilyPushNotificationEvent
): FamilyPushPayload {
  switch (event.type) {
    case 'member_joined':
      return {
        title: 'Family Update',
        body: `${event.memberName} joined your family group.`,
        tag: `family-joined-${groupCode}-${event.memberId}`,
        url: `/?familyGroup=${encodeURIComponent(groupCode)}`,
      };
    case 'member_left':
      return {
        title: 'Family Update',
        body: `${event.memberName} left your family group.`,
        tag: `family-left-${groupCode}-${event.memberId}`,
        url: `/?familyGroup=${encodeURIComponent(groupCode)}`,
      };
    case 'member_safe':
      return {
        title: 'Family Safety Check-In',
        body: `${event.memberName} marked themselves safe.`,
        tag: `family-safe-${groupCode}-${event.memberId}`,
        url: `/?familyGroup=${encodeURIComponent(groupCode)}`,
      };
    case 'member_needs_check_in':
      return {
        title: 'Family Safety Check-In',
        body: `${event.memberName} needs a check-in.`,
        tag: `family-checkin-${groupCode}-${event.memberId}`,
        url: `/?familyGroup=${encodeURIComponent(groupCode)}`,
      };
    default:
      return {
        title: 'Family Update',
        body: event.memberName,
        tag: `family-${groupCode}-${event.memberId}`,
        url: `/?familyGroup=${encodeURIComponent(groupCode)}`,
      };
  }
}

async function notifyGroupSubscribers(
  previousRecord: FamilyRemoteGroupRecord | null,
  nextRecord: FamilyRemoteGroupRecord,
  session: FamilySyncRequestSession,
  state: DurableObjectStateLike,
  groupCode: string,
  env: Env
): Promise<void> {
  if (!isFamilyPushEnabled(env)) {
    return;
  }

  const events = getFamilyPushNotificationEvents(previousRecord, nextRecord);
  if (events.length === 0) {
    return;
  }

  const subscriptions = await readStoredPushSubscriptions(state);
  const targetSubscriptions = subscriptions.filter((subscription) => !isSubscriptionOwnedBySession(subscription, session));
  if (targetSubscriptions.length === 0) {
    return;
  }

  const staleEndpoints = new Set<string>();
  for (const event of events) {
    const payload = buildFamilyPushPayload(groupCode, event);
    const results = await Promise.all(
      targetSubscriptions.map((subscription) => sendFamilyPushNotification(subscription, payload, env))
    );

    results.forEach((result, index) => {
      if (result === 'stale') {
        staleEndpoints.add(targetSubscriptions[index].endpoint);
      }
    });
  }

  if (staleEndpoints.size > 0) {
    await writeStoredPushSubscriptions(
      state,
      subscriptions.filter((subscription) => !staleEndpoints.has(subscription.endpoint))
    );
  }
}

export class FamilyGroupDurableObject {
  private readonly state: DurableObjectStateLike;
  private readonly env: Env;

  constructor(state: DurableObjectStateLike, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const origin = request.headers.get('Origin') || '';
    const corsHeaders = getCorsHeaders(origin, this.env);
    const url = new URL(request.url);
    const segments = parsePathSegments(url.pathname);
    const groupCode = normalizeGroupCode(segments[0] ?? '');
    const subPath = segments.slice(1).join('/');

    if (request.method === 'OPTIONS') {
      if (origin && !corsHeaders['Access-Control-Allow-Origin']) {
        return textResponse('Forbidden', 403, {});
      }

      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (!groupCode) {
      return jsonResponse({ error: 'Invalid family group code' }, 404, corsHeaders);
    }

    if (!subPath) {
      if (request.method === 'GET') {
        try {
          return await handleGetGroup(groupCode, this.state, corsHeaders);
        } catch {
          return jsonResponse({ error: 'Stored family record is malformed' }, 500, corsHeaders);
        }
      }

      if (request.method === 'PUT') {
        return handlePutGroup(request, groupCode, this.state, this.env, corsHeaders);
      }

      if (request.method === 'DELETE') {
        return handleDeleteGroup(request, groupCode, this.state, corsHeaders);
      }
    }

    if (request.method === 'POST' && subPath === 'push-subscriptions') {
      return handleRegisterPushSubscription(request, groupCode, this.state, corsHeaders);
    }

    if (request.method === 'POST' && subPath === 'push-subscriptions/unregister') {
      return handleUnregisterPushSubscription(request, this.state, corsHeaders);
    }

    return textResponse('Method not allowed', 405, corsHeaders);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') || '';
    const corsHeaders = getCorsHeaders(origin, env);
    const url = new URL(request.url);
    const segments = parsePathSegments(url.pathname);

    if (segments[0] === 'push' && segments[1] === 'public-key') {
      return handleGetPushPublicKey(env, corsHeaders);
    }

    const groupCode = normalizeGroupCode(segments[0] ?? '');
    if (!groupCode) {
      return jsonResponse({ error: 'Invalid family group code' }, 404, corsHeaders);
    }

    const objectId = env.FAMILY_GROUPS_DO.idFromName(groupCode);
    const stub = env.FAMILY_GROUPS_DO.get(objectId);
    return stub.fetch(request);
  },
};

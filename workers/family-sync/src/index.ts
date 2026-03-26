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
  displayName?: string;
  createdAt: string;
  updatedAt: string;
  createdByMemberId: string;
  members: FamilyRemoteMemberRecord[];
}

export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface Env {
  FAMILY_GROUPS: KeyValueStore;
  ALLOWED_ORIGINS?: string;
  ALLOWED_ORIGIN?: string;
}

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
    'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
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

async function handleGetGroup(
  groupCode: string,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const raw = await env.FAMILY_GROUPS.get(groupCode);
  if (!raw) {
    return jsonResponse({ error: 'Not found' }, 404, corsHeaders);
  }

  try {
    const decoded = decodeFamilyRemoteGroupRecord(JSON.parse(raw), groupCode);
    return jsonResponse(decoded, 200, corsHeaders);
  } catch {
    return jsonResponse({ error: 'Stored family record is malformed' }, 500, corsHeaders);
  }
}

async function handlePutGroup(
  request: Request,
  groupCode: string,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const decoded = decodeFamilyRemoteGroupRecord(await request.json(), groupCode);
    await env.FAMILY_GROUPS.put(groupCode, JSON.stringify(decoded));
    return jsonResponse(decoded, 200, corsHeaders);
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Invalid family payload' },
      400,
      corsHeaders
    );
  }
}

async function handleDeleteGroup(
  groupCode: string,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  await env.FAMILY_GROUPS.delete(groupCode);
  return jsonResponse({ deleted: true }, 200, corsHeaders);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') || '';
    const corsHeaders = getCorsHeaders(origin, env);
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      if (origin && !corsHeaders['Access-Control-Allow-Origin']) {
        return textResponse('Forbidden', 403, {});
      }

      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const groupCode = normalizeGroupCode(url.pathname.replace(/^\/+/, ''));
    if (!groupCode) {
      return jsonResponse({ error: 'Invalid family group code' }, 404, corsHeaders);
    }

    if (request.method === 'GET') {
      return handleGetGroup(groupCode, env, corsHeaders);
    }

    if (request.method === 'PUT') {
      return handlePutGroup(request, groupCode, env, corsHeaders);
    }

    if (request.method === 'DELETE') {
      return handleDeleteGroup(groupCode, env, corsHeaders);
    }

    return textResponse('Method not allowed', 405, corsHeaders);
  },
};

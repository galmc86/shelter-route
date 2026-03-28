/**
 * Cloudflare Worker — OREF Alerts CORS Proxy
 *
 * Fetches active rocket alerts from the Pikud Ha'Oref (Home Front Command) API.
 * Direct access to oref.org.il is blocked by their Akamai WAF for cloud IPs,
 * so we use the community Tzeva Adom API which mirrors OREF data in real-time.
 *
 * Routes:
 *   GET /         — active alerts (last 2 minutes)
 *   GET /history  — recent alert history (grouped by event)
 *   GET /status   — upstream freshness / debug summary
 *
 * Deploy: cd workers/oref-proxy && npx wrangler deploy
 */

export interface Env {
  ALLOWED_ORIGINS?: string;
  ALLOWED_ORIGIN?: string; // backward compat
}

// Current Tzeva Adom iOS feed (contains history + system messages + instructions)
const IOS_FEED_URL = 'https://api.tzevaadom.co.il/ios/feed';

// Legacy community endpoints kept as fallbacks
const ALERTS_URL = 'https://api.tzevaadom.co.il/notifications';
const HISTORY_URL = 'https://api.tzevaadom.co.il/alerts-history/';

// Fallback: try OREF directly (may work from some CF edge locations)
const OREF_URL = 'https://www.oref.org.il/WarningMessages/alert/alerts.json';

interface TzevaAdomAlert {
  notificationId: string;
  time: string;
  threat: number; // 0 = rockets, 1 = hostile aircraft, etc.
  isDrill: boolean;
  cities: string[];
}

interface TzevaAdomHistoryEvent {
  id: number;
  description: string | null;
  alerts: {
    time: number;     // unix timestamp
    cities: string[];
    threat: number;
    isDrill: boolean;
  }[];
}

interface TzevaAdomIosFeed {
  alertsHistory?: TzevaAdomHistoryEvent[];
}

interface OrefAlert {
  id: string;
  cat: string;
  title: string;
  data: string[];
  desc: string;
  alertDate: string;
}

const ACTIVE_ALERT_WINDOW_MS = 2 * 60 * 1000;

interface OrefStatusResponse {
  checkedAt: string;
  source: 'ios_feed' | 'legacy_history' | 'unavailable';
  activeWindowSeconds: number;
  alertsHistoryCount: number;
  latestAlertUnix: number | null;
  latestAlertIso: string | null;
  latestAlertAgeSeconds: number | null;
  activeAlertCount: number;
}

/**
 * Parse allowed origins from env vars.
 * Prefers ALLOWED_ORIGINS (comma-separated), falls back to ALLOWED_ORIGIN (singular).
 */
export function parseAllowedOrigins(env: Env): string[] {
  const raw = env.ALLOWED_ORIGINS || env.ALLOWED_ORIGIN || '';
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
}

/**
 * Convert Tzeva Adom API format to our app's expected OREF format.
 * Only includes alerts from the last 2 minutes (active alerts).
 */
function convertTzevaAdomToOref(alerts: TzevaAdomAlert[]): OrefAlert[] {
  const twoMinutesAgo = Date.now() - ACTIVE_ALERT_WINDOW_MS;

  return alerts
    .filter((a) => {
      const alertTime = new Date(a.time).getTime();
      return alertTime > twoMinutesAgo && !a.isDrill;
    })
    .map((a) => ({
      id: a.notificationId,
      cat: String(a.threat),
      title: 'ירי רקטות וטילים',
      data: a.cities,
      desc: '',
      alertDate: a.time,
    }));
}

/**
 * Convert history events to a flat list of OrefAlert entries.
 */
function convertHistoryToOref(events: TzevaAdomHistoryEvent[]): OrefAlert[] {
  return events.flatMap((event) =>
    event.alerts
      .filter((a) => !a.isDrill)
      .map((a, i) => ({
        id: `${event.id}-${i}`,
        cat: String(a.threat),
        title: 'ירי רקטות וטילים',
        data: a.cities,
        desc: event.description || '',
        alertDate: new Date(a.time * 1000).toISOString(),
      }))
  );
}

function convertRecentHistoryToOref(
  events: TzevaAdomHistoryEvent[],
  now: number = Date.now()
): OrefAlert[] {
  const cutoff = now - ACTIVE_ALERT_WINDOW_MS;
  return convertHistoryToOref(events).filter((alert) => {
    const alertTime = Date.parse(alert.alertDate);
    return Number.isFinite(alertTime) && alertTime > cutoff;
  });
}

function getLatestHistoryAlertUnix(events: TzevaAdomHistoryEvent[]): number | null {
  let latest: number | null = null;

  for (const event of events) {
    for (const alert of event.alerts) {
      if (alert.isDrill) {
        continue;
      }

      latest = latest === null ? alert.time : Math.max(latest, alert.time);
    }
  }

  return latest;
}

function parseDirectOrefAlerts(text: string): OrefAlert[] {
  const normalized = text.replace(/^\uFEFF/, '').trim();
  if (!normalized) {
    return [];
  }

  try {
    const parsed = JSON.parse(normalized);
    return Array.isArray(parsed) ? parsed as OrefAlert[] : [];
  } catch {
    return [];
  }
}

async function fetchRecentHistoryAlerts(): Promise<OrefAlert[]> {
  const events = await fetchHistoryEvents(IOS_FEED_URL) ?? await fetchHistoryEvents(HISTORY_URL) ?? [];
  return convertRecentHistoryToOref(events);
}

async function fetchHistoryEvents(sourceUrl: string): Promise<TzevaAdomHistoryEvent[] | null> {
  const response = await fetch(sourceUrl, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json() as TzevaAdomHistoryEvent[] | TzevaAdomIosFeed;
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && Array.isArray(payload.alertsHistory)) {
    return payload.alertsHistory;
  }

  return null;
}

async function buildStatusSummary(): Promise<OrefStatusResponse> {
  const checkedAt = new Date().toISOString();
  const nowMs = Date.now();

  const iosFeedEvents = await fetchHistoryEvents(IOS_FEED_URL);
  const legacyHistoryEvents = iosFeedEvents ? null : await fetchHistoryEvents(HISTORY_URL);
  const events = iosFeedEvents ?? legacyHistoryEvents ?? [];
  const source: OrefStatusResponse['source'] = iosFeedEvents
    ? 'ios_feed'
    : legacyHistoryEvents
      ? 'legacy_history'
      : 'unavailable';
  const latestAlertUnix = getLatestHistoryAlertUnix(events);

  return {
    checkedAt,
    source,
    activeWindowSeconds: Math.floor(ACTIVE_ALERT_WINDOW_MS / 1000),
    alertsHistoryCount: events.length,
    latestAlertUnix,
    latestAlertIso: latestAlertUnix ? new Date(latestAlertUnix * 1000).toISOString() : null,
    latestAlertAgeSeconds: latestAlertUnix ? Math.max(0, Math.floor((nowMs / 1000) - latestAlertUnix)) : null,
    activeAlertCount: convertRecentHistoryToOref(events, nowMs).length,
  };
}

/**
 * Build CORS headers for a given request origin.
 * Returns headers with Access-Control-Allow-Origin ONLY if the origin is allowed.
 * If the origin is not in the allowed list, CORS headers are omitted (browser will block).
 */
export function getCorsHeaders(origin: string, env: Env): Record<string, string> {
  const allowedOrigins = parseAllowedOrigins(env);

  if (!allowedOrigins.includes(origin)) {
    return {};
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(data: unknown, corsHeaders: Record<string, string>, cache = false): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cache
        ? 'public, max-age=30, stale-while-revalidate=60'
        : 'no-cache, no-store, must-revalidate',
    },
  });
}

async function handleActiveAlerts(corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const iosFeedEvents = await fetchHistoryEvents(IOS_FEED_URL);
    if (iosFeedEvents) {
      const recentAlerts = convertRecentHistoryToOref(iosFeedEvents);
      if (recentAlerts.length > 0) {
        return jsonResponse(recentAlerts, corsHeaders);
      }
    }

    // Primary: Tzeva Adom community API
    const response = await fetch(ALERTS_URL, {
      headers: { 'Accept': 'application/json' },
    });

    if (response.ok) {
      const alerts: TzevaAdomAlert[] = await response.json();
      const convertedAlerts = convertTzevaAdomToOref(alerts);
      if (convertedAlerts.length > 0) {
        return jsonResponse(convertedAlerts, corsHeaders);
      }
    }

    // Fallback: try OREF directly
    const orefResponse = await fetch(OREF_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://www.oref.org.il/',
        'X-Requested-With': 'XMLHttpRequest',
      },
    });

    const text = await orefResponse.text();
    const directAlerts = parseDirectOrefAlerts(text);
    if (directAlerts.length > 0) {
      return jsonResponse(directAlerts, corsHeaders);
    }

    return jsonResponse(
      convertRecentHistoryToOref(iosFeedEvents ?? await fetchHistoryEvents(HISTORY_URL) ?? []),
      corsHeaders
    );
  } catch {
    try {
      return jsonResponse(await fetchRecentHistoryAlerts(), corsHeaders);
    } catch {
      return jsonResponse([], corsHeaders);
    }
  }
}

async function handleHistory(corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const events = await fetchHistoryEvents(IOS_FEED_URL) ?? await fetchHistoryEvents(HISTORY_URL);
    if (!events) {
      return jsonResponse([], corsHeaders, true);
    }

    return jsonResponse(convertHistoryToOref(events), corsHeaders, true);
  } catch {
    return jsonResponse([], corsHeaders, true);
  }
}

async function handleStatus(corsHeaders: Record<string, string>): Promise<Response> {
  try {
    return jsonResponse(await buildStatusSummary(), corsHeaders, true);
  } catch {
    return jsonResponse({
      checkedAt: new Date().toISOString(),
      source: 'unavailable',
      activeWindowSeconds: Math.floor(ACTIVE_ALERT_WINDOW_MS / 1000),
      alertsHistoryCount: 0,
      latestAlertUnix: null,
      latestAlertIso: null,
      latestAlertAgeSeconds: null,
      activeAlertCount: 0,
    } satisfies OrefStatusResponse, corsHeaders, true);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') || '';
    const corsHeaders = getCorsHeaders(origin, env);
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      // If origin is not allowed, return 403
      if (!corsHeaders['Access-Control-Allow-Origin']) {
        return new Response('Forbidden', { status: 403 });
      }
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Only allow GET
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    // Route
    if (url.pathname === '/history') {
      return handleHistory(corsHeaders);
    }

    if (url.pathname === '/status') {
      return handleStatus(corsHeaders);
    }

    // Default: active alerts
    return handleActiveAlerts(corsHeaders);
  },
};

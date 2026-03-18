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
 *
 * Deploy: cd workers/oref-proxy && npx wrangler deploy
 */

interface Env {
  ALLOWED_ORIGIN: string;
}

// Community API that mirrors OREF alerts in real-time with proper access
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

interface OrefAlert {
  id: string;
  cat: string;
  title: string;
  data: string[];
  desc: string;
  alertDate: string;
}

/**
 * Convert Tzeva Adom API format to our app's expected OREF format.
 * Only includes alerts from the last 2 minutes (active alerts).
 */
function convertTzevaAdomToOref(alerts: TzevaAdomAlert[]): OrefAlert[] {
  const twoMinutesAgo = Date.now() - 2 * 60 * 1000;

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

function getCorsHeaders(origin: string, env: Env): Record<string, string> {
  const allowedOrigins = [
    env.ALLOWED_ORIGIN,
    'http://localhost:5173',
    'http://localhost:4173',
  ];

  const isAllowed = allowedOrigins.some((o) => origin === o);
  const corsOrigin = isAllowed ? origin : allowedOrigins[0];

  return {
    'Access-Control-Allow-Origin': corsOrigin,
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
    // Primary: Tzeva Adom community API
    const response = await fetch(ALERTS_URL, {
      headers: { 'Accept': 'application/json' },
    });

    if (response.ok) {
      const alerts: TzevaAdomAlert[] = await response.json();
      return jsonResponse(convertTzevaAdomToOref(alerts), corsHeaders);
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
    const body = text.trim() === '' ? '[]' : text;

    return new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch {
    return jsonResponse([], corsHeaders);
  }
}

async function handleHistory(corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const response = await fetch(HISTORY_URL, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      return jsonResponse([], corsHeaders, true);
    }

    const events: TzevaAdomHistoryEvent[] = await response.json();
    return jsonResponse(convertHistoryToOref(events), corsHeaders, true);
  } catch {
    return jsonResponse([], corsHeaders, true);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') || '';
    const corsHeaders = getCorsHeaders(origin, env);
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
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

    // Default: active alerts
    return handleActiveAlerts(corsHeaders);
  },
};

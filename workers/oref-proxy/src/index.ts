/**
 * Cloudflare Worker — OREF Alerts CORS Proxy
 *
 * Fetches active rocket alerts from the Pikud Ha'Oref (Home Front Command) API.
 * Direct access to oref.org.il is blocked by their Akamai WAF for cloud IPs,
 * so we use the community Tzeva Adom API which mirrors OREF data in real-time.
 *
 * Deploy: cd workers/oref-proxy && npx wrangler deploy
 */

interface Env {
  ALLOWED_ORIGIN: string;
}

// Community API that mirrors OREF alerts in real-time with proper access
const ALERTS_URL = 'https://api.tzevaadom.co.il/notifications';

// Fallback: try OREF directly (may work from some CF edge locations)
const OREF_URL = 'https://www.oref.org.il/WarningMessages/alert/alerts.json';

interface TzevaAdomAlert {
  notificationId: string;
  time: string;
  threat: number; // 0 = rockets, 1 = hostile aircraft, etc.
  isDrill: boolean;
  cities: string[];
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') || '';
    const allowedOrigins = [
      env.ALLOWED_ORIGIN,
      'http://localhost:5173',
      'http://localhost:4173',
    ];

    const isAllowed = allowedOrigins.some((o) => origin === o);
    const corsOrigin = isAllowed ? origin : allowedOrigins[0];

    const corsHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Only allow GET
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    try {
      // Primary: Tzeva Adom community API
      const response = await fetch(ALERTS_URL, {
        headers: { 'Accept': 'application/json' },
      });

      if (response.ok) {
        const alerts: TzevaAdomAlert[] = await response.json();
        const orefAlerts = convertTzevaAdomToOref(alerts);

        return new Response(JSON.stringify(orefAlerts), {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        });
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
      return new Response('[]', {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json; charset=utf-8',
        },
      });
    }
  },
};

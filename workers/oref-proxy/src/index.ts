/**
 * Cloudflare Worker — OREF Alerts CORS Proxy
 *
 * Proxies requests to the OREF (Home Front Command) alerts API,
 * adding CORS headers so the browser app can access it.
 *
 * Deploy: cd workers/oref-proxy && npx wrangler deploy
 */

interface Env {
  ALLOWED_ORIGIN: string;
}

const OREF_URL = 'https://www.oref.org.il/WarningMessages/alert/alerts.json';

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
      const orefResponse = await fetch(OREF_URL, {
        headers: {
          'User-Agent': 'ShelterRoute/1.0',
          'Referer': 'https://www.oref.org.il/',
          'X-Requested-With': 'XMLHttpRequest',
        },
      });

      // OREF returns empty body when no alerts — normalize to empty array
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

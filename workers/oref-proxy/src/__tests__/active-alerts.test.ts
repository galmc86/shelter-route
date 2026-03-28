// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker, { type Env } from '../index';

const env: Env = {
  ALLOWED_ORIGINS: 'https://shelter-route.pages.dev',
};

function makeRequest(path = '/'): Request {
  return new Request(`https://proxy.example.com${path}`, {
    headers: {
      Origin: 'https://shelter-route.pages.dev',
    },
  });
}

describe('oref-proxy active alert fallback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-28T04:00:00.000Z'));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('uses recent alerts from the new iOS feed when they are present', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([
        {
          alertsHistory: [
            {
              id: 6733,
              description: null,
              alerts: [
                {
                  time: Math.floor(Date.parse('2026-03-28T03:59:30.000Z') / 1000),
                  cities: ['תל אביב - מרכז העיר'],
                  threat: 0,
                  isDrill: false,
                },
              ],
            },
          ],
        },
      ][0]), { status: 200 }));

    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(makeRequest(), env);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      {
        id: '6733-0',
        cat: '0',
        title: 'ירי רקטות וטילים',
        data: ['תל אביב - מרכז העיר'],
        desc: '',
        alertDate: '2026-03-28T03:59:30.000Z',
      },
    ]);
  });

  it('returns an empty list when the iOS feed is stale and legacy live endpoints are empty', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([
        {
          alertsHistory: [
            {
              id: 6732,
              description: null,
              alerts: [
                {
                  time: Math.floor(Date.parse('2026-03-28T03:50:00.000Z') / 1000),
                  cities: ['באר שבע'],
                  threat: 0,
                  isDrill: false,
                },
              ],
            },
          ],
        },
      ][0]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response('', { status: 200 }));

    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(makeRequest(), env);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });
});

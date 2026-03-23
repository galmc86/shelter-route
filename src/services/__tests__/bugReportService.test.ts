import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  flushQueue,
  getQueuedReports,
  queueReport,
  type BugReport,
} from '../bugReportService';

function makeBugReport(overrides: Partial<Omit<BugReport, 'id'>> = {}): Omit<BugReport, 'id'> {
  return {
    category: 'other',
    description: 'Test report',
    timestamp: 1710000000000,
    context: {
      language: 'he',
      theme: 'light',
      userAgent: 'vitest',
      online: true,
      url: 'https://example.com',
      viewport: { width: 1280, height: 720 },
    },
    ...overrides,
  };
}

describe('bugReportService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    localStorage.clear();
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    });
  });

  it('queues reports in localStorage with generated ids', () => {
    const report = queueReport(makeBugReport());

    expect(report.id).toMatch(/^\d+-[a-z0-9]+$/);
    expect(getQueuedReports()).toEqual([report]);
  });

  it('does not flush when the browser is offline', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    queueReport(makeBugReport());
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: false,
    });

    await flushQueue();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(getQueuedReports()).toHaveLength(1);
  });

  it('keeps queued reports when no endpoint is configured', async () => {
    queueReport(makeBugReport());

    await flushQueue();

    expect(getQueuedReports()).toHaveLength(1);
  });

  it('flushes queued reports successfully when an endpoint is configured', async () => {
    vi.stubEnv('VITE_BUG_REPORT_URL', 'https://example.com/bug-report');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 204 })
    );
    const report = queueReport(makeBugReport());

    await flushQueue();

    expect(fetchSpy).toHaveBeenCalledWith('https://example.com/bug-report', {
      method: 'POST',
      body: JSON.stringify(report),
      mode: 'no-cors',
    });
    expect(getQueuedReports()).toEqual([]);
  });

  it('keeps reports queued when sending fails', async () => {
    vi.stubEnv('VITE_BUG_REPORT_URL', 'https://example.com/bug-report');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));
    const report = queueReport(makeBugReport());

    await flushQueue();

    expect(getQueuedReports()).toEqual([report]);
  });

  it('treats blank endpoints as unconfigured and keeps reports queued', async () => {
    vi.stubEnv('VITE_BUG_REPORT_URL', '   ');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const report = queueReport(makeBugReport());

    await flushQueue();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(getQueuedReports()).toEqual([report]);
  });
});

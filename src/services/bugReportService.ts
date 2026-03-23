import { ServiceError } from './serviceResult';

export interface BugReport {
  id: string;
  category: 'shelter-data' | 'routing' | 'alerts' | 'ui' | 'other';
  description: string;
  timestamp: number;
  context: {
    language: string;
    theme: string;
    userAgent: string;
    online: boolean;
    url: string;
    viewport: { width: number; height: number };
  };
}

const STORAGE_KEY = 'shelter-route-bug-reports';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function saveQueuedReports(reports: BugReport[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
  } catch (err) {
    console.warn(
      '[BugReport] Failed to persist queue:',
      new ServiceError('UNKNOWN', 'Bug report queue persistence failed', undefined, false, err).message
    );
  }
}

/** Get all queued (unsent) bug reports from localStorage */
export function getQueuedReports(): BugReport[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Save a bug report to the local queue */
export function queueReport(report: Omit<BugReport, 'id'>): BugReport {
  const full: BugReport = { ...report, id: generateId() };
  const existing = getQueuedReports();
  existing.push(full);
  saveQueuedReports(existing);
  return full;
}

/** Remove a successfully sent report from the queue */
function removeFromQueue(id: string): void {
  const reports = getQueuedReports().filter((r) => r.id !== id);
  saveQueuedReports(reports);
}

/**
 * Attempt to send a single report to the configured endpoint.
 * Returns true on success (or if no endpoint is configured — treats as logged locally).
 */
async function sendReport(report: BugReport): Promise<boolean> {
  const endpoint = (import.meta.env.VITE_BUG_REPORT_URL as string | undefined)?.trim();
  if (!endpoint) {
    // No endpoint configured — report stays queued locally
    return false;
  }

  // Google Apps Script doesn't return CORS headers, so we must use no-cors.
  // The request still reaches the server; the response is opaque (status 0).
  // Both script.google.com and script.googleusercontent.com must be in CSP
  // connect-src for the browser to allow the request.
  //
  // NOTE: resilientFetch expects JSON responses, but no-cors returns opaque
  // responses (status 0, empty body). This will result in a PARSE error from
  // resilientFetch, but we treat any non-throw as success since with no-cors
  // we can't read the response anyway.
  try {
    await fetch(endpoint, {
      method: 'POST',
      body: JSON.stringify(report),
      mode: 'no-cors',
    });
    // With no-cors we can't read the response, but if fetch didn't throw
    // the request was sent successfully.
    return true;
  } catch (err) {
    console.warn('[BugReport] Failed to send report:', new ServiceError('NETWORK', 'Bug report send failed', undefined, false, err).message);
    return false;
  }
}

/** Try to flush all queued reports. Removes successfully sent ones. */
export async function flushQueue(): Promise<void> {
  if (!navigator.onLine) return;

  const reports = getQueuedReports();
  for (const report of reports) {
    const ok = await sendReport(report);
    if (ok) {
      removeFromQueue(report.id);
    }
  }
}

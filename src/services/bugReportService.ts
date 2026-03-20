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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  return full;
}

/** Remove a successfully sent report from the queue */
function removeFromQueue(id: string): void {
  const reports = getQueuedReports().filter((r) => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}

/**
 * Attempt to send a single report to the configured endpoint.
 * Returns true on success (or if no endpoint is configured — treats as logged locally).
 */
async function sendReport(report: BugReport): Promise<boolean> {
  const endpoint = import.meta.env.VITE_BUG_REPORT_URL as string | undefined;
  if (!endpoint) {
    // No endpoint configured — report stays queued locally
    return false;
  }

  try {
    // Google Apps Script redirects POST to script.googleusercontent.com.
    // Both domains must be in the CSP connect-src directive.
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(report),
      redirect: 'follow',
    });
    return res.ok || res.type === 'opaque';
  } catch {
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

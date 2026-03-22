const STORAGE_KEY = 'shelter-route:shelter-reports';

export type ShelterReportStatus = 'open' | 'locked' | 'crowded' | 'empty' | 'damaged' | 'key-required';

export interface ShelterReport {
  shelterId: string;
  status: ShelterReportStatus;
  timestamp: number;
  expiresAt: number;
}

const REPORT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function loadReports(): ShelterReport[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ShelterReport[];
  } catch {
    return [];
  }
}

function saveReports(reports: ShelterReport[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}

export function clearExpiredReports(): void {
  const now = Date.now();
  const reports = loadReports().filter((r) => r.expiresAt > now);
  saveReports(reports);
}

export function addReport(shelterId: string, status: ShelterReportStatus): ShelterReport {
  clearExpiredReports();
  const report: ShelterReport = {
    shelterId,
    status,
    timestamp: Date.now(),
    expiresAt: Date.now() + REPORT_TTL_MS,
  };
  const reports = loadReports();
  reports.push(report);
  saveReports(reports);
  return report;
}

export function getReportsForShelter(shelterId: string): ShelterReport[] {
  clearExpiredReports();
  return loadReports().filter((r) => r.shelterId === shelterId);
}

export function getAggregatedStatus(shelterId: string): ShelterReportStatus | null {
  const reports = getReportsForShelter(shelterId);
  if (reports.length === 0) return null;

  const counts = new Map<ShelterReportStatus, number>();
  for (const r of reports) {
    counts.set(r.status, (counts.get(r.status) || 0) + 1);
  }

  let maxStatus: ShelterReportStatus = reports[0].status;
  let maxCount = 0;
  for (const [status, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      maxStatus = status;
    }
  }
  return maxStatus;
}

export function getStatusBadgeColor(status: ShelterReportStatus | null): string {
  switch (status) {
    case 'open': return '#4CAF50';
    case 'locked': return '#F44336';
    case 'crowded': return '#FF9800';
    case 'empty': return '#9E9E9E';
    case 'damaged': return '#F44336';
    case 'key-required': return '#FF9800';
    default: return '#9E9E9E';
  }
}

const STORAGE_KEY = 'shelter-route:safety-analytics';

interface SafetyAnalyticsData {
  routesSearched: number;
  sheltersFound: number[];
  emergencyActivations: number;
  lastActivity: string;
}

function getDefaultData(): SafetyAnalyticsData {
  return {
    routesSearched: 0,
    sheltersFound: [],
    emergencyActivations: 0,
    lastActivity: new Date().toISOString(),
  };
}

function loadData(): SafetyAnalyticsData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultData();
    const parsed = JSON.parse(raw) as SafetyAnalyticsData;
    // Basic validation
    if (typeof parsed.routesSearched !== 'number') return getDefaultData();
    return parsed;
  } catch {
    return getDefaultData();
  }
}

function saveData(data: SafetyAnalyticsData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

export function trackRouteSearch(shelterCount: number): void {
  const data = loadData();
  data.routesSearched += 1;
  data.sheltersFound.push(shelterCount);
  // Keep only last 20 entries
  if (data.sheltersFound.length > 20) {
    data.sheltersFound = data.sheltersFound.slice(-20);
  }
  data.lastActivity = new Date().toISOString();
  saveData(data);
}

export function trackEmergency(): void {
  const data = loadData();
  data.emergencyActivations += 1;
  data.lastActivity = new Date().toISOString();
  saveData(data);
}

export interface SafetyAnalytics {
  totalRoutes: number;
  averageSheltersPerRoute: number;
  totalEmergencies: number;
  lastActivity: string | null;
  recentShelterCounts: number[];
}

export function getAnalytics(): SafetyAnalytics {
  const data = loadData();
  const recent = data.sheltersFound.slice(-5);
  const avg =
    data.sheltersFound.length > 0
      ? Math.round(
          (data.sheltersFound.reduce((a, b) => a + b, 0) / data.sheltersFound.length) * 10
        ) / 10
      : 0;

  return {
    totalRoutes: data.routesSearched,
    averageSheltersPerRoute: avg,
    totalEmergencies: data.emergencyActivations,
    lastActivity: data.lastActivity || null,
    recentShelterCounts: recent,
  };
}

export function resetAnalytics(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}

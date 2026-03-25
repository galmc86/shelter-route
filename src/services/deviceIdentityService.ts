const STORAGE_KEY = 'shelter-route:device-id';

function generateDeviceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `device-${Math.random().toString(36).slice(2, 12)}`;
}

export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) {
      return existing;
    }

    const nextId = generateDeviceId();
    localStorage.setItem(STORAGE_KEY, nextId);
    return nextId;
  } catch {
    return generateDeviceId();
  }
}


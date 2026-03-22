// Local notification service for Shelter Route
// Uses the browser Notification API (no push server needed)

const NOTIFICATION_PREF_KEY = 'shelter-route:notifications-enabled';

/**
 * Check if the Notification API is available in the current browser.
 */
export function isNotificationSupported(): boolean {
  return 'Notification' in window;
}

/**
 * Request notification permission from the user.
 * Returns true if permission is granted, false otherwise.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) {
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission === 'denied') {
    return false;
  }

  const result = await Notification.requestPermission();
  return result === 'granted';
}

/**
 * Show a local notification using the browser Notification API.
 * Falls back to service worker notification if available.
 */
export async function showLocalNotification(
  title: string,
  body: string,
  tag?: string
): Promise<void> {
  if (!isNotificationSupported()) {
    return;
  }

  if (Notification.permission !== 'granted') {
    return;
  }

  // Check if notifications are enabled in user preferences
  if (!getNotificationPreference()) {
    return;
  }

  const options: NotificationOptions = {
    body,
    icon: '/icons/icon-192.svg',
    badge: '/icons/icon-192.svg',
    tag: tag || 'shelter-route-alert',
    requireInteraction: true,
    silent: false,
  };

  // Try using the service worker for notification (works when tab is in background)
  try {
    const registration = await navigator.serviceWorker?.ready;
    if (registration) {
      await registration.showNotification(title, options);
      return;
    }
  } catch {
    // Fall back to direct Notification API
  }

  // Direct Notification API fallback
  new Notification(title, options);
}

/**
 * Get the user's notification preference from localStorage.
 * Defaults to true (enabled).
 */
export function getNotificationPreference(): boolean {
  const stored = localStorage.getItem(NOTIFICATION_PREF_KEY);
  if (stored === null) {
    return true; // Default: enabled
  }
  return stored === 'true';
}

/**
 * Set the user's notification preference in localStorage.
 */
export function setNotificationPreference(enabled: boolean): void {
  localStorage.setItem(NOTIFICATION_PREF_KEY, String(enabled));
}

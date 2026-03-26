import { resilientFetch } from './fetchClient';
import {
  encodeFamilyRemotePushSubscriptionRequest,
  getFamilyRemotePushPublicKeyEndpoint,
  getFamilyRemotePushSubscriptionRegisterEndpoint,
  getFamilyRemotePushSubscriptionUnregisterEndpoint,
} from './familyRemoteHttpContract';
import { getFamilyRemoteSession } from './familyRemoteSessionService';

const FAMILY_PUSH_GROUP_KEY = 'shelter-route:family-push-group';
const FAMILY_PUSH_ENDPOINT_KEY = 'shelter-route:family-push-endpoint';

interface FamilyPushPublicKeyResponse {
  enabled: boolean;
  publicKey: string | null;
}

let cachedPublicKey: string | null | undefined;

export function isFamilyPushSupported(): boolean {
  return (
    typeof window !== 'undefined'
    && 'Notification' in window
    && 'serviceWorker' in navigator
    && 'PushManager' in window
  );
}

export function isFamilyPushRegisteredForGroup(groupCode: string | null | undefined): boolean {
  if (!groupCode) {
    return false;
  }

  return localStorage.getItem(FAMILY_PUSH_GROUP_KEY) === groupCode.toUpperCase();
}

export async function syncFamilyPushSubscription(groupCode: string): Promise<boolean> {
  if (!isFamilyPushSupported()) {
    clearFamilyPushRegistrationState();
    return false;
  }

  if (Notification.permission !== 'granted') {
    clearFamilyPushRegistrationState();
    return false;
  }

  const publicKey = await getFamilyPushPublicKey();
  if (!publicKey) {
    clearFamilyPushRegistrationState();
    return false;
  }

  let subscription: PushSubscription;
  try {
    const registration = await navigator.serviceWorker.ready;
    const existingSubscription = await registration.pushManager.getSubscription();
    subscription = existingSubscription ?? await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToArrayBuffer(publicKey),
    });
  } catch {
    clearFamilyPushRegistrationState(groupCode);
    return false;
  }

  const endpoint = getFamilyRemotePushSubscriptionRegisterEndpoint(groupCode);
  if (!endpoint) {
    clearFamilyPushRegistrationState();
    return false;
  }

  const session = getFamilyRemoteSession();
  const result = await resilientFetch<{ registered: boolean }>(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Family-Device-Id': session.deviceId,
      ...(session.userId ? { 'X-Family-User-Id': session.userId } : {}),
      'X-Family-Auth-State': session.authState,
    },
    body: JSON.stringify({
      subscription: encodeFamilyRemotePushSubscriptionRequest(subscription),
    }),
  }, {
    retries: 1,
    retryDelay: 500,
  });

  if (!result.ok) {
    clearFamilyPushRegistrationState(groupCode);
    return false;
  }

  localStorage.setItem(FAMILY_PUSH_GROUP_KEY, groupCode.toUpperCase());
  localStorage.setItem(FAMILY_PUSH_ENDPOINT_KEY, subscription.endpoint);
  return true;
}

export async function unregisterFamilyPushSubscription(groupCode: string): Promise<void> {
  const storedEndpoint = localStorage.getItem(FAMILY_PUSH_ENDPOINT_KEY);
  clearFamilyPushRegistrationState(groupCode);

  if (!isFamilyPushSupported()) {
    return;
  }

  const endpoint = getFamilyRemotePushSubscriptionUnregisterEndpoint(groupCode);
  if (!endpoint) {
    return;
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  const subscriptionEndpoint = subscription?.endpoint ?? storedEndpoint;
  if (!subscriptionEndpoint) {
    return;
  }

  const session = getFamilyRemoteSession();
  await resilientFetch<{ unregistered: boolean }>(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Family-Device-Id': session.deviceId,
      ...(session.userId ? { 'X-Family-User-Id': session.userId } : {}),
      'X-Family-Auth-State': session.authState,
    },
    body: JSON.stringify({ endpoint: subscriptionEndpoint }),
  }, {
    retries: 0,
  });
}

function clearFamilyPushRegistrationState(expectedGroupCode?: string): void {
  if (expectedGroupCode) {
    const normalized = expectedGroupCode.toUpperCase();
    if (localStorage.getItem(FAMILY_PUSH_GROUP_KEY) !== normalized) {
      return;
    }
  }

  localStorage.removeItem(FAMILY_PUSH_GROUP_KEY);
  localStorage.removeItem(FAMILY_PUSH_ENDPOINT_KEY);
}

async function getFamilyPushPublicKey(): Promise<string | null> {
  if (cachedPublicKey !== undefined) {
    return cachedPublicKey;
  }

  const endpoint = getFamilyRemotePushPublicKeyEndpoint();
  if (!endpoint) {
    cachedPublicKey = null;
    return null;
  }

  const result = await resilientFetch<FamilyPushPublicKeyResponse>(endpoint, undefined, {
    retries: 1,
    retryDelay: 500,
  });

  if (!result.ok || !result.data.enabled || !result.data.publicKey) {
    cachedPublicKey = null;
    return null;
  }

  cachedPublicKey = result.data.publicKey;
  return cachedPublicKey;
}

function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const normalized = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(normalized);
  return Uint8Array.from(rawData, (char) => char.charCodeAt(0)).buffer;
}

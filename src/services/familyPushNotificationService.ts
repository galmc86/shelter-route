import { resilientFetch } from './fetchClient';
import {
  encodeFamilyRemotePushSubscriptionRequest,
  getFamilyRemotePushPublicKeyEndpoint,
  getFamilyRemotePushSubscriptionRegisterEndpoint,
  getFamilyRemotePushSubscriptionUnregisterEndpoint,
} from './familyRemoteHttpContract';
import { getFamilyRemoteSession } from './familyRemoteSessionService';
import {
  patchFamilyPushStatus,
  type FamilyPushEnvironmentHint,
  type FamilyPushPermissionState,
} from './familyPushStatusService';

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

export function getFamilyPushPermissionState(): FamilyPushPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }

  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }

  return 'default';
}

export function getFamilyPushEnvironmentHint(): FamilyPushEnvironmentHint {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'none';
  }

  const userAgent = navigator.userAgent || '';
  const isAppleMobile = /iPhone|iPad|iPod/i.test(userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  if (!isAppleMobile) {
    return 'none';
  }

  const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

  return isStandalone ? 'none' : 'ios_home_screen_required';
}

export function isFamilyPushRegisteredForGroup(groupCode: string | null | undefined): boolean {
  if (!groupCode) {
    return false;
  }

  return localStorage.getItem(FAMILY_PUSH_GROUP_KEY) === groupCode.toUpperCase();
}

export async function syncFamilyPushSubscription(groupCode: string): Promise<boolean> {
  const attemptedAt = new Date().toISOString();
  const environmentHint = getFamilyPushEnvironmentHint();
  const permission = getFamilyPushPermissionState();

  patchFamilyPushStatus({
    permission,
    environmentHint,
    lastAttemptAt: attemptedAt,
  });

  if (environmentHint === 'ios_home_screen_required') {
    patchFamilyPushStatus({
      permission,
      environmentHint,
      state: 'needs_user_action',
      registeredGroupCode: null,
      lastFailureAt: attemptedAt,
      lastError: 'ios_home_screen_required',
    });
    clearFamilyPushRegistrationState(groupCode);
    return false;
  }

  if (!isFamilyPushSupported()) {
    patchFamilyPushStatus({
      permission,
      environmentHint,
      state: 'unsupported',
      registeredGroupCode: null,
      lastFailureAt: attemptedAt,
      lastError: 'unsupported',
    });
    clearFamilyPushRegistrationState();
    return false;
  }

  if (Notification.permission !== 'granted') {
    patchFamilyPushStatus({
      permission,
      environmentHint,
      state: 'needs_user_action',
      registeredGroupCode: null,
      lastFailureAt: attemptedAt,
      lastError: Notification.permission === 'denied' ? 'permission_denied' : null,
    });
    clearFamilyPushRegistrationState();
    return false;
  }

  const publicKey = await getFamilyPushPublicKey();
  if (!publicKey) {
    patchFamilyPushStatus({
      permission,
      environmentHint,
      state: 'error',
      registeredGroupCode: null,
      lastFailureAt: attemptedAt,
      lastError: 'push_public_key_unavailable',
    });
    clearFamilyPushRegistrationState();
    return false;
  }

  let subscription: PushSubscription;
  try {
    const registration = await navigator.serviceWorker.ready;
    const existingSubscription = await registration.pushManager.getSubscription();
    subscription = existingSubscription ?? await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });
  } catch {
    patchFamilyPushStatus({
      permission,
      environmentHint,
      state: 'error',
      registeredGroupCode: null,
      lastFailureAt: attemptedAt,
      lastError: 'push_subscribe_failed',
    });
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
    patchFamilyPushStatus({
      permission,
      environmentHint,
      state: 'error',
      registeredGroupCode: null,
      lastFailureAt: attemptedAt,
      lastError: result.error.message,
    });
    clearFamilyPushRegistrationState(groupCode);
    return false;
  }

  localStorage.setItem(FAMILY_PUSH_GROUP_KEY, groupCode.toUpperCase());
  localStorage.setItem(FAMILY_PUSH_ENDPOINT_KEY, subscription.endpoint);
  patchFamilyPushStatus({
    permission,
    environmentHint,
    state: 'active',
    registeredGroupCode: groupCode.toUpperCase(),
    lastSuccessAt: attemptedAt,
    lastError: null,
  });
  return true;
}

export async function unregisterFamilyPushSubscription(groupCode: string): Promise<void> {
  const storedEndpoint = localStorage.getItem(FAMILY_PUSH_ENDPOINT_KEY);
  clearFamilyPushRegistrationState(groupCode);
  patchFamilyPushStatus({
    registeredGroupCode: null,
    state: 'idle',
    lastError: null,
  });

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

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const normalized = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(normalized);
  const bytes = new Uint8Array(rawData.length);
  for (let index = 0; index < rawData.length; index += 1) {
    bytes[index] = rawData.charCodeAt(index);
  }
  return bytes;
}

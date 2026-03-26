import webpush from 'web-push';

export interface WebPushEnvLike {
  WEB_PUSH_PUBLIC_KEY?: string;
  WEB_PUSH_PRIVATE_KEY?: string;
  WEB_PUSH_SUBJECT?: string;
}

export interface FamilyPushSubscriptionRecord {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
  deviceId?: string;
  userId?: string;
  authState: 'anonymous' | 'authenticated';
  createdAt: string;
  updatedAt: string;
}

export interface FamilyPushPayload {
  title: string;
  body: string;
  tag: string;
  url?: string;
}

export interface FamilyPushSendResult {
  staleEndpoints: string[];
}

export function isFamilyPushEnabled(env: WebPushEnvLike): boolean {
  return Boolean(env.WEB_PUSH_PUBLIC_KEY && env.WEB_PUSH_PRIVATE_KEY);
}

export async function sendFamilyPushNotification(
  subscription: FamilyPushSubscriptionRecord,
  payload: FamilyPushPayload,
  env: WebPushEnvLike
): Promise<'sent' | 'stale' | 'failed' | 'disabled'> {
  if (!isFamilyPushEnabled(env)) {
    return 'disabled';
  }

  webpush.setVapidDetails(
    env.WEB_PUSH_SUBJECT || 'mailto:alerts@shelter-route.pages.dev',
    env.WEB_PUSH_PUBLIC_KEY!,
    env.WEB_PUSH_PRIVATE_KEY!
  );

  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload), {
      TTL: 60,
      urgency: 'high',
    });
    return 'sent';
  } catch (error) {
    const statusCode = typeof error === 'object' && error && 'statusCode' in error
      ? Number((error as { statusCode?: unknown }).statusCode)
      : null;

    if (statusCode === 404 || statusCode === 410) {
      return 'stale';
    }

    return 'failed';
  }
}

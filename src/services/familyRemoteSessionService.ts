import { getDeviceId } from './deviceIdentityService';

export interface FamilyRemoteSession {
  deviceId: string;
  userId: string | null;
  authState: 'anonymous' | 'authenticated';
}

export function getFamilyRemoteSession(): FamilyRemoteSession {
  return {
    deviceId: getDeviceId(),
    userId: null,
    authState: 'anonymous',
  };
}


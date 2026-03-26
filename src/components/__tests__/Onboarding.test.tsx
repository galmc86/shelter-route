import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Onboarding } from '../Onboarding';

const mockRequestNotificationPermission = vi.fn();
const mockGetFamilyPushPermissionState = vi.fn();
const mockGetFamilyPushEnvironmentHint = vi.fn();
const mockIsFamilyPushSupported = vi.fn();

vi.mock('../../i18n', () => ({
  useLanguage: () => ({
    language: 'en',
    t: (key: string) => key,
  }),
}));

vi.mock('../../services/pushNotificationService', () => ({
  requestNotificationPermission: () => mockRequestNotificationPermission(),
}));

vi.mock('../../services/familyPushNotificationService', () => ({
  getFamilyPushEnvironmentHint: () => mockGetFamilyPushEnvironmentHint(),
  getFamilyPushPermissionState: () => mockGetFamilyPushPermissionState(),
  isFamilyPushSupported: () => mockIsFamilyPushSupported(),
}));

describe('Onboarding', () => {
  beforeEach(() => {
    mockRequestNotificationPermission.mockReset();
    mockGetFamilyPushPermissionState.mockReset();
    mockGetFamilyPushEnvironmentHint.mockReset();
    mockIsFamilyPushSupported.mockReset();
    mockRequestNotificationPermission.mockResolvedValue(true);
    mockGetFamilyPushPermissionState.mockReturnValue('default');
    mockGetFamilyPushEnvironmentHint.mockReturnValue('none');
    mockIsFamilyPushSupported.mockReturnValue(true);
  });

  it('includes a notifications step and requests permission from it', async () => {
    render(<Onboarding onComplete={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'onboarding.next' }));
    fireEvent.click(screen.getByRole('button', { name: 'onboarding.next' }));

    expect(screen.getByText('onboarding.notificationTitle')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'onboarding.grantNotifications' }));

    await waitFor(() => {
      expect(mockRequestNotificationPermission).toHaveBeenCalledTimes(1);
    });
  });

  it('shows the iPhone home-screen hint instead of a permission button when standalone mode is required', () => {
    mockGetFamilyPushEnvironmentHint.mockReturnValue('ios_home_screen_required');

    render(<Onboarding onComplete={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'onboarding.next' }));
    fireEvent.click(screen.getByRole('button', { name: 'onboarding.next' }));

    expect(screen.getByText('onboarding.notificationHomeScreenHint')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'onboarding.grantNotifications' })).not.toBeInTheDocument();
  });
});

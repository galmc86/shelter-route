import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FamilySafety } from '../FamilySafety';
import type { FamilyGroup } from '../../services/familySafetyService';

const mockUseFamilyGroupState = vi.fn();
const mockUseFamilySyncStatus = vi.fn();
const mockRequestNotificationPermission = vi.fn();

vi.mock('../../i18n', () => ({
  useLanguage: () => ({
    language: 'en',
    t: (key: string) => key,
  }),
}));

vi.mock('../../hooks/useFamilyGroupState', () => ({
  useFamilyGroupState: () => mockUseFamilyGroupState(),
}));

vi.mock('../../hooks/useFamilySyncStatus', () => ({
  useFamilySyncStatus: () => mockUseFamilySyncStatus(),
}));

vi.mock('../../services/pushNotificationService', () => ({
  requestNotificationPermission: () => mockRequestNotificationPermission(),
}));

describe('FamilySafety', () => {
  beforeEach(() => {
    mockUseFamilyGroupState.mockReset();
    mockUseFamilySyncStatus.mockReset();
    mockRequestNotificationPermission.mockReset();
    mockUseFamilyGroupState.mockReturnValue({
      group: null,
      currentMember: null,
      hasGroup: false,
      isCurrentMemberSafe: false,
      safeMembersCount: 0,
      waitingMembersCount: 0,
      shareLink: 'https://example.com',
      createFamilyGroup: vi.fn(),
      joinFamilyGroup: vi.fn(),
      markFamilySafe: vi.fn(),
      markNeedsCheckIn: vi.fn(),
      retryFamilySync: vi.fn(),
      leaveFamilyGroup: vi.fn(),
    });
    mockUseFamilySyncStatus.mockReturnValue({
      mode: 'local',
      status: {
        pendingCount: 0,
        lastAttemptAt: null,
        lastSuccessAt: null,
        lastFailureAt: null,
        lastError: null,
      },
    });
  });

  it('shows section content immediately in section presentation', () => {
    render(<FamilySafety presentation="section" />);

    expect(screen.getByPlaceholderText('family.namePlaceholder')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'family.title' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'family.mode.create' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('family.localNote')).toBeInTheDocument();
  });

  it('shows the hybrid setup note when cross-device sync is enabled', () => {
    mockUseFamilySyncStatus.mockReturnValue({
      mode: 'hybrid',
      status: {
        pendingCount: 0,
        lastAttemptAt: null,
        lastSuccessAt: null,
        lastFailureAt: null,
        lastError: null,
      },
    });

    render(<FamilySafety presentation="section" />);

    expect(screen.getByText('family.hybridNote')).toBeInTheDocument();
    expect(screen.queryByText('family.localNote')).not.toBeInTheDocument();
  });

  it('keeps accordion presentation collapsed by default', () => {
    render(<FamilySafety />);

    expect(screen.getByRole('button', { name: 'family.title' })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('family.namePlaceholder')).not.toBeInTheDocument();
  });

  it('prefills the join flow when a group code is present in the link', async () => {
    render(<FamilySafety presentation="section" initialGroupCode="ABC123" />);

    expect(await screen.findByRole('tab', { name: 'family.mode.join' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByPlaceholderText('family.codePlaceholder')).toHaveValue('ABC123');
    expect(screen.getByText('family.prefilledCodeHint')).toBeInTheDocument();
  });

  it('shows invite actions and summary when already inside a group', async () => {
    const existingGroup: FamilyGroup = {
      groupCode: 'ABC123',
      memberName: 'Dana',
      currentMemberId: '1',
      members: [
        { id: '1', name: 'Dana', isSafe: true },
        { id: '2', name: 'Noam', isSafe: false },
      ],
    };
    mockUseFamilyGroupState.mockReturnValue({
      group: existingGroup,
      currentMember: existingGroup.members[0],
      hasGroup: true,
      isCurrentMemberSafe: true,
      safeMembersCount: 1,
      waitingMembersCount: 1,
      shareLink: 'https://example.com/?familyGroup=ABC123',
      createFamilyGroup: vi.fn(),
      joinFamilyGroup: vi.fn(),
      markFamilySafe: vi.fn(),
      markNeedsCheckIn: vi.fn(),
      retryFamilySync: vi.fn(),
      leaveFamilyGroup: vi.fn(),
    });

    render(<FamilySafety presentation="section" />);

    expect(await screen.findByText('family.inviteTitle')).toBeInTheDocument();
    expect(screen.getByText('ABC123')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'family.shareWithFamily' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'family.copyCode' })).toBeInTheDocument();
    expect(screen.getByText('family.safeCount')).toBeInTheDocument();
    expect(screen.getByText('family.awaitingCount')).toBeInTheDocument();
    expect(screen.getByText('family.sync.localTitle')).toBeInTheDocument();
    expect(screen.getByText('family.sync.localBody')).toBeInTheDocument();
  });

  it('shows a pending sync state when hybrid updates are queued', async () => {
    const existingGroup: FamilyGroup = {
      groupCode: 'ABC123',
      memberName: 'Dana',
      currentMemberId: '1',
      members: [
        { id: '1', name: 'Dana', isSafe: true },
      ],
    };
    mockUseFamilyGroupState.mockReturnValue({
      group: existingGroup,
      currentMember: existingGroup.members[0],
      hasGroup: true,
      isCurrentMemberSafe: true,
      safeMembersCount: 1,
      waitingMembersCount: 0,
      shareLink: 'https://example.com/?familyGroup=ABC123',
      createFamilyGroup: vi.fn(),
      joinFamilyGroup: vi.fn(),
      markFamilySafe: vi.fn(),
      markNeedsCheckIn: vi.fn(),
      retryFamilySync: vi.fn(),
      leaveFamilyGroup: vi.fn(),
    });
    mockUseFamilySyncStatus.mockReturnValue({
      mode: 'hybrid',
      status: {
        pendingCount: 2,
        lastAttemptAt: '2026-03-26T08:00:00.000Z',
        lastSuccessAt: null,
        lastFailureAt: null,
        lastError: null,
      },
    });

    render(<FamilySafety presentation="section" />);

    expect(await screen.findByText('family.sync.pendingTitle')).toBeInTheDocument();
    expect(screen.getByText('family.sync.pendingBody')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'family.sync.retry' })).toBeInTheDocument();
  });

  it('shows a paused sync state when hybrid sync is failing', async () => {
    const retryFamilySync = vi.fn();
    const existingGroup: FamilyGroup = {
      groupCode: 'ABC123',
      memberName: 'Dana',
      currentMemberId: '1',
      members: [
        { id: '1', name: 'Dana', isSafe: false },
      ],
    };
    mockUseFamilyGroupState.mockReturnValue({
      group: existingGroup,
      currentMember: existingGroup.members[0],
      hasGroup: true,
      isCurrentMemberSafe: false,
      safeMembersCount: 0,
      waitingMembersCount: 1,
      shareLink: 'https://example.com/?familyGroup=ABC123',
      createFamilyGroup: vi.fn(),
      joinFamilyGroup: vi.fn(),
      markFamilySafe: vi.fn(),
      markNeedsCheckIn: vi.fn(),
      retryFamilySync,
      leaveFamilyGroup: vi.fn(),
    });
    mockUseFamilySyncStatus.mockReturnValue({
      mode: 'hybrid',
      status: {
        pendingCount: 1,
        lastAttemptAt: '2026-03-26T08:00:00.000Z',
        lastSuccessAt: null,
        lastFailureAt: '2026-03-26T08:00:00.000Z',
        lastError: 'offline',
      },
    });

    render(<FamilySafety presentation="section" />);

    expect(await screen.findByText('family.sync.pausedTitle')).toBeInTheDocument();
    expect(screen.getByText('family.sync.pausedBody')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'family.sync.retry' }));
    expect(retryFamilySync).toHaveBeenCalledTimes(1);
  });

  it('requests notification permission after creating a group', () => {
    const createFamilyGroup = vi.fn(() => ({
      groupCode: 'ABC123',
      memberName: 'Dana',
      currentMemberId: '1',
      members: [{ id: '1', name: 'Dana', isSafe: false }],
    }));
    mockUseFamilyGroupState.mockReturnValue({
      group: null,
      currentMember: null,
      hasGroup: false,
      isCurrentMemberSafe: false,
      safeMembersCount: 0,
      waitingMembersCount: 0,
      shareLink: 'https://example.com',
      createFamilyGroup,
      joinFamilyGroup: vi.fn(),
      markFamilySafe: vi.fn(),
      markNeedsCheckIn: vi.fn(),
      retryFamilySync: vi.fn(),
      leaveFamilyGroup: vi.fn(),
    });

    render(<FamilySafety presentation="section" />);

    fireEvent.change(screen.getByPlaceholderText('family.namePlaceholder'), {
      target: { value: 'Dana' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'family.createGroup' }));

    expect(createFamilyGroup).toHaveBeenCalledWith('Dana');
    expect(mockRequestNotificationPermission).toHaveBeenCalledTimes(1);
  });

  it('requests notification permission after joining a group', () => {
    const joinFamilyGroup = vi.fn(() => ({
      groupCode: 'ABC123',
      memberName: 'Dana',
      currentMemberId: '1',
      members: [{ id: '1', name: 'Dana', isSafe: false }],
    }));
    mockUseFamilyGroupState.mockReturnValue({
      group: null,
      currentMember: null,
      hasGroup: false,
      isCurrentMemberSafe: false,
      safeMembersCount: 0,
      waitingMembersCount: 0,
      shareLink: 'https://example.com',
      createFamilyGroup: vi.fn(),
      joinFamilyGroup,
      markFamilySafe: vi.fn(),
      markNeedsCheckIn: vi.fn(),
      retryFamilySync: vi.fn(),
      leaveFamilyGroup: vi.fn(),
    });

    render(<FamilySafety presentation="section" />);

    fireEvent.click(screen.getByRole('tab', { name: 'family.mode.join' }));
    fireEvent.change(screen.getByPlaceholderText('family.namePlaceholder'), {
      target: { value: 'Dana' },
    });
    fireEvent.change(screen.getByPlaceholderText('family.codePlaceholder'), {
      target: { value: 'ABC123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'family.join' }));

    expect(joinFamilyGroup).toHaveBeenCalledWith('ABC123', 'Dana');
    expect(mockRequestNotificationPermission).toHaveBeenCalledTimes(1);
  });
});

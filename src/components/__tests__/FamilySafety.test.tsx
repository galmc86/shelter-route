import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FamilySafety } from '../FamilySafety';
import type { FamilyGroup } from '../../services/familySafetyService';

const mockGetGroup = vi.fn();

vi.mock('../../i18n', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../services/familySafetyService', () => ({
  getGroup: () => mockGetGroup(),
  createGroup: vi.fn(),
  joinGroup: vi.fn(),
  setImSafe: vi.fn(),
  leaveGroup: vi.fn(),
  getShareLink: vi.fn(() => 'https://example.com'),
  subscribeToFamilyGroupChanges: vi.fn(() => () => {}),
}));

describe('FamilySafety', () => {
  beforeEach(() => {
    mockGetGroup.mockReset();
    mockGetGroup.mockReturnValue(null);
  });

  it('shows section content immediately in section presentation', () => {
    render(<FamilySafety presentation="section" />);

    expect(screen.getByPlaceholderText('family.namePlaceholder')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'family.title' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'family.mode.create' })).toHaveAttribute('aria-selected', 'true');
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
      members: [
        { id: '1', name: 'Dana', isSafe: true },
        { id: '2', name: 'Noam', isSafe: false },
      ],
    };
    mockGetGroup.mockReturnValue(existingGroup);

    render(<FamilySafety presentation="section" />);

    expect(await screen.findByText('family.inviteTitle')).toBeInTheDocument();
    expect(screen.getByText('ABC123')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'family.shareWithFamily' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'family.copyCode' })).toBeInTheDocument();
    expect(screen.getByText('family.safeCount')).toBeInTheDocument();
    expect(screen.getByText('family.awaitingCount')).toBeInTheDocument();
  });
});

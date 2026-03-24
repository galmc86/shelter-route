import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FamilySafety } from '../FamilySafety';

vi.mock('../../i18n', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../services/familySafetyService', () => ({
  getGroup: () => null,
  createGroup: vi.fn(),
  joinGroup: vi.fn(),
  setImSafe: vi.fn(),
  leaveGroup: vi.fn(),
  getShareLink: vi.fn(() => 'https://example.com'),
}));

describe('FamilySafety', () => {
  it('shows section content immediately in section presentation', () => {
    render(<FamilySafety presentation="section" />);

    expect(screen.getByPlaceholderText('family.namePlaceholder')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'family.title' })).not.toBeInTheDocument();
  });

  it('keeps accordion presentation collapsed by default', () => {
    render(<FamilySafety />);

    expect(screen.getByRole('button', { name: 'family.title' })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('family.namePlaceholder')).not.toBeInTheDocument();
  });
});

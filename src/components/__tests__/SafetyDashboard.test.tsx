import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SafetyDashboard } from '../SafetyDashboard';

vi.mock('../../i18n', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../services/safetyAnalyticsService', () => ({
  getAnalytics: () => ({
    totalRoutes: 12,
    averageSheltersPerRoute: 3,
    totalEmergencies: 2,
    recentShelterCounts: [1, 2, 4],
  }),
}));

describe('SafetyDashboard', () => {
  it('shows analytics immediately in section presentation', () => {
    render(<SafetyDashboard presentation="section" />);

    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'dashboard.title' })).not.toBeInTheDocument();
  });

  it('keeps accordion presentation collapsed by default', () => {
    render(<SafetyDashboard />);

    expect(screen.getByRole('button', { name: 'dashboard.title' })).toBeInTheDocument();
    expect(screen.queryByText('12')).not.toBeInTheDocument();
  });
});

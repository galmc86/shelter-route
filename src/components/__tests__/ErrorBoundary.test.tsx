import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from '../ErrorBoundary';

// Mock reportError service
vi.mock('../../services/errorReportingService', () => ({
  reportError: vi.fn(),
}));

// Suppress console.error output during error boundary tests
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});

afterEach(() => {
  console.error = originalConsoleError;
});

function ProblemChild(): React.ReactElement {
  throw new Error('Test error');
}

function GoodChild(): React.ReactElement {
  return <div>Everything is fine</div>;
}

describe('ErrorBoundary', () => {
  it('renders children normally when no error occurs', () => {
    render(
      <ErrorBoundary>
        <GoodChild />
      </ErrorBoundary>
    );

    expect(screen.getByText('Everything is fine')).toBeInTheDocument();
  });

  it('shows fallback UI when a child throws an error', () => {
    render(
      <ErrorBoundary>
        <ProblemChild />
      </ErrorBoundary>
    );

    expect(screen.getByText('Shelter Route')).toBeInTheDocument();
    expect(
      screen.getByText(/An error occurred in the application/)
    ).toBeInTheDocument();
  });

  it('shows emergency phone numbers in fallback UI', () => {
    render(
      <ErrorBoundary>
        <ProblemChild />
      </ErrorBoundary>
    );

    // Check that emergency numbers are rendered
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('101')).toBeInTheDocument();
    expect(screen.getByText('102')).toBeInTheDocument();
    expect(screen.getByText('104')).toBeInTheDocument();

    // Check that the emergency section title is present
    expect(screen.getByText('Emergency Numbers')).toBeInTheDocument();
  });

  it('shows a Reload button in the fallback UI', () => {
    render(
      <ErrorBoundary>
        <ProblemChild />
      </ErrorBoundary>
    );

    expect(screen.getByText('Reload')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
  });
});

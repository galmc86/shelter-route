import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { reportError } from '../services/errorReportingService';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

const EMERGENCY_NUMBERS = [
  { number: '100', labelHe: '\u05DE\u05E9\u05D8\u05E8\u05D4', labelEn: 'Police' },
  { number: '101', labelHe: '\u05DE\u05D3"\u05D0 / \u05D0\u05DE\u05D1\u05D5\u05DC\u05E0\u05E1', labelEn: 'Ambulance / MDA' },
  { number: '102', labelHe: '\u05DB\u05D1\u05D0\u05D9 \u05D0\u05E9', labelEn: 'Fire' },
  { number: '104', labelHe: '\u05E4\u05D9\u05E7\u05D5\u05D3 \u05D4\u05E2\u05D5\u05E8\u05E3', labelEn: 'Home Front Command' },
];

function getIsHebrew(): boolean {
  const lang = document.documentElement.lang;
  if (lang && lang.startsWith('he')) return true;
  const dir = document.documentElement.dir || document.documentElement.getAttribute('dir');
  if (dir === 'rtl') return true;
  return false;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] Uncaught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
    reportError('render-error', error.message, errorInfo.componentStack ?? undefined);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const isHebrew = getIsHebrew();

    return (
      <div className="error-boundary" dir={isHebrew ? 'rtl' : 'ltr'}>
        <div className="error-boundary-content">
          <h1 className="error-boundary-title">Shelter Route</h1>
          <p className="error-boundary-message">
            {isHebrew
              ? '\u05D0\u05D9\u05E8\u05E2\u05D4 \u05E9\u05D2\u05D9\u05D0\u05D4 \u05D1\u05D0\u05E4\u05DC\u05D9\u05E7\u05E6\u05D9\u05D4. \u05D0\u05E0\u05D0 \u05E0\u05E1\u05D4 \u05DC\u05D8\u05E2\u05D5\u05DF \u05DE\u05D7\u05D3\u05E9.'
              : 'An error occurred in the application. Please try reloading.'}
          </p>

          <div className="error-boundary-emergency">
            <h2 className="error-boundary-emergency-title">
              {isHebrew ? '\u05DE\u05E1\u05E4\u05E8\u05D9 \u05D7\u05D9\u05E8\u05D5\u05DD' : 'Emergency Numbers'}
            </h2>
            <ul className="error-boundary-numbers">
              {EMERGENCY_NUMBERS.map(({ number, labelHe, labelEn }) => (
                <li key={number} className="error-boundary-number-item">
                  <a href={`tel:${number}`} className="error-boundary-number-link">
                    <span className="error-boundary-number">{number}</span>
                    <span className="error-boundary-label">
                      {isHebrew ? labelHe : labelEn}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <button
            className="error-boundary-reload"
            onClick={this.handleReload}
            type="button"
          >
            {isHebrew ? '\u05D8\u05E2\u05D9\u05E0\u05D4 \u05DE\u05D7\u05D3\u05E9' : 'Reload'}
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;

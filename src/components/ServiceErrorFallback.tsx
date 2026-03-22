import type { FC } from 'react';

interface ServiceErrorFallbackProps {
  error?: Error | null;
  onRetry?: () => void;
  message?: string;
}

export const ServiceErrorFallback: FC<ServiceErrorFallbackProps> = ({
  error,
  onRetry,
  message,
}) => (
  <div className="service-error-fallback" role="alert">
    <div className="service-error-icon">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="#E53935">
        <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
      </svg>
    </div>
    <p className="service-error-message">
      {message || error?.message || 'Something went wrong'}
    </p>
    {onRetry && (
      <button className="service-error-retry" onClick={onRetry}>
        Try again
      </button>
    )}
  </div>
);

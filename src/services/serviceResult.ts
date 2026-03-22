export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ServiceError };

export class ServiceError extends Error {
  readonly code: 'NETWORK' | 'TIMEOUT' | 'HTTP' | 'PARSE' | 'UNKNOWN';
  readonly statusCode?: number;
  readonly retryable: boolean;
  override readonly cause?: unknown;

  constructor(
    code: 'NETWORK' | 'TIMEOUT' | 'HTTP' | 'PARSE' | 'UNKNOWN',
    message: string,
    statusCode?: number,
    retryable: boolean = false,
    cause?: unknown
  ) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
    this.cause = cause;
  }
}

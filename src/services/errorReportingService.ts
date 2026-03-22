// Lightweight in-memory error reporting service
// Tracks the last 50 critical failures for debugging

export interface ErrorEntry {
  timestamp: string;
  category: string;
  message: string;
  details?: string;
}

const MAX_BUFFER_SIZE = 50;
const errorBuffer: ErrorEntry[] = [];

export function reportError(category: string, message: string, details?: string): void {
  const entry: ErrorEntry = {
    timestamp: new Date().toISOString(),
    category,
    message,
    ...(details !== undefined && { details }),
  };

  errorBuffer.push(entry);

  // FIFO: remove oldest entries when buffer exceeds max size
  while (errorBuffer.length > MAX_BUFFER_SIZE) {
    errorBuffer.shift();
  }

  console.error(`[${category}] ${message}${details ? ` — ${details}` : ''}`);
}

export function getErrorReport(): ErrorEntry[] {
  return [...errorBuffer];
}

export function clearErrors(): void {
  errorBuffer.length = 0;
}

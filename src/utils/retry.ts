import { RETRY_CONFIG } from "@/constants";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Check for rate limiting
    if (message.includes("429") || message.includes("rate limit") || message.includes("quota")) {
      return true;
    }

    // Check for server errors
    for (const code of RETRY_CONFIG.retryableStatusCodes) {
      if (message.includes(String(code))) {
        return true;
      }
    }

    // Check for network errors
    if (message.includes("network") || message.includes("fetch") || message.includes("timeout")) {
      return true;
    }
  }

  return false;
}

export interface RetryOptions {
  maxRetries?: number | undefined;
  baseDelayMs?: number | undefined;
  maxDelayMs?: number | undefined;
  onRetry?: ((attempt: number, error: Error) => void) | undefined;
  signal?: AbortSignal | undefined;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = RETRY_CONFIG.maxRetries,
    baseDelayMs = RETRY_CONFIG.baseDelayMs,
    maxDelayMs = RETRY_CONFIG.maxDelayMs,
    onRetry,
    signal,
  } = options;

  let lastError: Error = new Error("Unknown error");

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Check if aborted
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry if not retryable or if it's the last attempt
      if (!isRetryableError(error) || attempt === maxRetries) {
        throw lastError;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        baseDelayMs * Math.pow(2, attempt),
        maxDelayMs
      );

      onRetry?.(attempt + 1, lastError);

      await sleep(delay);
    }
  }

  throw lastError;
}

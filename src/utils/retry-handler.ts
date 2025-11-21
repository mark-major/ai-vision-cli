/**
 * Advanced Retry Handler with Exponential Backoff
 *
 * Provides enterprise-grade retry logic with configurable policies,
 * jitter, and comprehensive error handling.
 */

import { randomInt } from 'crypto';

export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Base delay in milliseconds */
  baseDelay: number;
  /** Maximum delay in milliseconds */
  maxDelay: number;
  /** Multiplier for exponential backoff */
  backoffMultiplier: number;
  /** Whether to add jitter to prevent thundering herd */
  jitter: boolean;
  /** Error types that are retryable */
  retryableErrors: string[];
  /** HTTP status codes that are retryable */
  retryableStatusCodes?: number[];
  /** Whether to retry on network errors */
  retryOnNetworkErrors: boolean;
  /** Callback for each retry attempt */
  onRetry?: (attempt: number, error: Error, delay: number) => void;
}

export interface RetryResult<T> {
  /** Result of the operation */
  result: T;
  /** Number of attempts made */
  attempts: number;
  /** Total time spent in milliseconds */
  totalTime: number;
  /** Whether retries were used */
  retried: boolean;
}

export interface RetryError extends Error {
  /** Number of attempts made */
  attempts: number;
  /** Array of all errors encountered */
  errors: Error[];
  /** Total time spent retrying */
  totalTime: number;
}

/**
 * Default retry configuration for most operations
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: true,
  retryableErrors: [
    'ECONNRESET',
    'ENOTFOUND',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'NETWORK_ERROR',
    'PROVIDER_ERROR',
    'RATE_LIMIT_ERROR',
    'QUOTA_EXCEEDED_ERROR',
    'TEMPORARY_FAILURE',
  ],
  retryableStatusCodes: [429, 500, 502, 503, 504],
  retryOnNetworkErrors: true,
};

/**
 * Default retry configuration for critical operations
 */
export const CRITICAL_RETRY_CONFIG: RetryConfig = {
  ...DEFAULT_RETRY_CONFIG,
  maxAttempts: 5,
  baseDelay: 2000,
  maxDelay: 60000,
};

/**
 * Default retry configuration for non-critical operations
 */
export const NON_CRITICAL_RETRY_CONFIG: RetryConfig = {
  ...DEFAULT_RETRY_CONFIG,
  maxAttempts: 2,
  baseDelay: 500,
  maxDelay: 5000,
};

/**
 * Advanced retry handler with exponential backoff and jitter
 */
export class RetryHandler {
  private config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  /**
   * Execute an operation with retry logic
   */
  async execute<T>(operation: () => Promise<T>): Promise<RetryResult<T>> {
    const startTime = Date.now();
    let lastError: Error | null = null;
    const errors: Error[] = [];

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        const result = await operation();
        const totalTime = Date.now() - startTime;

        return {
          result,
          attempts: attempt,
          totalTime,
          retried: attempt > 1,
        };
      } catch (error) {
        const err = error as Error;
        errors.push(err);
        lastError = err;

        // Don't retry on the last attempt
        if (attempt === this.config.maxAttempts) {
          break;
        }

        // Check if error is retryable
        if (!this.isRetryableError(err)) {
          break;
        }

        // Calculate delay and wait
        const delay = this.calculateDelay(attempt);

        // Call retry callback if provided
        if (this.config.onRetry) {
          this.config.onRetry(attempt, err, delay);
        }

        await this.delay(delay);
      }
    }

    const totalTime = Date.now() - startTime;
    const retryError: RetryError = new Error(
      `Operation failed after ${this.config.maxAttempts} attempts: ${lastError?.message}`
    ) as RetryError;

    retryError.attempts = Math.min(this.config.maxAttempts, errors.length);
    retryError.errors = errors;
    retryError.totalTime = totalTime;
    retryError.stack = lastError?.stack;

    throw retryError;
  }

  /**
   * Execute an operation with a specific retry configuration
   */
  async executeWithConfig<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig>
  ): Promise<RetryResult<T>> {
    const handler = new RetryHandler({ ...this.config, ...config });
    return handler.execute(operation);
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: Error): boolean {
    // Check retryable error types
    if (this.config.retryableErrors.includes(error.name)) {
      return true;
    }

    // Check for retryable error messages
    const message = error.message.toLowerCase();
    const retryablePatterns = [
      'network error',
      'timeout',
      'connection reset',
      'connection refused',
      'temporary failure',
      'rate limit',
      'quota exceeded',
      'service unavailable',
      'internal server error',
      'bad gateway',
    ];

    if (retryablePatterns.some(pattern => message.includes(pattern))) {
      return true;
    }

    // Check HTTP status codes for HTTP errors
    const httpMatch = error.message.match(/status (\d{3})/);
    if (httpMatch && this.config.retryableStatusCodes) {
      const statusCode = parseInt(httpMatch[1]);
      return this.config.retryableStatusCodes.includes(statusCode);
    }

    // Check for network errors
    if (this.config.retryOnNetworkErrors && this.isNetworkError(error)) {
      return true;
    }

    return false;
  }

  /**
   * Check if an error is a network error
   */
  private isNetworkError(error: Error): boolean {
    const networkErrorCodes = [
      'ECONNRESET',
      'ENOTFOUND',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENETUNREACH',
      'EHOSTUNREACH',
    ];

    return networkErrorCodes.some(code => error.message.includes(code));
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  private calculateDelay(attempt: number): number {
    let delay = this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt - 1);
    delay = Math.min(delay, this.config.maxDelay);

    // Add jitter to prevent thundering herd
    if (this.config.jitter) {
      const jitterRange = delay * 0.1; // 10% jitter
      delay += randomInt(0, Math.floor(jitterRange));
    }

    return Math.floor(delay);
  }

  /**
   * Delay execution for specified milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current configuration
   */
  getConfig(): RetryConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RetryConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Create a child retry handler with modified configuration
   */
  withConfig(config: Partial<RetryConfig>): RetryHandler {
    return new RetryHandler({ ...this.config, ...config });
  }
}

/**
 * Convenience function to execute an operation with retry
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config?: Partial<RetryConfig>
): Promise<RetryResult<T>> {
  const handler = new RetryHandler(config);
  return handler.execute(operation);
}

/**
 * Convenience function to execute a critical operation with retry
 */
export async function withRetryCritical<T>(
  operation: () => Promise<T>,
  config?: Partial<RetryConfig>
): Promise<RetryResult<T>> {
  const handler = new RetryHandler({ ...CRITICAL_RETRY_CONFIG, ...config });
  return handler.execute(operation);
}

/**
 * Convenience function to execute a non-critical operation with retry
 */
export async function withRetryNonCritical<T>(
  operation: () => Promise<T>,
  config?: Partial<RetryConfig>
): Promise<RetryResult<T>> {
  const handler = new RetryHandler({ ...NON_CRITICAL_RETRY_CONFIG, ...config });
  return handler.execute(operation);
}
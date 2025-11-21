/**
 * Rate Limiting and Quota Management System
 *
 * Provides token bucket rate limiting, quota tracking, and dynamic
 * adjustment capabilities for AI API providers.
 */

export interface RateLimitConfig {
  /** Maximum requests per second */
  requestsPerSecond: number;
  /** Maximum burst size (token bucket capacity) */
  burstSize: number;
  /** Daily quota if applicable */
  quotaPerDay?: number;
  /** Whether to apply exponential backoff when rate limited */
  backoffOnLimit: boolean;
  /** Maximum backoff delay in milliseconds */
  maxBackoffDelay: number;
  /** Whether to automatically adjust limits based on responses */
  enableAdaptiveLimiting: boolean;
}

export interface RateLimitStatus {
  /** Current tokens available */
  tokens: number;
  /** Maximum token capacity */
  capacity: number;
  /** Last refill timestamp */
  lastRefill: Date;
  /** Requests made in current period */
  requestsInPeriod: number;
  /** Quota remaining for today */
  quotaRemaining?: number;
  /** Rate limit reset time */
  resetTime?: Date;
  /** Whether currently rate limited */
  isLimited: boolean;
  /** Estimated time until next request is allowed */
  nextRequestTime?: Date;
}

export interface RateLimitResult {
  /** Whether request is allowed */
  allowed: boolean;
  /** Tokens remaining after this request */
  tokensRemaining: number;
  /** Estimated wait time in milliseconds if not allowed */
  waitTime: number;
  /** Rate limit status */
  status: RateLimitStatus;
}

export interface QuotaStatus {
  /** Daily quota limit */
  dailyLimit: number;
  /** Quota used today */
  usedToday: number;
  /** Quota remaining */
  remaining: number;
  /** Quota reset time (start of next day) */
  resetTime: Date;
  /** Usage percentage */
  usagePercentage: number;
}

/**
 * Default rate limit configuration
 */
export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  requestsPerSecond: 10,
  burstSize: 20,
  quotaPerDay: 1000,
  backoffOnLimit: true,
  maxBackoffDelay: 60000, // 1 minute
  enableAdaptiveLimiting: true,
};

/**
 * Token Bucket Rate Limiter
 */
export class TokenBucketRateLimiter {
  private config: RateLimitConfig;
  private tokens: number;
  private lastRefill: Date;
  private requestsInPeriod: number;
  private quotaUsedToday: number;
  private quotaResetTime: Date;
  private isLimited = false;
  private backoffEndTime: Date | null = null;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_RATE_LIMIT_CONFIG, ...config };
    this.tokens = this.config.burstSize;
    this.lastRefill = new Date();
    this.requestsInPeriod = 0;
    this.quotaUsedToday = 0;
    this.quotaResetTime = this.calculateQuotaResetTime();
  }

  /**
   * Check if a request is allowed and consume a token if it is
   */
  async checkLimit(): Promise<RateLimitResult> {
    this.refillTokens();

    // Check if we're in backoff period
    if (this.backoffEndTime && new Date() < this.backoffEndTime) {
      const waitTime = this.backoffEndTime.getTime() - Date.now();
      return {
        allowed: false,
        tokensRemaining: this.tokens,
        waitTime,
        status: this.getStatus(),
      };
    }

    // Check daily quota
    if (this.config.quotaPerDay && this.quotaUsedToday >= this.config.quotaPerDay) {
      return {
        allowed: false,
        tokensRemaining: this.tokens,
        waitTime: this.quotaResetTime.getTime() - Date.now(),
        status: this.getStatus(),
      };
    }

    // Check token availability
    if (this.tokens < 1) {
      const waitTime = Math.ceil((1 - this.tokens) * 1000 / this.config.requestsPerSecond);
      return {
        allowed: false,
        tokensRemaining: this.tokens,
        waitTime,
        status: this.getStatus(),
      };
    }

    // Allow request and consume token
    this.tokens--;
    this.requestsInPeriod++;
    this.quotaUsedToday++;

    return {
      allowed: true,
      tokensRemaining: this.tokens,
      waitTime: 0,
      status: this.getStatus(),
    };
  }

  /**
   * Wait until a request is allowed
   */
  async waitForSlot(): Promise<RateLimitResult> {
    let result = await this.checkLimit();
    while (!result.allowed) {
      if (result.waitTime > 0) {
        await this.delay(Math.min(result.waitTime, 1000));
      }
      result = await this.checkLimit();
    }
    return result;
  }

  /**
   * Apply rate limit penalty (when receiving 429 or similar)
   */
  applyPenalty(response?: RateLimitResponse): void {
    this.isLimited = true;

    if (this.config.backoffOnLimit) {
      // Calculate backoff duration
      let backoffDuration = 1000; // Start with 1 second

      if (response?.retryAfter) {
        backoffDuration = response.retryAfter * 1000;
      } else {
        // Exponential backoff
        backoffDuration = Math.min(
          backoffDuration * Math.pow(2, this.requestsInPeriod),
          this.config.maxBackoffDelay
        );
      }

      this.backoffEndTime = new Date(Date.now() + backoffDuration);
    }

    // Drain some tokens as penalty
    this.tokens = Math.max(0, this.tokens - Math.min(5, this.tokens));
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...config };

    // Adjust burst size if needed
    if (this.tokens > this.config.burstSize) {
      this.tokens = this.config.burstSize;
    }
  }

  /**
   * Get current rate limit status
   */
  getStatus(): RateLimitStatus {
    const nextRequestTime = this.tokens < 1
      ? new Date(Date.now() + ((1 - this.tokens) * 1000) / this.config.requestsPerSecond)
      : undefined;

    return {
      tokens: this.tokens,
      capacity: this.config.burstSize,
      lastRefill: this.lastRefill,
      requestsInPeriod: this.requestsInPeriod,
      quotaRemaining: this.config.quotaPerDay
        ? this.config.quotaPerDay - this.quotaUsedToday
        : undefined,
      resetTime: this.config.quotaPerDay ? this.quotaResetTime : undefined,
      isLimited: this.isLimited || (this.backoffEndTime ? new Date() < this.backoffEndTime : false),
      nextRequestTime,
    };
  }

  /**
   * Get quota status
   */
  getQuotaStatus(): QuotaStatus | undefined {
    if (!this.config.quotaPerDay) {
      return undefined;
    }

    const remaining = this.config.quotaPerDay - this.quotaUsedToday;
    const usagePercentage = (this.quotaUsedToday / this.config.quotaPerDay) * 100;

    return {
      dailyLimit: this.config.quotaPerDay,
      usedToday: this.quotaUsedToday,
      remaining,
      resetTime: this.quotaResetTime,
      usagePercentage,
    };
  }

  /**
   * Reset the rate limiter (for testing or manual reset)
   */
  reset(): void {
    this.tokens = this.config.burstSize;
    this.lastRefill = new Date();
    this.requestsInPeriod = 0;
    this.isLimited = false;
    this.backoffEndTime = null;
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refillTokens(): void {
    const now = new Date();
    const timeDiff = (now.getTime() - this.lastRefill.getTime()) / 1000; // in seconds

    if (timeDiff > 0) {
      const tokensToAdd = timeDiff * this.config.requestsPerSecond;
      this.tokens = Math.min(this.config.burstSize, this.tokens + tokensToAdd);
      this.lastRefill = now;

      // Reset rate limit status if enough time has passed
      if (timeDiff > 5) { // 5 seconds of normal operation
        this.isLimited = false;
        this.backoffEndTime = null;
      }
    }

    // Reset daily quota if needed
    if (now >= this.quotaResetTime) {
      this.quotaUsedToday = 0;
      this.quotaResetTime = this.calculateQuotaResetTime();
    }
  }

  /**
   * Calculate quota reset time (start of next day)
   */
  private calculateQuotaResetTime(): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  }

  /**
   * Delay for specified milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Multi-Provider Rate Limiter
 */
export class MultiProviderRateLimiter {
  private limiters: Map<string, TokenBucketRateLimiter> = new Map();
  private configs: Map<string, RateLimitConfig> = new Map();

  /**
   * Add a provider with rate limiting
   */
  addProvider(providerName: string, config: Partial<RateLimitConfig> = {}): void {
    const finalConfig: RateLimitConfig = {
      requestsPerSecond: config.requestsPerSecond ?? DEFAULT_RATE_LIMIT_CONFIG.requestsPerSecond,
      burstSize: config.burstSize ?? DEFAULT_RATE_LIMIT_CONFIG.burstSize,
      quotaPerDay: config.quotaPerDay ?? DEFAULT_RATE_LIMIT_CONFIG.quotaPerDay,
      backoffOnLimit: config.backoffOnLimit ?? DEFAULT_RATE_LIMIT_CONFIG.backoffOnLimit,
      maxBackoffDelay: config.maxBackoffDelay ?? DEFAULT_RATE_LIMIT_CONFIG.maxBackoffDelay,
      enableAdaptiveLimiting: config.enableAdaptiveLimiting ?? DEFAULT_RATE_LIMIT_CONFIG.enableAdaptiveLimiting,
    };
    this.configs.set(providerName, finalConfig);
    this.limiters.set(providerName, new TokenBucketRateLimiter(finalConfig));
  }

  /**
   * Remove a provider
   */
  removeProvider(providerName: string): void {
    this.limiters.delete(providerName);
    this.configs.delete(providerName);
  }

  /**
   * Check if a request is allowed for a specific provider
   */
  async checkLimit(providerName: string): Promise<RateLimitResult> {
    const limiter = this.limiters.get(providerName);
    if (!limiter) {
      throw new Error(`Rate limiter for provider ${providerName} not found`);
    }

    return limiter.checkLimit();
  }

  /**
   * Wait for a request slot for a specific provider
   */
  async waitForSlot(providerName: string): Promise<RateLimitResult> {
    const limiter = this.limiters.get(providerName);
    if (!limiter) {
      throw new Error(`Rate limiter for provider ${providerName} not found`);
    }

    return limiter.waitForSlot();
  }

  /**
   * Apply penalty to a specific provider
   */
  applyPenalty(providerName: string, response?: RateLimitResponse): void {
    const limiter = this.limiters.get(providerName);
    if (limiter) {
      limiter.applyPenalty(response);
    }
  }

  /**
   * Get status for all providers
   */
  getAllStatus(): Map<string, RateLimitStatus> {
    const status = new Map<string, RateLimitStatus>();
    for (const [providerName, limiter] of this.limiters) {
      status.set(providerName, limiter.getStatus());
    }
    return status;
  }

  /**
   * Get quota status for all providers
   */
  getAllQuotaStatus(): Map<string, QuotaStatus> {
    const quotaStatus = new Map<string, QuotaStatus>();
    for (const [providerName, limiter] of this.limiters) {
      const status = limiter.getQuotaStatus();
      if (status) {
        quotaStatus.set(providerName, status);
      }
    }
    return quotaStatus;
  }

  /**
   * Get available provider (not rate limited)
   */
  getAvailableProvider(): string | null {
    for (const [providerName, limiter] of this.limiters) {
      const status = limiter.getStatus();
      if (!status.isLimited && status.tokens > 0) {
        const quotaStatus = limiter.getQuotaStatus();
        if (!quotaStatus || quotaStatus.remaining > 0) {
          return providerName;
        }
      }
    }
    return null;
  }

  /**
   * Get best provider (with most tokens available)
   */
  getBestProvider(): string | null {
    let bestProvider: string | null = null;
    let maxTokens = -1;

    for (const [providerName, limiter] of this.limiters) {
      const status = limiter.getStatus();
      if (!status.isLimited && status.tokens > maxTokens) {
        const quotaStatus = limiter.getQuotaStatus();
        if (!quotaStatus || quotaStatus.remaining > 0) {
          maxTokens = status.tokens;
          bestProvider = providerName;
        }
      }
    }

    return bestProvider;
  }

  /**
   * Update configuration for a provider
   */
  updateProviderConfig(providerName: string, config: Partial<RateLimitConfig>): void {
    const limiter = this.limiters.get(providerName);
    if (limiter) {
      limiter.updateConfig(config);
      const existingConfig = this.configs.get(providerName) || DEFAULT_RATE_LIMIT_CONFIG;
      const finalConfig: RateLimitConfig = {
        requestsPerSecond: config.requestsPerSecond ?? existingConfig.requestsPerSecond,
        burstSize: config.burstSize ?? existingConfig.burstSize,
        quotaPerDay: config.quotaPerDay ?? existingConfig.quotaPerDay,
        backoffOnLimit: config.backoffOnLimit ?? existingConfig.backoffOnLimit,
        maxBackoffDelay: config.maxBackoffDelay ?? existingConfig.maxBackoffDelay,
        enableAdaptiveLimiting: config.enableAdaptiveLimiting ?? existingConfig.enableAdaptiveLimiting,
      };
      this.configs.set(providerName, finalConfig);
    }
  }

  /**
   * Reset all limiters
   */
  resetAll(): void {
    for (const limiter of this.limiters.values()) {
      limiter.reset();
    }
  }
}

/**
 * Rate limit response information
 */
export interface RateLimitResponse {
  /** Suggested retry after time in seconds */
  retryAfter?: number;
  /** Current rate limit */
  limit?: number;
  /** Remaining requests */
  remaining?: number;
  /** Reset timestamp */
  reset?: number;
}

/**
 * Global multi-provider rate limiter
 */
export const globalRateLimiter = new MultiProviderRateLimiter();

/**
 * Convenience function to check rate limit for a provider
 */
export async function checkRateLimit(providerName: string): Promise<RateLimitResult> {
  return globalRateLimiter.checkLimit(providerName);
}

/**
 * Convenience function to wait for rate limit slot
 */
export async function waitForRateLimitSlot(providerName: string): Promise<RateLimitResult> {
  return globalRateLimiter.waitForSlot(providerName);
}

/**
 * Convenience function to apply rate limit penalty
 */
export function applyRateLimitPenalty(providerName: string, response?: RateLimitResponse): void {
  globalRateLimiter.applyPenalty(providerName, response);
}
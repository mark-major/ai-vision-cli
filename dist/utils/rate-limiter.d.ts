export interface RateLimitConfig {
    requestsPerSecond: number;
    burstSize: number;
    quotaPerDay?: number;
    backoffOnLimit: boolean;
    maxBackoffDelay: number;
    enableAdaptiveLimiting: boolean;
}
export interface RateLimitStatus {
    tokens: number;
    capacity: number;
    lastRefill: Date;
    requestsInPeriod: number;
    quotaRemaining?: number;
    resetTime?: Date;
    isLimited: boolean;
    nextRequestTime?: Date;
}
export interface RateLimitResult {
    allowed: boolean;
    tokensRemaining: number;
    waitTime: number;
    status: RateLimitStatus;
}
export interface QuotaStatus {
    dailyLimit: number;
    usedToday: number;
    remaining: number;
    resetTime: Date;
    usagePercentage: number;
}
export declare const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig;
export declare class TokenBucketRateLimiter {
    private config;
    private tokens;
    private lastRefill;
    private requestsInPeriod;
    private quotaUsedToday;
    private quotaResetTime;
    private isLimited;
    private backoffEndTime;
    constructor(config?: Partial<RateLimitConfig>);
    checkLimit(): Promise<RateLimitResult>;
    waitForSlot(): Promise<RateLimitResult>;
    applyPenalty(response?: RateLimitResponse): void;
    updateConfig(config: Partial<RateLimitConfig>): void;
    getStatus(): RateLimitStatus;
    getQuotaStatus(): QuotaStatus | undefined;
    reset(): void;
    private refillTokens;
    private calculateQuotaResetTime;
    private delay;
}
export declare class MultiProviderRateLimiter {
    private limiters;
    private configs;
    addProvider(providerName: string, config?: Partial<RateLimitConfig>): void;
    removeProvider(providerName: string): void;
    checkLimit(providerName: string): Promise<RateLimitResult>;
    waitForSlot(providerName: string): Promise<RateLimitResult>;
    applyPenalty(providerName: string, response?: RateLimitResponse): void;
    getAllStatus(): Map<string, RateLimitStatus>;
    getAllQuotaStatus(): Map<string, QuotaStatus>;
    getAvailableProvider(): string | null;
    getBestProvider(): string | null;
    updateProviderConfig(providerName: string, config: Partial<RateLimitConfig>): void;
    resetAll(): void;
}
export interface RateLimitResponse {
    retryAfter?: number;
    limit?: number;
    remaining?: number;
    reset?: number;
}
export declare const globalRateLimiter: MultiProviderRateLimiter;
export declare function checkRateLimit(providerName: string): Promise<RateLimitResult>;
export declare function waitForRateLimitSlot(providerName: string): Promise<RateLimitResult>;
export declare function applyRateLimitPenalty(providerName: string, response?: RateLimitResponse): void;
//# sourceMappingURL=rate-limiter.d.ts.map
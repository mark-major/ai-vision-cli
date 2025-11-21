export interface RetryConfig {
    maxAttempts: number;
    baseDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
    jitter: boolean;
    retryableErrors: string[];
    retryableStatusCodes?: number[];
    retryOnNetworkErrors: boolean;
    onRetry?: (attempt: number, error: Error, delay: number) => void;
}
export interface RetryResult<T> {
    result: T;
    attempts: number;
    totalTime: number;
    retried: boolean;
}
export interface RetryError extends Error {
    attempts: number;
    errors: Error[];
    totalTime: number;
}
export declare const DEFAULT_RETRY_CONFIG: RetryConfig;
export declare const CRITICAL_RETRY_CONFIG: RetryConfig;
export declare const NON_CRITICAL_RETRY_CONFIG: RetryConfig;
export declare class RetryHandler {
    private config;
    constructor(config?: Partial<RetryConfig>);
    execute<T>(operation: () => Promise<T>): Promise<RetryResult<T>>;
    executeWithConfig<T>(operation: () => Promise<T>, config: Partial<RetryConfig>): Promise<RetryResult<T>>;
    private isRetryableError;
    private isNetworkError;
    private calculateDelay;
    private delay;
    getConfig(): RetryConfig;
    updateConfig(config: Partial<RetryConfig>): void;
    withConfig(config: Partial<RetryConfig>): RetryHandler;
}
export declare function withRetry<T>(operation: () => Promise<T>, config?: Partial<RetryConfig>): Promise<RetryResult<T>>;
export declare function withRetryCritical<T>(operation: () => Promise<T>, config?: Partial<RetryConfig>): Promise<RetryResult<T>>;
export declare function withRetryNonCritical<T>(operation: () => Promise<T>, config?: Partial<RetryConfig>): Promise<RetryResult<T>>;
//# sourceMappingURL=retry-handler.d.ts.map
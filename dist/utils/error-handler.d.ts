import { Logger } from './logger.js';
import { MetricsCollector } from './metrics.js';
import { RetryHandler } from './retry-handler.js';
import { CircuitBreaker } from './circuit-breaker.js';
import { TokenBucketRateLimiter } from './rate-limiter.js';
export interface ErrorHandlerOptions {
    logger?: Logger;
    metrics?: MetricsCollector;
    retryHandler?: RetryHandler;
    circuitBreaker?: CircuitBreaker;
    rateLimiter?: TokenBucketRateLimiter;
    enableMetrics?: boolean;
    correlationId?: string;
}
export interface ErrorContext {
    operation: string;
    provider?: string;
    command?: string;
    userId?: string;
    requestId?: string;
    additionalData?: Record<string, any>;
}
export interface ErrorAnalysis {
    isRetryable: boolean;
    shouldTriggerCircuitBreaker: boolean;
    shouldApplyRateLimitBackoff: boolean;
    suggestedAction: 'retry' | 'fail' | 'backoff' | 'switch_provider';
    estimatedRetryDelay?: number;
    category: 'transient' | 'permanent' | 'rate_limit' | 'authentication' | 'network';
    severity: 'low' | 'medium' | 'high' | 'critical';
}
export declare class ErrorHandler {
    options: ErrorHandlerOptions;
    constructor(options?: ErrorHandlerOptions);
    handleError(error: Error, context?: string | ErrorContext, options?: {
        exit?: boolean;
    }): never;
    analyzeError(error: Error, context: ErrorContext): ErrorAnalysis;
    private analyzeVisionError;
    private logError;
    private recordErrorMetrics;
    private displayErrorMessage;
    private displayVisionErrorMessage;
    private displayGenericErrorMessage;
    private displayErrorDetails;
    private displayContextInfo;
    private displayAnalysisInfo;
    private displayDebugInfo;
    private getErrorIcon;
    private getErrorColor;
    private getErrorTitle;
    private getActionSuggestion;
    private normalizeContext;
    private getExitCode;
}
export declare const globalErrorHandler: ErrorHandler;
export declare function handleError(error: Error, context?: string | ErrorContext, options?: {
    exit?: boolean;
}): never;
export declare function createErrorContext(command: string, operation?: string): ErrorContext;
export declare function logError(error: Error, context?: string | ErrorContext): void;
export declare function isRetryableError(error: Error): boolean;
//# sourceMappingURL=error-handler.d.ts.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetryHandler = exports.NON_CRITICAL_RETRY_CONFIG = exports.CRITICAL_RETRY_CONFIG = exports.DEFAULT_RETRY_CONFIG = void 0;
exports.withRetry = withRetry;
exports.withRetryCritical = withRetryCritical;
exports.withRetryNonCritical = withRetryNonCritical;
const crypto_1 = require("crypto");
exports.DEFAULT_RETRY_CONFIG = {
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
exports.CRITICAL_RETRY_CONFIG = {
    ...exports.DEFAULT_RETRY_CONFIG,
    maxAttempts: 5,
    baseDelay: 2000,
    maxDelay: 60000,
};
exports.NON_CRITICAL_RETRY_CONFIG = {
    ...exports.DEFAULT_RETRY_CONFIG,
    maxAttempts: 2,
    baseDelay: 500,
    maxDelay: 5000,
};
class RetryHandler {
    config;
    constructor(config = {}) {
        this.config = { ...exports.DEFAULT_RETRY_CONFIG, ...config };
    }
    async execute(operation) {
        const startTime = Date.now();
        let lastError = null;
        const errors = [];
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
            }
            catch (error) {
                const err = error;
                errors.push(err);
                lastError = err;
                if (attempt === this.config.maxAttempts) {
                    break;
                }
                if (!this.isRetryableError(err)) {
                    break;
                }
                const delay = this.calculateDelay(attempt);
                if (this.config.onRetry) {
                    this.config.onRetry(attempt, err, delay);
                }
                await this.delay(delay);
            }
        }
        const totalTime = Date.now() - startTime;
        const retryError = new Error(`Operation failed after ${this.config.maxAttempts} attempts: ${lastError?.message}`);
        retryError.attempts = Math.min(this.config.maxAttempts, errors.length);
        retryError.errors = errors;
        retryError.totalTime = totalTime;
        retryError.stack = lastError?.stack;
        throw retryError;
    }
    async executeWithConfig(operation, config) {
        const handler = new RetryHandler({ ...this.config, ...config });
        return handler.execute(operation);
    }
    isRetryableError(error) {
        if (this.config.retryableErrors.includes(error.name)) {
            return true;
        }
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
        const httpMatch = error.message.match(/status (\d{3})/);
        if (httpMatch && this.config.retryableStatusCodes) {
            const statusCode = parseInt(httpMatch[1]);
            return this.config.retryableStatusCodes.includes(statusCode);
        }
        if (this.config.retryOnNetworkErrors && this.isNetworkError(error)) {
            return true;
        }
        return false;
    }
    isNetworkError(error) {
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
    calculateDelay(attempt) {
        let delay = this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt - 1);
        delay = Math.min(delay, this.config.maxDelay);
        if (this.config.jitter) {
            const jitterRange = delay * 0.1;
            delay += (0, crypto_1.randomInt)(0, Math.floor(jitterRange));
        }
        return Math.floor(delay);
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    getConfig() {
        return { ...this.config };
    }
    updateConfig(config) {
        this.config = { ...this.config, ...config };
    }
    withConfig(config) {
        return new RetryHandler({ ...this.config, ...config });
    }
}
exports.RetryHandler = RetryHandler;
async function withRetry(operation, config) {
    const handler = new RetryHandler(config);
    return handler.execute(operation);
}
async function withRetryCritical(operation, config) {
    const handler = new RetryHandler({ ...exports.CRITICAL_RETRY_CONFIG, ...config });
    return handler.execute(operation);
}
async function withRetryNonCritical(operation, config) {
    const handler = new RetryHandler({ ...exports.NON_CRITICAL_RETRY_CONFIG, ...config });
    return handler.execute(operation);
}
//# sourceMappingURL=retry-handler.js.map
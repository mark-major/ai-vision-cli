"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalRateLimiter = exports.MultiProviderRateLimiter = exports.TokenBucketRateLimiter = exports.DEFAULT_RATE_LIMIT_CONFIG = void 0;
exports.checkRateLimit = checkRateLimit;
exports.waitForRateLimitSlot = waitForRateLimitSlot;
exports.applyRateLimitPenalty = applyRateLimitPenalty;
exports.DEFAULT_RATE_LIMIT_CONFIG = {
    requestsPerSecond: 10,
    burstSize: 20,
    quotaPerDay: 1000,
    backoffOnLimit: true,
    maxBackoffDelay: 60000,
    enableAdaptiveLimiting: true,
};
class TokenBucketRateLimiter {
    config;
    tokens;
    lastRefill;
    requestsInPeriod;
    quotaUsedToday;
    quotaResetTime;
    isLimited = false;
    backoffEndTime = null;
    constructor(config = {}) {
        this.config = { ...exports.DEFAULT_RATE_LIMIT_CONFIG, ...config };
        this.tokens = this.config.burstSize;
        this.lastRefill = new Date();
        this.requestsInPeriod = 0;
        this.quotaUsedToday = 0;
        this.quotaResetTime = this.calculateQuotaResetTime();
    }
    async checkLimit() {
        this.refillTokens();
        if (this.backoffEndTime && new Date() < this.backoffEndTime) {
            const waitTime = this.backoffEndTime.getTime() - Date.now();
            return {
                allowed: false,
                tokensRemaining: this.tokens,
                waitTime,
                status: this.getStatus(),
            };
        }
        if (this.config.quotaPerDay && this.quotaUsedToday >= this.config.quotaPerDay) {
            return {
                allowed: false,
                tokensRemaining: this.tokens,
                waitTime: this.quotaResetTime.getTime() - Date.now(),
                status: this.getStatus(),
            };
        }
        if (this.tokens < 1) {
            const waitTime = Math.ceil((1 - this.tokens) * 1000 / this.config.requestsPerSecond);
            return {
                allowed: false,
                tokensRemaining: this.tokens,
                waitTime,
                status: this.getStatus(),
            };
        }
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
    async waitForSlot() {
        let result = await this.checkLimit();
        while (!result.allowed) {
            if (result.waitTime > 0) {
                await this.delay(Math.min(result.waitTime, 1000));
            }
            result = await this.checkLimit();
        }
        return result;
    }
    applyPenalty(response) {
        this.isLimited = true;
        if (this.config.backoffOnLimit) {
            let backoffDuration = 1000;
            if (response?.retryAfter) {
                backoffDuration = response.retryAfter * 1000;
            }
            else {
                backoffDuration = Math.min(backoffDuration * Math.pow(2, this.requestsInPeriod), this.config.maxBackoffDelay);
            }
            this.backoffEndTime = new Date(Date.now() + backoffDuration);
        }
        this.tokens = Math.max(0, this.tokens - Math.min(5, this.tokens));
    }
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        if (this.tokens > this.config.burstSize) {
            this.tokens = this.config.burstSize;
        }
    }
    getStatus() {
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
    getQuotaStatus() {
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
    reset() {
        this.tokens = this.config.burstSize;
        this.lastRefill = new Date();
        this.requestsInPeriod = 0;
        this.isLimited = false;
        this.backoffEndTime = null;
    }
    refillTokens() {
        const now = new Date();
        const timeDiff = (now.getTime() - this.lastRefill.getTime()) / 1000;
        if (timeDiff > 0) {
            const tokensToAdd = timeDiff * this.config.requestsPerSecond;
            this.tokens = Math.min(this.config.burstSize, this.tokens + tokensToAdd);
            this.lastRefill = now;
            if (timeDiff > 5) {
                this.isLimited = false;
                this.backoffEndTime = null;
            }
        }
        if (now >= this.quotaResetTime) {
            this.quotaUsedToday = 0;
            this.quotaResetTime = this.calculateQuotaResetTime();
        }
    }
    calculateQuotaResetTime() {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        return tomorrow;
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.TokenBucketRateLimiter = TokenBucketRateLimiter;
class MultiProviderRateLimiter {
    limiters = new Map();
    configs = new Map();
    addProvider(providerName, config = {}) {
        const finalConfig = {
            requestsPerSecond: config.requestsPerSecond ?? exports.DEFAULT_RATE_LIMIT_CONFIG.requestsPerSecond,
            burstSize: config.burstSize ?? exports.DEFAULT_RATE_LIMIT_CONFIG.burstSize,
            quotaPerDay: config.quotaPerDay ?? exports.DEFAULT_RATE_LIMIT_CONFIG.quotaPerDay,
            backoffOnLimit: config.backoffOnLimit ?? exports.DEFAULT_RATE_LIMIT_CONFIG.backoffOnLimit,
            maxBackoffDelay: config.maxBackoffDelay ?? exports.DEFAULT_RATE_LIMIT_CONFIG.maxBackoffDelay,
            enableAdaptiveLimiting: config.enableAdaptiveLimiting ?? exports.DEFAULT_RATE_LIMIT_CONFIG.enableAdaptiveLimiting,
        };
        this.configs.set(providerName, finalConfig);
        this.limiters.set(providerName, new TokenBucketRateLimiter(finalConfig));
    }
    removeProvider(providerName) {
        this.limiters.delete(providerName);
        this.configs.delete(providerName);
    }
    async checkLimit(providerName) {
        const limiter = this.limiters.get(providerName);
        if (!limiter) {
            throw new Error(`Rate limiter for provider ${providerName} not found`);
        }
        return limiter.checkLimit();
    }
    async waitForSlot(providerName) {
        const limiter = this.limiters.get(providerName);
        if (!limiter) {
            throw new Error(`Rate limiter for provider ${providerName} not found`);
        }
        return limiter.waitForSlot();
    }
    applyPenalty(providerName, response) {
        const limiter = this.limiters.get(providerName);
        if (limiter) {
            limiter.applyPenalty(response);
        }
    }
    getAllStatus() {
        const status = new Map();
        for (const [providerName, limiter] of this.limiters) {
            status.set(providerName, limiter.getStatus());
        }
        return status;
    }
    getAllQuotaStatus() {
        const quotaStatus = new Map();
        for (const [providerName, limiter] of this.limiters) {
            const status = limiter.getQuotaStatus();
            if (status) {
                quotaStatus.set(providerName, status);
            }
        }
        return quotaStatus;
    }
    getAvailableProvider() {
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
    getBestProvider() {
        let bestProvider = null;
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
    updateProviderConfig(providerName, config) {
        const limiter = this.limiters.get(providerName);
        if (limiter) {
            limiter.updateConfig(config);
            const existingConfig = this.configs.get(providerName) || exports.DEFAULT_RATE_LIMIT_CONFIG;
            const finalConfig = {
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
    resetAll() {
        for (const limiter of this.limiters.values()) {
            limiter.reset();
        }
    }
}
exports.MultiProviderRateLimiter = MultiProviderRateLimiter;
exports.globalRateLimiter = new MultiProviderRateLimiter();
async function checkRateLimit(providerName) {
    return exports.globalRateLimiter.checkLimit(providerName);
}
async function waitForRateLimitSlot(providerName) {
    return exports.globalRateLimiter.waitForSlot(providerName);
}
function applyRateLimitPenalty(providerName, response) {
    exports.globalRateLimiter.applyPenalty(providerName, response);
}
//# sourceMappingURL=rate-limiter.js.map
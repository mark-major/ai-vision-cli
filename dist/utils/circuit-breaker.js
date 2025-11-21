"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalCircuitBreakerManager = exports.CircuitBreakerManager = exports.DEFAULT_CIRCUIT_BREAKER_CONFIG = exports.CircuitBreaker = exports.CircuitState = void 0;
exports.canExecuteProvider = canExecuteProvider;
exports.recordProviderSuccess = recordProviderSuccess;
exports.recordProviderFailure = recordProviderFailure;
var CircuitState;
(function (CircuitState) {
    CircuitState["CLOSED"] = "closed";
    CircuitState["OPEN"] = "open";
    CircuitState["HALF_OPEN"] = "half_open";
})(CircuitState || (exports.CircuitState = CircuitState = {}));
class CircuitBreaker {
    config;
    state;
    healthCheckTimer;
    responseTimes = [];
    maxResponseTimes = 100;
    constructor(name, config = {}) {
        this.config = { ...exports.DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config };
        this.state = this.initializeState(name);
        if (this.config.persistState && this.config.stateFile) {
            this.loadState();
        }
        if (this.config.enableHealthChecks) {
            this.startHealthChecks();
        }
    }
    async canExecute() {
        this.cleanupOldMetrics();
        switch (this.state.state) {
            case CircuitState.CLOSED:
                return {
                    allowed: true,
                    state: CircuitState.CLOSED,
                };
            case CircuitState.OPEN:
                const timeSinceOpen = Date.now() - this.state.lastStateChange.getTime();
                if (timeSinceOpen >= this.config.resetTimeout) {
                    this.transitionToHalfOpen();
                    return {
                        allowed: true,
                        state: CircuitState.HALF_OPEN,
                    };
                }
                return {
                    allowed: false,
                    state: CircuitState.OPEN,
                    reason: 'Circuit is open',
                    waitTime: this.config.resetTimeout - timeSinceOpen,
                };
            case CircuitState.HALF_OPEN:
                return {
                    allowed: true,
                    state: CircuitState.HALF_OPEN,
                    reason: 'Circuit is half-open, testing recovery',
                };
            default:
                throw new Error(`Invalid circuit state: ${this.state.state}`);
        }
    }
    recordSuccess(responseTime) {
        this.state.totalRequests++;
        this.state.successCount++;
        this.state.lastSuccessTime = new Date();
        if (responseTime !== undefined) {
            this.recordResponseTime(responseTime);
        }
        if (this.state.state === CircuitState.CLOSED) {
            this.state.failureCount = 0;
        }
        if (this.state.state === CircuitState.HALF_OPEN) {
            if (this.state.successCount >= this.config.successThreshold) {
                this.transitionToClosed();
            }
        }
        if (this.config.persistState) {
            this.saveState();
        }
    }
    recordFailure(error, responseTime) {
        this.state.totalRequests++;
        this.state.failureCount++;
        this.state.lastFailureTime = new Date();
        if (responseTime !== undefined) {
            this.recordResponseTime(responseTime);
        }
        if (this.config.trackErrorTypes) {
            const errorType = error.name || 'Unknown';
            const currentCount = this.state.errorCounts.get(errorType) || 0;
            this.state.errorCounts.set(errorType, currentCount + 1);
            if (this.config.criticalErrorTypes.includes(errorType)) {
                this.transitionToOpen();
                return;
            }
        }
        if (this.state.state === CircuitState.CLOSED) {
            if (this.state.failureCount >= this.config.failureThreshold) {
                this.transitionToOpen();
            }
        }
        else if (this.state.state === CircuitState.HALF_OPEN) {
            this.transitionToOpen();
        }
        if (this.config.persistState) {
            this.saveState();
        }
    }
    getState() {
        return { ...this.state };
    }
    getCurrentState() {
        return this.state.state;
    }
    reset() {
        this.state.state = CircuitState.CLOSED;
        this.state.failureCount = 0;
        this.state.successCount = 0;
        this.state.totalRequests = 0;
        this.state.lastStateChange = new Date();
        this.state.errorCounts.clear();
        this.responseTimes = [];
        if (this.config.persistState) {
            this.saveState();
        }
    }
    getStats() {
        const successRate = this.state.totalRequests > 0
            ? this.state.successCount / this.state.totalRequests
            : 0;
        const failureRate = this.state.totalRequests > 0
            ? this.state.failureCount / this.state.totalRequests
            : 0;
        const averageResponseTime = this.responseTimes.length > 0
            ? this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length
            : 0;
        return {
            state: this.state.state,
            totalRequests: this.state.totalRequests,
            successCount: this.state.successCount,
            failureCount: this.state.failureCount,
            successRate,
            failureRate,
            averageResponseTime,
            lastFailureTime: this.state.lastFailureTime,
            lastSuccessTime: this.state.lastSuccessTime,
            lastStateChange: this.state.lastStateChange,
            errorCounts: Object.fromEntries(this.state.errorCounts),
        };
    }
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        if (this.config.enableHealthChecks && this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.startHealthChecks();
        }
    }
    destroy() {
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
        }
    }
    initializeState(_name) {
        return {
            state: CircuitState.CLOSED,
            failureCount: 0,
            successCount: 0,
            lastStateChange: new Date(),
            totalRequests: 0,
            errorCounts: new Map(),
            performance: {
                averageResponseTime: 0,
                lastResponseTime: 0,
                responseTimes: [],
            },
        };
    }
    transitionToOpen() {
        this.state.state = CircuitState.OPEN;
        this.state.lastStateChange = new Date();
        this.state.successCount = 0;
    }
    transitionToHalfOpen() {
        this.state.state = CircuitState.HALF_OPEN;
        this.state.lastStateChange = new Date();
        this.state.successCount = 0;
    }
    transitionToClosed() {
        this.state.state = CircuitState.CLOSED;
        this.state.lastStateChange = new Date();
        this.state.failureCount = 0;
        this.state.successCount = 0;
    }
    recordResponseTime(responseTime) {
        this.responseTimes.push(responseTime);
        if (this.responseTimes.length > this.maxResponseTimes) {
            this.responseTimes.shift();
        }
        this.state.performance.lastResponseTime = responseTime;
        this.state.performance.averageResponseTime =
            this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length;
    }
    cleanupOldMetrics() {
        const timeSinceLastChange = Date.now() - this.state.lastStateChange.getTime();
        if (timeSinceLastChange > this.config.monitoringPeriod * 2) {
            if (this.state.state === CircuitState.CLOSED) {
                this.state.failureCount = 0;
                this.state.successCount = 0;
            }
        }
    }
    startHealthChecks() {
        this.healthCheckTimer = setInterval(() => {
            this.performHealthCheck();
        }, this.config.healthCheckInterval);
    }
    async performHealthCheck() {
    }
    async saveState() {
        if (!this.config.stateFile)
            return;
        try {
            const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
            const stateData = {
                state: this.state.state,
                failureCount: this.state.failureCount,
                successCount: this.state.successCount,
                lastFailureTime: this.state.lastFailureTime,
                lastSuccessTime: this.state.lastSuccessTime,
                lastStateChange: this.state.lastStateChange,
                totalRequests: this.state.totalRequests,
                errorCounts: Object.fromEntries(this.state.errorCounts),
                performance: this.state.performance,
            };
            await fs.writeFile(this.config.stateFile, JSON.stringify(stateData, null, 2));
        }
        catch (error) {
            console.error('Failed to save circuit breaker state:', error);
        }
    }
    async loadState() {
        if (!this.config.stateFile)
            return;
        try {
            const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
            const data = await fs.readFile(this.config.stateFile, 'utf-8');
            const stateData = JSON.parse(data);
            this.state.state = stateData.state || CircuitState.CLOSED;
            this.state.failureCount = stateData.failureCount || 0;
            this.state.successCount = stateData.successCount || 0;
            this.state.lastFailureTime = stateData.lastFailureTime ? new Date(stateData.lastFailureTime) : undefined;
            this.state.lastSuccessTime = stateData.lastSuccessTime ? new Date(stateData.lastSuccessTime) : undefined;
            this.state.lastStateChange = new Date(stateData.lastStateChange);
            this.state.totalRequests = stateData.totalRequests || 0;
            this.state.errorCounts = new Map(Object.entries(stateData.errorCounts || {}));
            this.state.performance = stateData.performance || {
                averageResponseTime: 0,
                lastResponseTime: 0,
                responseTimes: [],
            };
        }
        catch (error) {
            console.warn('Could not load circuit breaker state, using defaults:', error);
        }
    }
}
exports.CircuitBreaker = CircuitBreaker;
exports.DEFAULT_CIRCUIT_BREAKER_CONFIG = {
    failureThreshold: 5,
    monitoringPeriod: 60000,
    resetTimeout: 300000,
    successThreshold: 3,
    trackErrorTypes: true,
    criticalErrorTypes: [
        'ECONNREFUSED',
        'ENOTFOUND',
        'ETIMEDOUT',
        'AUTHENTICATION_ERROR',
        'PERMISSION_DENIED',
    ],
    persistState: false,
    enableHealthChecks: true,
    healthCheckInterval: 30000,
};
class CircuitBreakerManager {
    circuitBreakers = new Map();
    addProvider(providerName, config) {
        const circuitBreaker = new CircuitBreaker(providerName, config);
        this.circuitBreakers.set(providerName, circuitBreaker);
    }
    removeProvider(providerName) {
        const circuitBreaker = this.circuitBreakers.get(providerName);
        if (circuitBreaker) {
            circuitBreaker.destroy();
            this.circuitBreakers.delete(providerName);
        }
    }
    async canExecute(providerName) {
        const circuitBreaker = this.circuitBreakers.get(providerName);
        if (!circuitBreaker) {
            return { allowed: true, state: CircuitState.CLOSED };
        }
        return circuitBreaker.canExecute();
    }
    recordSuccess(providerName, responseTime) {
        const circuitBreaker = this.circuitBreakers.get(providerName);
        if (circuitBreaker) {
            circuitBreaker.recordSuccess(responseTime);
        }
    }
    recordFailure(providerName, error, responseTime) {
        const circuitBreaker = this.circuitBreakers.get(providerName);
        if (circuitBreaker) {
            circuitBreaker.recordFailure(error, responseTime);
        }
    }
    getAvailableProviders() {
        const available = [];
        for (const [providerName, circuitBreaker] of this.circuitBreakers) {
            const state = circuitBreaker.getCurrentState();
            if (state !== CircuitState.OPEN) {
                available.push(providerName);
            }
        }
        return available;
    }
    getBestProvider() {
        const available = this.getAvailableProviders();
        if (available.length === 0) {
            return null;
        }
        const closedProviders = available.filter(provider => {
            const circuitBreaker = this.circuitBreakers.get(provider);
            return circuitBreaker?.getCurrentState() === CircuitState.CLOSED;
        });
        if (closedProviders.length > 0) {
            return closedProviders[0];
        }
        return available[0];
    }
    getAllStats() {
        const stats = {};
        for (const [providerName, circuitBreaker] of this.circuitBreakers) {
            stats[providerName] = circuitBreaker.getStats();
        }
        return stats;
    }
    resetAll() {
        for (const circuitBreaker of this.circuitBreakers.values()) {
            circuitBreaker.reset();
        }
    }
    destroy() {
        for (const circuitBreaker of this.circuitBreakers.values()) {
            circuitBreaker.destroy();
        }
        this.circuitBreakers.clear();
    }
}
exports.CircuitBreakerManager = CircuitBreakerManager;
exports.globalCircuitBreakerManager = new CircuitBreakerManager();
async function canExecuteProvider(providerName) {
    return exports.globalCircuitBreakerManager.canExecute(providerName);
}
function recordProviderSuccess(providerName, responseTime) {
    exports.globalCircuitBreakerManager.recordSuccess(providerName, responseTime);
}
function recordProviderFailure(providerName, error, responseTime) {
    exports.globalCircuitBreakerManager.recordFailure(providerName, error, responseTime);
}
//# sourceMappingURL=circuit-breaker.js.map
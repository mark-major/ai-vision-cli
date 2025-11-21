"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalHealthChecker = exports.HealthChecker = exports.DEFAULT_HEALTH_CHECK_CONFIG = void 0;
exports.checkHealth = checkHealth;
exports.checkAllHealth = checkAllHealth;
exports.DEFAULT_HEALTH_CHECK_CONFIG = {
    checkInterval: 300000,
    timeout: 10000,
    failureThreshold: 3,
    enableDetailedChecks: true,
    enableCaching: true,
    cacheDuration: 60000,
};
class HealthChecker {
    config;
    providers = new Map();
    healthResults = new Map();
    healthHistory = new Map();
    checkIntervals = new Map();
    isMonitoring = false;
    constructor(config = {}) {
        this.config = { ...exports.DEFAULT_HEALTH_CHECK_CONFIG, ...config };
    }
    addProvider(name, provider) {
        this.providers.set(name, provider);
        if (!this.healthHistory.has(name)) {
            this.healthHistory.set(name, {
                results: [],
                maxResults: 100,
            });
        }
        if (this.isMonitoring && !this.checkIntervals.has(name)) {
            this.startProviderMonitoring(name);
        }
    }
    removeProvider(name) {
        this.providers.delete(name);
        this.stopProviderMonitoring(name);
        this.healthResults.delete(name);
        this.healthHistory.delete(name);
    }
    startMonitoring() {
        if (this.isMonitoring) {
            return;
        }
        this.isMonitoring = true;
        for (const providerName of this.providers.keys()) {
            this.startProviderMonitoring(providerName);
        }
    }
    stopMonitoring() {
        this.isMonitoring = false;
        for (const providerName of this.checkIntervals.keys()) {
            this.stopProviderMonitoring(providerName);
        }
    }
    async checkProviderHealth(providerName) {
        const provider = this.providers.get(providerName);
        if (!provider) {
            throw new Error(`Provider ${providerName} not found`);
        }
        if (this.config.enableCaching) {
            const cachedResult = this.healthResults.get(providerName);
            if (cachedResult && this.isResultValid(cachedResult)) {
                return cachedResult;
            }
        }
        const startTime = Date.now();
        const result = {
            provider: providerName,
            status: 'healthy',
            responseTime: 0,
            lastCheck: new Date(),
            details: {
                authentication: false,
                connectivity: false,
                endpointAvailable: false,
                serviceSpecific: {},
                performance: {
                    averageResponseTime: 0,
                    successRate: 0,
                    totalChecks: 0,
                    consecutiveFailures: 0,
                },
            },
        };
        try {
            const healthPromise = this.performDetailedHealthCheck(provider, result);
            const timeoutPromise = this.createTimeoutPromise(this.config.timeout);
            await Promise.race([healthPromise, timeoutPromise]);
            result.status = this.determineHealthStatus(result.details);
            result.responseTime = Date.now() - startTime;
        }
        catch (error) {
            result.status = 'unhealthy';
            result.responseTime = Date.now() - startTime;
            result.error = error instanceof Error ? error.message : String(error);
        }
        this.healthResults.set(providerName, result);
        this.updateHealthHistory(providerName, result);
        return result;
    }
    async checkAllProviders() {
        const results = new Map();
        for (const providerName of this.providers.keys()) {
            try {
                const result = await this.checkProviderHealth(providerName);
                results.set(providerName, result);
            }
            catch (error) {
                const errorResult = {
                    provider: providerName,
                    status: 'unhealthy',
                    responseTime: 0,
                    lastCheck: new Date(),
                    details: {
                        authentication: false,
                        connectivity: false,
                        endpointAvailable: false,
                        serviceSpecific: {},
                        performance: {
                            averageResponseTime: 0,
                            successRate: 0,
                            totalChecks: 0,
                            consecutiveFailures: 0,
                        },
                    },
                    error: error instanceof Error ? error.message : String(error),
                };
                results.set(providerName, errorResult);
            }
        }
        return results;
    }
    getProviderHealth(providerName) {
        return this.healthResults.get(providerName);
    }
    getProviderHistory(providerName) {
        return this.healthHistory.get(providerName);
    }
    getAllProviderHealth() {
        return new Map(this.healthResults);
    }
    getHealthyProviders() {
        const healthy = [];
        for (const [name, result] of this.healthResults) {
            if (result.status === 'healthy') {
                healthy.push(name);
            }
        }
        return healthy;
    }
    getUnhealthyProviders() {
        const unhealthy = [];
        for (const [name, result] of this.healthResults) {
            if (result.status === 'unhealthy') {
                unhealthy.push(name);
            }
        }
        return unhealthy;
    }
    startProviderMonitoring(providerName) {
        const interval = setInterval(async () => {
            try {
                await this.checkProviderHealth(providerName);
            }
            catch (error) {
                console.error(`Health check failed for ${providerName}:`, error);
            }
        }, this.config.checkInterval);
        this.checkIntervals.set(providerName, interval);
    }
    stopProviderMonitoring(providerName) {
        const interval = this.checkIntervals.get(providerName);
        if (interval) {
            clearInterval(interval);
            this.checkIntervals.delete(providerName);
        }
    }
    async performDetailedHealthCheck(provider, result) {
        const providerInfo = provider.getProviderInfo();
        result.details.serviceSpecific = {
            version: providerInfo.version,
            capabilities: providerInfo.capabilities,
        };
        try {
            const healthStatus = await provider.healthCheck();
            result.details.connectivity = healthStatus.status === 'healthy';
            result.details.authentication = healthStatus.status !== 'unhealthy';
            result.details.endpointAvailable = healthStatus.status !== 'unhealthy';
        }
        catch (error) {
            result.details.connectivity = false;
            result.details.authentication = false;
            result.details.endpointAvailable = false;
            throw error;
        }
    }
    determineHealthStatus(details) {
        const { authentication, connectivity, endpointAvailable } = details;
        if (!connectivity || !endpointAvailable) {
            return 'unhealthy';
        }
        if (!authentication) {
            return 'degraded';
        }
        const history = this.getProviderHistory('');
        if (history && history.results.length > 0) {
            const recentResults = history.results.slice(-5);
            const avgResponseTime = recentResults.reduce((sum, r) => sum + r.responseTime, 0) / recentResults.length;
            if (avgResponseTime > 10000) {
                return 'degraded';
            }
        }
        return 'healthy';
    }
    isResultValid(result) {
        const now = Date.now();
        const resultTime = result.lastCheck.getTime();
        return (now - resultTime) < this.config.cacheDuration;
    }
    updateHealthHistory(providerName, result) {
        const history = this.healthHistory.get(providerName);
        if (history) {
            history.results.push(result);
            if (history.results.length > history.maxResults) {
                history.results = history.results.slice(-history.maxResults);
            }
            this.updatePerformanceMetrics(history);
        }
    }
    updatePerformanceMetrics(history) {
        if (history.results.length === 0) {
            return;
        }
        const recentResults = history.results.slice(-10);
        const totalResponseTime = recentResults.reduce((sum, r) => sum + r.responseTime, 0);
        const successCount = recentResults.filter(r => r.status === 'healthy').length;
        const performance = {
            averageResponseTime: totalResponseTime / recentResults.length,
            successRate: successCount / recentResults.length,
            totalChecks: history.results.length,
            consecutiveFailures: this.calculateConsecutiveFailures(recentResults),
        };
        if (history.results.length > 0) {
            history.results[history.results.length - 1].details.performance = performance;
        }
    }
    calculateConsecutiveFailures(results) {
        let consecutiveFailures = 0;
        for (let i = results.length - 1; i >= 0; i--) {
            if (results[i].status !== 'healthy') {
                consecutiveFailures++;
            }
            else {
                break;
            }
        }
        return consecutiveFailures;
    }
    createTimeoutPromise(timeoutMs) {
        return new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Health check timed out after ${timeoutMs}ms`));
            }, timeoutMs);
        });
    }
    getConfig() {
        return { ...this.config };
    }
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        if (this.isMonitoring) {
            this.stopMonitoring();
            this.startMonitoring();
        }
    }
    destroy() {
        this.stopMonitoring();
        this.providers.clear();
        this.healthResults.clear();
        this.healthHistory.clear();
    }
}
exports.HealthChecker = HealthChecker;
exports.globalHealthChecker = new HealthChecker();
async function checkHealth(providerName) {
    return exports.globalHealthChecker.checkProviderHealth(providerName);
}
async function checkAllHealth() {
    return exports.globalHealthChecker.checkAllProviders();
}
//# sourceMappingURL=health-checker.js.map
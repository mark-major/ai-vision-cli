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
exports.globalMetricsCollector = exports.MetricsCollector = exports.DEFAULT_METRICS_CONFIG = void 0;
exports.recordRequest = recordRequest;
exports.startTimer = startTimer;
exports.incrementCounter = incrementCounter;
exports.setGauge = setGauge;
exports.DEFAULT_METRICS_CONFIG = {
    enabled: true,
    retentionPeriod: 24 * 60 * 60 * 1000,
    maxMetrics: 10000,
    persistToDisk: false,
    flushInterval: 60000,
    enableAggregation: true,
    aggregationWindow: 5 * 60 * 1000,
};
class MetricsCollector {
    config;
    metrics = new Map();
    counters = new Map();
    gauges = new Map();
    histograms = new Map();
    startTime = new Date();
    flushTimer;
    constructor(config = {}) {
        this.config = { ...exports.DEFAULT_METRICS_CONFIG, ...config };
        this.startFlushTimer();
    }
    incrementCounter(name, value = 1, context) {
        if (!this.config.enabled)
            return;
        const currentCount = this.counters.get(name) || 0;
        this.counters.set(name, currentCount + value);
        const metric = {
            type: 'counter',
            value,
            timestamp: new Date(),
            count: currentCount + value,
            context,
        };
        this.addMetric(name, metric);
    }
    setGauge(name, value, context) {
        if (!this.config.enabled)
            return;
        this.gauges.set(name, value);
        const metric = {
            type: 'gauge',
            value,
            timestamp: new Date(),
            current: value,
            context,
        };
        this.addMetric(name, metric);
    }
    recordHistogram(name, value, buckets = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000], context) {
        if (!this.config.enabled)
            return;
        let histogram = this.histograms.get(name);
        if (!histogram) {
            histogram = {
                type: 'histogram',
                value,
                timestamp: new Date(),
                buckets: new Map(),
                count: 0,
                sum: 0,
                min: value,
                max: value,
                context,
            };
            for (const bucket of buckets) {
                histogram.buckets.set(bucket, 0);
            }
            this.histograms.set(name, histogram);
        }
        histogram.count++;
        histogram.sum += value;
        histogram.min = Math.min(histogram.min, value);
        histogram.max = Math.max(histogram.max, value);
        for (const [bucket, count] of histogram.buckets) {
            if (value <= bucket) {
                histogram.buckets.set(bucket, count + 1);
            }
        }
        this.addMetric(name, { ...histogram, value, timestamp: new Date(), context });
    }
    recordTimer(name, duration, context) {
        if (!this.config.enabled)
            return;
        const metric = {
            type: 'timer',
            value: duration,
            timestamp: new Date(),
            duration,
            context,
        };
        this.addMetric(name, metric);
    }
    startTimer(name, context) {
        const startTime = Date.now();
        return () => {
            const duration = Date.now() - startTime;
            this.recordTimer(name, duration, context);
            return duration;
        };
    }
    recordRequest(provider, operation, statusCode, responseTime, tokensUsed, context) {
        const isSuccess = statusCode >= 200 && statusCode < 400;
        this.incrementCounter(`requests.${provider}.${operation}`, 1, context);
        this.incrementCounter(`requests.${provider}`, 1, context);
        if (isSuccess) {
            this.incrementCounter(`requests.${provider}.${operation}.success`, 1, context);
            this.incrementCounter(`requests.${provider}.success`, 1, context);
        }
        else {
            this.incrementCounter(`requests.${provider}.${operation}.error`, 1, context);
            this.incrementCounter(`requests.${provider}.error`, 1, context);
        }
        this.recordHistogram(`response_time.${provider}.${operation}`, responseTime, undefined, context);
        this.recordHistogram(`response_time.${provider}`, responseTime, undefined, context);
        this.incrementCounter(`status_code.${provider}.${statusCode}`, 1, context);
        if (tokensUsed !== undefined) {
            this.recordHistogram(`tokens.${provider}.${operation}`, tokensUsed, undefined, context);
            this.incrementCounter(`tokens.${provider}.total`, tokensUsed, context);
        }
    }
    recordSystemMetrics() {
        if (!this.config.enabled)
            return;
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        this.setGauge('system.memory.rss', memUsage.rss);
        this.setGauge('system.memory.heap_used', memUsage.heapUsed);
        this.setGauge('system.memory.heap_total', memUsage.heapTotal);
        this.setGauge('system.memory.external', memUsage.external);
        this.setGauge('system.memory.array_buffers', memUsage.arrayBuffers);
        this.setGauge('system.cpu.user', cpuUsage.user);
        this.setGauge('system.cpu.system', cpuUsage.system);
        this.setGauge('system.uptime', process.uptime());
        this.setGauge('system.active_handles', process._getActiveHandles().length);
        this.setGauge('system.active_requests', process._getActiveRequests().length);
    }
    getPerformanceMetrics(provider, operation) {
        const prefix = operation ? `response_time.${provider}.${operation}` : `response_time.${provider}`;
        const requestPrefix = operation ? `requests.${provider}.${operation}` : `requests.${provider}`;
        const responseTimes = this.getMetricValues(prefix);
        const totalRequests = this.getCounterValue(requestPrefix);
        const successRequests = this.getCounterValue(`${requestPrefix}.success`);
        const errorRequests = this.getCounterValue(`${requestPrefix}.error`);
        if (responseTimes.length === 0) {
            return {
                requestCount: totalRequests,
                successCount: successRequests,
                errorCount: errorRequests,
                averageResponseTime: 0,
                minResponseTime: 0,
                maxResponseTime: 0,
                p95ResponseTime: 0,
                p99ResponseTime: 0,
                successRate: totalRequests > 0 ? successRequests / totalRequests : 0,
                errorRate: totalRequests > 0 ? errorRequests / totalRequests : 0,
                requestsPerMinute: this.calculateRequestsPerMinute(requestPrefix),
            };
        }
        const sortedTimes = responseTimes.sort((a, b) => a - b);
        const sum = sortedTimes.reduce((acc, val) => acc + val, 0);
        return {
            requestCount: totalRequests,
            successCount: successRequests,
            errorCount: errorRequests,
            averageResponseTime: sum / sortedTimes.length,
            minResponseTime: Math.min(...sortedTimes),
            maxResponseTime: Math.max(...sortedTimes),
            p95ResponseTime: this.getPercentile(sortedTimes, 95),
            p99ResponseTime: this.getPercentile(sortedTimes, 99),
            successRate: totalRequests > 0 ? successRequests / totalRequests : 0,
            errorRate: totalRequests > 0 ? errorRequests / totalRequests : 0,
            requestsPerMinute: this.calculateRequestsPerMinute(requestPrefix),
        };
    }
    getSystemMetrics() {
        return {
            memoryUsage: process.memoryUsage(),
            cpuUsage: process.cpuUsage(),
            uptime: process.uptime(),
            activeHandles: process._getActiveHandles()?.length || 0,
            activeRequests: process._getActiveRequests()?.length || 0,
        };
    }
    getProviderMetrics(provider) {
        const totalRequests = this.getCounterValue(`requests.${provider}`);
        const successRequests = this.getCounterValue(`requests.${provider}.success`);
        const failedRequests = this.getCounterValue(`requests.${provider}.error`);
        const responseTimes = this.getMetricValues(`response_time.${provider}`);
        const totalTokens = this.getCounterValue(`tokens.${provider}.total`);
        const rateLimitHits = this.getCounterValue(`rate_limit.${provider}`);
        const averageResponseTime = responseTimes.length > 0
            ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
            : 0;
        return {
            provider,
            totalRequests,
            successfulRequests: successRequests,
            failedRequests,
            averageResponseTime,
            totalTokensUsed: totalTokens,
            rateLimitHits,
            healthStatusChanges: this.getCounterValue(`health_changes.${provider}`),
            currentHealthStatus: 'healthy',
        };
    }
    getAllMetrics() {
        return new Map(this.metrics);
    }
    getMetricValues(name) {
        const metrics = this.metrics.get(name) || [];
        return metrics.map(m => m.value);
    }
    getCounterValue(name) {
        return this.counters.get(name) || 0;
    }
    getGaugeValue(name) {
        return this.gauges.get(name) || 0;
    }
    getHistogram(name) {
        return this.histograms.get(name);
    }
    resetMetrics() {
        this.metrics.clear();
        this.counters.clear();
        this.gauges.clear();
        this.histograms.clear();
        this.startTime = new Date();
    }
    resetMetric(name) {
        this.metrics.delete(name);
        this.counters.delete(name);
        this.gauges.delete(name);
        this.histograms.delete(name);
    }
    exportMetrics() {
        const exportData = {
            timestamp: new Date().toISOString(),
            startTime: this.startTime.toISOString(),
            metrics: Object.fromEntries(this.metrics),
            counters: Object.fromEntries(this.counters),
            gauges: Object.fromEntries(this.gauges),
            histograms: Object.fromEntries(this.histograms),
        };
        return JSON.stringify(exportData, null, 2);
    }
    cleanup() {
        const cutoffTime = Date.now() - this.config.retentionPeriod;
        for (const [name, metricList] of this.metrics) {
            const filteredMetrics = metricList.filter(m => m.timestamp.getTime() > cutoffTime);
            this.metrics.set(name, filteredMetrics);
        }
    }
    destroy() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }
        this.resetMetrics();
    }
    addMetric(name, metric) {
        if (!this.metrics.has(name)) {
            this.metrics.set(name, []);
        }
        const metricList = this.metrics.get(name);
        metricList.push(metric);
        if (metricList.length > this.config.maxMetrics) {
            metricList.splice(0, metricList.length - this.config.maxMetrics);
        }
        if (Math.random() < 0.01) {
            this.cleanup();
        }
    }
    getPercentile(sortedValues, percentile) {
        if (sortedValues.length === 0)
            return 0;
        const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
        return sortedValues[Math.max(0, index)];
    }
    calculateRequestsPerMinute(metricName) {
        const metrics = this.metrics.get(metricName) || [];
        const oneMinuteAgo = Date.now() - 60000;
        const recentMetrics = metrics.filter(m => m.timestamp.getTime() > oneMinuteAgo);
        return recentMetrics.length;
    }
    startFlushTimer() {
        if (this.config.flushInterval > 0) {
            this.flushTimer = setInterval(() => {
                if (this.config.persistToDisk && this.config.metricsFile) {
                    this.flushToDisk();
                }
                this.cleanup();
            }, this.config.flushInterval);
        }
    }
    async flushToDisk() {
        if (!this.config.metricsFile)
            return;
        try {
            const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
            await fs.writeFile(this.config.metricsFile, this.exportMetrics());
        }
        catch (error) {
            console.error('Failed to flush metrics to disk:', error);
        }
    }
}
exports.MetricsCollector = MetricsCollector;
exports.globalMetricsCollector = new MetricsCollector();
function recordRequest(provider, operation, statusCode, responseTime, tokensUsed, context) {
    exports.globalMetricsCollector.recordRequest(provider, operation, statusCode, responseTime, tokensUsed, context);
}
function startTimer(name, context) {
    return exports.globalMetricsCollector.startTimer(name, context);
}
function incrementCounter(name, value = 1, context) {
    exports.globalMetricsCollector.incrementCounter(name, value, context);
}
function setGauge(name, value, context) {
    exports.globalMetricsCollector.setGauge(name, value, context);
}
//# sourceMappingURL=metrics.js.map
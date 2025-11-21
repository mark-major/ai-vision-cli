export interface MetricValue {
    value: number;
    timestamp: Date;
    context?: Record<string, any>;
}
export interface CounterMetric extends MetricValue {
    type: 'counter';
    count: number;
}
export interface GaugeMetric extends MetricValue {
    type: 'gauge';
    current: number;
}
export interface HistogramMetric extends MetricValue {
    type: 'histogram';
    buckets: Map<number, number>;
    count: number;
    sum: number;
    min: number;
    max: number;
}
export interface TimerMetric extends MetricValue {
    type: 'timer';
    duration: number;
}
export type Metric = CounterMetric | GaugeMetric | HistogramMetric | TimerMetric;
export interface MetricsConfig {
    enabled: boolean;
    retentionPeriod: number;
    maxMetrics: number;
    persistToDisk: boolean;
    metricsFile?: string;
    flushInterval: number;
    enableAggregation: boolean;
    aggregationWindow: number;
}
export interface PerformanceMetrics {
    requestCount: number;
    successCount: number;
    errorCount: number;
    averageResponseTime: number;
    minResponseTime: number;
    maxResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    successRate: number;
    errorRate: number;
    requestsPerMinute: number;
}
export interface SystemMetrics {
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
    uptime: number;
    activeHandles: number;
    activeRequests: number;
}
export interface ProviderMetrics {
    provider: string;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    totalTokensUsed: number;
    rateLimitHits: number;
    healthStatusChanges: number;
    currentHealthStatus: 'healthy' | 'degraded' | 'unhealthy';
    lastError?: string;
}
export declare const DEFAULT_METRICS_CONFIG: MetricsConfig;
export declare class MetricsCollector {
    private config;
    private metrics;
    private counters;
    private gauges;
    private histograms;
    private startTime;
    private flushTimer?;
    constructor(config?: Partial<MetricsConfig>);
    incrementCounter(name: string, value?: number, context?: Record<string, any>): void;
    setGauge(name: string, value: number, context?: Record<string, any>): void;
    recordHistogram(name: string, value: number, buckets?: number[], context?: Record<string, any>): void;
    recordTimer(name: string, duration: number, context?: Record<string, any>): void;
    startTimer(name: string, context?: Record<string, any>): () => void;
    recordRequest(provider: string, operation: string, statusCode: number, responseTime: number, tokensUsed?: number, context?: Record<string, any>): void;
    recordSystemMetrics(): void;
    getPerformanceMetrics(provider: string, operation?: string): PerformanceMetrics;
    getSystemMetrics(): SystemMetrics;
    getProviderMetrics(provider: string): ProviderMetrics;
    getAllMetrics(): Map<string, Metric[]>;
    getMetricValues(name: string): number[];
    getCounterValue(name: string): number;
    getGaugeValue(name: string): number;
    getHistogram(name: string): HistogramMetric | undefined;
    resetMetrics(): void;
    resetMetric(name: string): void;
    exportMetrics(): string;
    cleanup(): void;
    destroy(): void;
    private addMetric;
    private getPercentile;
    private calculateRequestsPerMinute;
    private startFlushTimer;
    private flushToDisk;
}
export declare const globalMetricsCollector: MetricsCollector;
export declare function recordRequest(provider: string, operation: string, statusCode: number, responseTime: number, tokensUsed?: number, context?: Record<string, any>): void;
export declare function startTimer(name: string, context?: Record<string, any>): () => void;
export declare function incrementCounter(name: string, value?: number, context?: Record<string, any>): void;
export declare function setGauge(name: string, value: number, context?: Record<string, any>): void;
//# sourceMappingURL=metrics.d.ts.map
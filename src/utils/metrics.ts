/**
 * Metrics Collection System
 *
 * Provides comprehensive performance tracking, request metrics,
 * and system monitoring for the AI Vision CLI.
 */

export interface MetricValue {
  /** Numeric value */
  value: number;
  /** Timestamp */
  timestamp: Date;
  /** Additional context */
  context?: Record<string, any>;
}

export interface CounterMetric extends MetricValue {
  type: 'counter';
  /** Total count */
  count: number;
}

export interface GaugeMetric extends MetricValue {
  type: 'gauge';
  /** Current value */
  current: number;
}

export interface HistogramMetric extends MetricValue {
  type: 'histogram';
  /** Value buckets */
  buckets: Map<number, number>;
  /** Total count */
  count: number;
  /** Sum of all values */
  sum: number;
  /** Minimum value */
  min: number;
  /** Maximum value */
  max: number;
}

export interface TimerMetric extends MetricValue {
  type: 'timer';
  /** Duration in milliseconds */
  duration: number;
}

export type Metric = CounterMetric | GaugeMetric | HistogramMetric | TimerMetric;

export interface MetricsConfig {
  /** Whether to enable metrics collection */
  enabled: boolean;
  /** Retention period in milliseconds */
  retentionPeriod: number;
  /** Maximum number of metrics to keep */
  maxMetrics: number;
  /** Whether to persist metrics to disk */
  persistToDisk: boolean;
  /** Metrics file path */
  metricsFile?: string;
  /** Flush interval in milliseconds */
  flushInterval: number;
  /** Whether to aggregate metrics */
  enableAggregation: boolean;
  /** Aggregation window in milliseconds */
  aggregationWindow: number;
}

export interface PerformanceMetrics {
  /** Request count */
  requestCount: number;
  /** Success count */
  successCount: number;
  /** Error count */
  errorCount: number;
  /** Average response time */
  averageResponseTime: number;
  /** Minimum response time */
  minResponseTime: number;
  /** Maximum response time */
  maxResponseTime: number;
  /** 95th percentile response time */
  p95ResponseTime: number;
  /** 99th percentile response time */
  p99ResponseTime: number;
  /** Success rate */
  successRate: number;
  /** Error rate */
  errorRate: number;
  /** Requests per minute */
  requestsPerMinute: number;
}

export interface SystemMetrics {
  /** Memory usage */
  memoryUsage: NodeJS.MemoryUsage;
  /** CPU usage */
  cpuUsage: NodeJS.CpuUsage;
  /** Uptime in milliseconds */
  uptime: number;
  /** Active handles */
  activeHandles: number;
  /** Active requests */
  activeRequests: number;
}

export interface ProviderMetrics {
  /** Provider name */
  provider: string;
  /** Total requests */
  totalRequests: number;
  /** Successful requests */
  successfulRequests: number;
  /** Failed requests */
  failedRequests: number;
  /** Average response time */
  averageResponseTime: number;
  /** Total tokens used */
  totalTokensUsed: number;
  /** Rate limit hits */
  rateLimitHits: number;
  /** Health status changes */
  healthStatusChanges: number;
  /** Current health status */
  currentHealthStatus: 'healthy' | 'degraded' | 'unhealthy';
  /** Last error */
  lastError?: string;
}

/**
 * Default metrics configuration
 */
export const DEFAULT_METRICS_CONFIG: MetricsConfig = {
  enabled: true,
  retentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
  maxMetrics: 10000,
  persistToDisk: false,
  flushInterval: 60000, // 1 minute
  enableAggregation: true,
  aggregationWindow: 5 * 60 * 1000, // 5 minutes
};

/**
 * Metrics Collector
 */
export class MetricsCollector {
  private config: MetricsConfig;
  private metrics: Map<string, Metric[]> = new Map();
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, HistogramMetric> = new Map();
  private startTime: Date = new Date();
  private flushTimer?: NodeJS.Timeout;

  constructor(config: Partial<MetricsConfig> = {}) {
    this.config = { ...DEFAULT_METRICS_CONFIG, ...config };
    this.startFlushTimer();
  }

  /**
   * Increment a counter metric
   */
  incrementCounter(name: string, value: number = 1, context?: Record<string, any>): void {
    if (!this.config.enabled) return;

    const currentCount = this.counters.get(name) || 0;
    this.counters.set(name, currentCount + value);

    const metric: CounterMetric = {
      type: 'counter',
      value,
      timestamp: new Date(),
      count: currentCount + value,
      context,
    };

    this.addMetric(name, metric);
  }

  /**
   * Set a gauge metric
   */
  setGauge(name: string, value: number, context?: Record<string, any>): void {
    if (!this.config.enabled) return;

    this.gauges.set(name, value);

    const metric: GaugeMetric = {
      type: 'gauge',
      value,
      timestamp: new Date(),
      current: value,
      context,
    };

    this.addMetric(name, metric);
  }

  /**
   * Record a histogram metric
   */
  recordHistogram(name: string, value: number, buckets: number[] = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000], context?: Record<string, any>): void {
    if (!this.config.enabled) return;

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

      // Initialize buckets
      for (const bucket of buckets) {
        histogram.buckets.set(bucket, 0);
      }

      this.histograms.set(name, histogram);
    }

    // Update histogram
    histogram.count++;
    histogram.sum += value;
    histogram.min = Math.min(histogram.min, value);
    histogram.max = Math.max(histogram.max, value);

    // Update buckets
    for (const [bucket, count] of histogram.buckets) {
      if (value <= bucket) {
        histogram.buckets.set(bucket, count + 1);
      }
    }

    this.addMetric(name, { ...histogram, value, timestamp: new Date(), context });
  }

  /**
   * Record a timer metric
   */
  recordTimer(name: string, duration: number, context?: Record<string, any>): void {
    if (!this.config.enabled) return;

    const metric: TimerMetric = {
      type: 'timer',
      value: duration,
      timestamp: new Date(),
      duration,
      context,
    };

    this.addMetric(name, metric);
  }

  /**
   * Start a timer and return a function to end it
   */
  startTimer(name: string, context?: Record<string, any>): () => void {
    const startTime = Date.now();

    return () => {
      const duration = Date.now() - startTime;
      this.recordTimer(name, duration, context);
      return duration;
    };
  }

  /**
   * Record API request metrics
   */
  recordRequest(
    provider: string,
    operation: string,
    statusCode: number,
    responseTime: number,
    tokensUsed?: number,
    context?: Record<string, any>
  ): void {
    const isSuccess = statusCode >= 200 && statusCode < 400;

    // Request count
    this.incrementCounter(`requests.${provider}.${operation}`, 1, context);
    this.incrementCounter(`requests.${provider}`, 1, context);

    // Success/error counts
    if (isSuccess) {
      this.incrementCounter(`requests.${provider}.${operation}.success`, 1, context);
      this.incrementCounter(`requests.${provider}.success`, 1, context);
    } else {
      this.incrementCounter(`requests.${provider}.${operation}.error`, 1, context);
      this.incrementCounter(`requests.${provider}.error`, 1, context);
    }

    // Response time
    this.recordHistogram(`response_time.${provider}.${operation}`, responseTime, undefined, context);
    this.recordHistogram(`response_time.${provider}`, responseTime, undefined, context);

    // Status code
    this.incrementCounter(`status_code.${provider}.${statusCode}`, 1, context);

    // Tokens
    if (tokensUsed !== undefined) {
      this.recordHistogram(`tokens.${provider}.${operation}`, tokensUsed, undefined, context);
      this.incrementCounter(`tokens.${provider}.total`, tokensUsed, context);
    }
  }

  /**
   * Record system metrics
   */
  recordSystemMetrics(): void {
    if (!this.config.enabled) return;

    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Memory metrics
    this.setGauge('system.memory.rss', memUsage.rss);
    this.setGauge('system.memory.heap_used', memUsage.heapUsed);
    this.setGauge('system.memory.heap_total', memUsage.heapTotal);
    this.setGauge('system.memory.external', memUsage.external);
    this.setGauge('system.memory.array_buffers', memUsage.arrayBuffers);

    // CPU metrics
    this.setGauge('system.cpu.user', cpuUsage.user);
    this.setGauge('system.cpu.system', cpuUsage.system);

    // Process metrics
    this.setGauge('system.uptime', process.uptime());
    this.setGauge('system.active_handles', (process as any)._getActiveHandles().length);
    this.setGauge('system.active_requests', (process as any)._getActiveRequests().length);
  }

  /**
   * Get performance metrics for a provider
   */
  getPerformanceMetrics(provider: string, operation?: string): PerformanceMetrics {
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

  /**
   * Get system metrics
   */
  getSystemMetrics(): SystemMetrics {
    return {
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      uptime: process.uptime(),
      activeHandles: (process as any)._getActiveHandles()?.length || 0,
      activeRequests: (process as any)._getActiveRequests()?.length || 0,
    };
  }

  /**
   * Get provider metrics
   */
  getProviderMetrics(provider: string): ProviderMetrics {
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
      currentHealthStatus: 'healthy', // This would be updated by health checker
    };
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Map<string, Metric[]> {
    return new Map(this.metrics);
  }

  /**
   * Get metric values for a name
   */
  getMetricValues(name: string): number[] {
    const metrics = this.metrics.get(name) || [];
    return metrics.map(m => m.value);
  }

  /**
   * Get counter value
   */
  getCounterValue(name: string): number {
    return this.counters.get(name) || 0;
  }

  /**
   * Get gauge value
   */
  getGaugeValue(name: string): number {
    return this.gauges.get(name) || 0;
  }

  /**
   * Get histogram values
   */
  getHistogram(name: string): HistogramMetric | undefined {
    return this.histograms.get(name);
  }

  /**
   * Reset all metrics
   */
  resetMetrics(): void {
    this.metrics.clear();
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.startTime = new Date();
  }

  /**
   * Reset metrics for a specific name
   */
  resetMetric(name: string): void {
    this.metrics.delete(name);
    this.counters.delete(name);
    this.gauges.delete(name);
    this.histograms.delete(name);
  }

  /**
   * Export metrics to JSON
   */
  exportMetrics(): string {
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

  /**
   * Cleanup old metrics
   */
  cleanup(): void {
    const cutoffTime = Date.now() - this.config.retentionPeriod;

    for (const [name, metricList] of this.metrics) {
      const filteredMetrics = metricList.filter(m => m.timestamp.getTime() > cutoffTime);
      this.metrics.set(name, filteredMetrics);
    }
  }

  /**
   * Destroy metrics collector
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.resetMetrics();
  }

  /**
   * Add a metric to storage
   */
  private addMetric(name: string, metric: Metric): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metricList = this.metrics.get(name)!;
    metricList.push(metric);

    // Cleanup if we have too many metrics
    if (metricList.length > this.config.maxMetrics) {
      metricList.splice(0, metricList.length - this.config.maxMetrics);
    }

    // Cleanup old metrics periodically
    if (Math.random() < 0.01) { // 1% chance to cleanup
      this.cleanup();
    }
  }

  /**
   * Calculate percentile from sorted array
   */
  private getPercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, index)];
  }

  /**
   * Calculate requests per minute
   */
  private calculateRequestsPerMinute(metricName: string): number {
    const metrics = this.metrics.get(metricName) || [];
    const oneMinuteAgo = Date.now() - 60000;
    const recentMetrics = metrics.filter(m => m.timestamp.getTime() > oneMinuteAgo);
    return recentMetrics.length;
  }

  /**
   * Start flush timer
   */
  private startFlushTimer(): void {
    if (this.config.flushInterval > 0) {
      this.flushTimer = setInterval(() => {
        if (this.config.persistToDisk && this.config.metricsFile) {
          this.flushToDisk();
        }
        this.cleanup();
      }, this.config.flushInterval);
    }
  }

  /**
   * Flush metrics to disk
   */
  private async flushToDisk(): Promise<void> {
    if (!this.config.metricsFile) return;

    try {
      const fs = await import('fs/promises');
      await fs.writeFile(this.config.metricsFile, this.exportMetrics());
    } catch (error) {
      console.error('Failed to flush metrics to disk:', error);
    }
  }
}

/**
 * Global metrics collector instance
 */
export const globalMetricsCollector = new MetricsCollector();

/**
 * Convenience function to record a request
 */
export function recordRequest(
  provider: string,
  operation: string,
  statusCode: number,
  responseTime: number,
  tokensUsed?: number,
  context?: Record<string, any>
): void {
  globalMetricsCollector.recordRequest(provider, operation, statusCode, responseTime, tokensUsed, context);
}

/**
 * Convenience function to start a timer
 */
export function startTimer(name: string, context?: Record<string, any>): () => void {
  return globalMetricsCollector.startTimer(name, context);
}

/**
 * Convenience function to increment a counter
 */
export function incrementCounter(name: string, value: number = 1, context?: Record<string, any>): void {
  globalMetricsCollector.incrementCounter(name, value, context);
}

/**
 * Convenience function to set a gauge
 */
export function setGauge(name: string, value: number, context?: Record<string, any>): void {
  globalMetricsCollector.setGauge(name, value, context);
}
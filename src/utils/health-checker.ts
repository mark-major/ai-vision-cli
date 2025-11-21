/**
 * Health Check System
 *
 * Provides comprehensive health monitoring for AI providers with
 * connectivity checks, authentication validation, and performance metrics.
 */

import type { VisionProvider } from '../types/index.js';

export interface HealthCheckConfig {
  /** Interval between health checks in milliseconds */
  checkInterval: number;
  /** Timeout for individual health checks in milliseconds */
  timeout: number;
  /** Number of consecutive failures before marking as unhealthy */
  failureThreshold: number;
  /** Whether to enable detailed health checks */
  enableDetailedChecks: boolean;
  /** Whether to cache health check results */
  enableCaching: boolean;
  /** Cache duration for health check results in milliseconds */
  cacheDuration: number;
}

export interface HealthCheckResult {
  /** Provider name */
  provider: string;
  /** Health status */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Response time in milliseconds */
  responseTime: number;
  /** Last check timestamp */
  lastCheck: Date;
  /** Additional details about the health status */
  details: HealthCheckDetails;
  /** Error if health check failed */
  error?: string;
}

export interface HealthCheckDetails {
  /** Authentication status */
  authentication: boolean;
  /** Connectivity status */
  connectivity: boolean;
  /** API endpoint availability */
  endpointAvailable: boolean;
  /** Current rate limit status */
  rateLimitStatus?: {
    remaining: number;
    limit: number;
    resetTime: Date;
  };
  /** Service-specific details */
  serviceSpecific: Record<string, any>;
  /** Performance metrics */
  performance: {
    averageResponseTime: number;
    successRate: number;
    totalChecks: number;
    consecutiveFailures: number;
  };
}

export interface HealthHistory {
  /** Array of historical health check results */
  results: HealthCheckResult[];
  /** Maximum number of results to keep */
  maxResults: number;
}

/**
 * Default health check configuration
 */
export const DEFAULT_HEALTH_CHECK_CONFIG: HealthCheckConfig = {
  checkInterval: 300000, // 5 minutes
  timeout: 10000, // 10 seconds
  failureThreshold: 3,
  enableDetailedChecks: true,
  enableCaching: true,
  cacheDuration: 60000, // 1 minute
};

/**
 * Health Checker for monitoring provider health
 */
export class HealthChecker {
  private config: HealthCheckConfig;
  private providers: Map<string, VisionProvider> = new Map();
  private healthResults: Map<string, HealthCheckResult> = new Map();
  private healthHistory: Map<string, HealthHistory> = new Map();
  private checkIntervals: Map<string, NodeJS.Timeout> = new Map();
  private isMonitoring = false;

  constructor(config: Partial<HealthCheckConfig> = {}) {
    this.config = { ...DEFAULT_HEALTH_CHECK_CONFIG, ...config };
  }

  /**
   * Add a provider to monitor
   */
  addProvider(name: string, provider: VisionProvider): void {
    this.providers.set(name, provider);

    // Initialize health history
    if (!this.healthHistory.has(name)) {
      this.healthHistory.set(name, {
        results: [],
        maxResults: 100,
      });
    }

    // Start monitoring if not already running
    if (this.isMonitoring && !this.checkIntervals.has(name)) {
      this.startProviderMonitoring(name);
    }
  }

  /**
   * Remove a provider from monitoring
   */
  removeProvider(name: string): void {
    this.providers.delete(name);
    this.stopProviderMonitoring(name);
    this.healthResults.delete(name);
    this.healthHistory.delete(name);
  }

  /**
   * Start monitoring all providers
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    for (const providerName of this.providers.keys()) {
      this.startProviderMonitoring(providerName);
    }
  }

  /**
   * Stop monitoring all providers
   */
  stopMonitoring(): void {
    this.isMonitoring = false;
    for (const providerName of this.checkIntervals.keys()) {
      this.stopProviderMonitoring(providerName);
    }
  }

  /**
   * Perform health check for a specific provider
   */
  async checkProviderHealth(providerName: string): Promise<HealthCheckResult> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider ${providerName} not found`);
    }

    // Check cache first
    if (this.config.enableCaching) {
      const cachedResult = this.healthResults.get(providerName);
      if (cachedResult && this.isResultValid(cachedResult)) {
        return cachedResult;
      }
    }

    const startTime = Date.now();
    const result: HealthCheckResult = {
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
      // Perform health check with timeout
      const healthPromise = this.performDetailedHealthCheck(provider, result);
      const timeoutPromise = this.createTimeoutPromise(this.config.timeout);

      await Promise.race([healthPromise, timeoutPromise]);

      // Determine overall status
      result.status = this.determineHealthStatus(result.details);
      result.responseTime = Date.now() - startTime;

    } catch (error) {
      result.status = 'unhealthy';
      result.responseTime = Date.now() - startTime;
      result.error = error instanceof Error ? error.message : String(error);
    }

    // Update results and history
    this.healthResults.set(providerName, result);
    this.updateHealthHistory(providerName, result);

    return result;
  }

  /**
   * Get health status for all providers
   */
  async checkAllProviders(): Promise<Map<string, HealthCheckResult>> {
    const results = new Map<string, HealthCheckResult>();

    for (const providerName of this.providers.keys()) {
      try {
        const result = await this.checkProviderHealth(providerName);
        results.set(providerName, result);
      } catch (error) {
        const errorResult: HealthCheckResult = {
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

  /**
   * Get latest health result for a provider
   */
  getProviderHealth(providerName: string): HealthCheckResult | undefined {
    return this.healthResults.get(providerName);
  }

  /**
   * Get health history for a provider
   */
  getProviderHistory(providerName: string): HealthHistory | undefined {
    return this.healthHistory.get(providerName);
  }

  /**
   * Get all providers and their health status
   */
  getAllProviderHealth(): Map<string, HealthCheckResult> {
    return new Map(this.healthResults);
  }

  /**
   * Get healthy providers
   */
  getHealthyProviders(): string[] {
    const healthy: string[] = [];
    for (const [name, result] of this.healthResults) {
      if (result.status === 'healthy') {
        healthy.push(name);
      }
    }
    return healthy;
  }

  /**
   * Get unhealthy providers
   */
  getUnhealthyProviders(): string[] {
    const unhealthy: string[] = [];
    for (const [name, result] of this.healthResults) {
      if (result.status === 'unhealthy') {
        unhealthy.push(name);
      }
    }
    return unhealthy;
  }

  /**
   * Start monitoring for a specific provider
   */
  private startProviderMonitoring(providerName: string): void {
    const interval = setInterval(async () => {
      try {
        await this.checkProviderHealth(providerName);
      } catch (error) {
        console.error(`Health check failed for ${providerName}:`, error);
      }
    }, this.config.checkInterval);

    this.checkIntervals.set(providerName, interval);
  }

  /**
   * Stop monitoring for a specific provider
   */
  private stopProviderMonitoring(providerName: string): void {
    const interval = this.checkIntervals.get(providerName);
    if (interval) {
      clearInterval(interval);
      this.checkIntervals.delete(providerName);
    }
  }

  /**
   * Perform detailed health check
   */
  private async performDetailedHealthCheck(
    provider: VisionProvider,
    result: HealthCheckResult
  ): Promise<void> {
    // Get provider info
    const providerInfo = provider.getProviderInfo();
    result.details.serviceSpecific = {
      version: providerInfo.version,
      capabilities: providerInfo.capabilities,
    };

    // Perform basic connectivity check
    try {
      const healthStatus = await provider.healthCheck();
      result.details.connectivity = healthStatus.status === 'healthy';
      result.details.authentication = healthStatus.status !== 'unhealthy';
      result.details.endpointAvailable = healthStatus.status !== 'unhealthy';

          } catch (error) {
      result.details.connectivity = false;
      result.details.authentication = false;
      result.details.endpointAvailable = false;
      throw error;
    }
  }

  /**
   * Determine overall health status
   */
  private determineHealthStatus(details: HealthCheckDetails): 'healthy' | 'degraded' | 'unhealthy' {
    const { authentication, connectivity, endpointAvailable } = details;

    if (!connectivity || !endpointAvailable) {
      return 'unhealthy';
    }

    if (!authentication) {
      return 'degraded';
    }

    // Check performance metrics
    const history = this.getProviderHistory('');
    if (history && history.results.length > 0) {
      const recentResults = history.results.slice(-5);
      const avgResponseTime = recentResults.reduce((sum, r) => sum + r.responseTime, 0) / recentResults.length;

      if (avgResponseTime > 10000) { // 10 seconds
        return 'degraded';
      }
    }

    return 'healthy';
  }

  /**
   * Check if cached result is still valid
   */
  private isResultValid(result: HealthCheckResult): boolean {
    const now = Date.now();
    const resultTime = result.lastCheck.getTime();
    return (now - resultTime) < this.config.cacheDuration;
  }

  /**
   * Update health history for a provider
   */
  private updateHealthHistory(providerName: string, result: HealthCheckResult): void {
    const history = this.healthHistory.get(providerName);
    if (history) {
      history.results.push(result);

      // Keep only the specified number of results
      if (history.results.length > history.maxResults) {
        history.results = history.results.slice(-history.maxResults);
      }

      // Update performance metrics
      this.updatePerformanceMetrics(history);
    }
  }

  /**
   * Update performance metrics in health history
   */
  private updatePerformanceMetrics(history: HealthHistory): void {
    if (history.results.length === 0) {
      return;
    }

    const recentResults = history.results.slice(-10); // Last 10 results
    const totalResponseTime = recentResults.reduce((sum, r) => sum + r.responseTime, 0);
    const successCount = recentResults.filter(r => r.status === 'healthy').length;

    const performance = {
      averageResponseTime: totalResponseTime / recentResults.length,
      successRate: successCount / recentResults.length,
      totalChecks: history.results.length,
      consecutiveFailures: this.calculateConsecutiveFailures(recentResults),
    };

    // Update the latest result with performance metrics
    if (history.results.length > 0) {
      history.results[history.results.length - 1].details.performance = performance;
    }
  }

  /**
   * Calculate consecutive failures
   */
  private calculateConsecutiveFailures(results: HealthCheckResult[]): number {
    let consecutiveFailures = 0;
    for (let i = results.length - 1; i >= 0; i--) {
      if (results[i].status !== 'healthy') {
        consecutiveFailures++;
      } else {
        break;
      }
    }
    return consecutiveFailures;
  }

  /**
   * Create a timeout promise
   */
  private createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Health check timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  /**
   * Get current configuration
   */
  getConfig(): HealthCheckConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<HealthCheckConfig>): void {
    this.config = { ...this.config, ...config };

    // Restart monitoring if interval changed
    if (this.isMonitoring) {
      this.stopMonitoring();
      this.startMonitoring();
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopMonitoring();
    this.providers.clear();
    this.healthResults.clear();
    this.healthHistory.clear();
  }
}

/**
 * Global health checker instance
 */
export const globalHealthChecker = new HealthChecker();

/**
 * Convenience function to check provider health
 */
export async function checkHealth(providerName: string): Promise<HealthCheckResult> {
  return globalHealthChecker.checkProviderHealth(providerName);
}

/**
 * Convenience function to check all providers health
 */
export async function checkAllHealth(): Promise<Map<string, HealthCheckResult>> {
  return globalHealthChecker.checkAllProviders();
}
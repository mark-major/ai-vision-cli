
export enum CircuitState {
  CLOSED = 'closed',      // Normal operation
  OPEN = 'open',          // Failing, reject requests
  HALF_OPEN = 'half_open' // Testing if service has recovered
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  monitoringPeriod: number;
  resetTimeout: number;
  successThreshold: number;
  trackErrorTypes: boolean;
  criticalErrorTypes: string[];
  persistState: boolean;
  stateFile?: string;
  enableHealthChecks: boolean;
  healthCheckInterval: number;
}

export interface CircuitBreakerState {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  lastStateChange: Date;
  totalRequests: number;
  errorCounts: Map<string, number>;
  performance: {
    averageResponseTime: number;
    lastResponseTime: number;
    responseTimes: number[];
  };
}

export interface CircuitBreakerResult {
  allowed: boolean;
  state: CircuitState;
  reason?: string;
  waitTime?: number;
}

/**
 * Circuit Breaker for a single provider
 */
export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: CircuitBreakerState;
  private healthCheckTimer?: NodeJS.Timeout;
  private responseTimes: number[] = [];
  private readonly maxResponseTimes = 100; // Keep last 100 response times

  constructor(name: string, config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config };
    this.state = this.initializeState(name);

    // Load persisted state if enabled
    if (this.config.persistState && this.config.stateFile) {
      this.loadState();
    }

    // Start health checks if enabled
    if (this.config.enableHealthChecks) {
      this.startHealthChecks();
    }
  }

  /**
   * Check if a request is allowed through the circuit breaker
   */
  async canExecute(): Promise<CircuitBreakerResult> {
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

  /**
   * Record a successful execution
   */
  recordSuccess(responseTime?: number): void {
    this.state.totalRequests++;
    this.state.successCount++;
    this.state.lastSuccessTime = new Date();

    if (responseTime !== undefined) {
      this.recordResponseTime(responseTime);
    }

    // Clear any previous failure counts on success
    if (this.state.state === CircuitState.CLOSED) {
      this.state.failureCount = 0;
    }

    // Check if we should close the circuit
    if (this.state.state === CircuitState.HALF_OPEN) {
      if (this.state.successCount >= this.config.successThreshold) {
        this.transitionToClosed();
      }
    }

    // Persist state if enabled
    if (this.config.persistState) {
      this.saveState();
    }
  }

  /**
   * Record a failed execution
   */
  recordFailure(error: Error, responseTime?: number): void {
    this.state.totalRequests++;
    this.state.failureCount++;
    this.state.lastFailureTime = new Date();

    if (responseTime !== undefined) {
      this.recordResponseTime(responseTime);
    }

    // Track error types if enabled
    if (this.config.trackErrorTypes) {
      const errorType = error.name || 'Unknown';
      const currentCount = this.state.errorCounts.get(errorType) || 0;
      this.state.errorCounts.set(errorType, currentCount + 1);

      // Check if this is a critical error type
      if (this.config.criticalErrorTypes.includes(errorType)) {
        this.transitionToOpen();
        return;
      }
    }

    // Check if we should open the circuit
    if (this.state.state === CircuitState.CLOSED) {
      if (this.state.failureCount >= this.config.failureThreshold) {
        this.transitionToOpen();
      }
    } else if (this.state.state === CircuitState.HALF_OPEN) {
      // Any failure in HALF_OPEN state should open the circuit
      this.transitionToOpen();
    }

    // Persist state if enabled
    if (this.config.persistState) {
      this.saveState();
    }
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitBreakerState {
    return { ...this.state };
  }

  /**
   * Get current circuit state enum
   */
  getCurrentState(): CircuitState {
    return this.state.state;
  }

  /**
   * Reset the circuit breaker to CLOSED state
   */
  reset(): void {
    this.state.state = CircuitState.CLOSED;
    this.state.failureCount = 0;
    this.state.successCount = 0;
    this.state.totalRequests = 0;
    this.state.lastStateChange = new Date();
    this.state.errorCounts.clear();
    this.responseTimes = [];

    // Persist state if enabled
    if (this.config.persistState) {
      this.saveState();
    }
  }

  /**
   * Get statistics about the circuit breaker
   */
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

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CircuitBreakerConfig>): void {
    this.config = { ...this.config, ...config };

    // Restart health checks if interval changed
    if (this.config.enableHealthChecks && this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.startHealthChecks();
    }
  }

  /**
   * Destroy the circuit breaker
   */
  destroy(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
  }

  /**
   * Initialize circuit breaker state
   */
  private initializeState(_name: string): CircuitBreakerState {
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

  /**
   * Transition to OPEN state
   */
  private transitionToOpen(): void {
    this.state.state = CircuitState.OPEN;
    this.state.lastStateChange = new Date();
    this.state.successCount = 0; // Reset success count for next HALF_OPEN attempt
  }

  /**
   * Transition to HALF_OPEN state
   */
  private transitionToHalfOpen(): void {
    this.state.state = CircuitState.HALF_OPEN;
    this.state.lastStateChange = new Date();
    this.state.successCount = 0;
  }

  /**
   * Transition to CLOSED state
   */
  private transitionToClosed(): void {
    this.state.state = CircuitState.CLOSED;
    this.state.lastStateChange = new Date();
    this.state.failureCount = 0;
    this.state.successCount = 0;
  }

  /**
   * Record response time for metrics
   */
  private recordResponseTime(responseTime: number): void {
    this.responseTimes.push(responseTime);

    // Keep only the last N response times
    if (this.responseTimes.length > this.maxResponseTimes) {
      this.responseTimes.shift();
    }

    // Update performance metrics
    this.state.performance.lastResponseTime = responseTime;
    this.state.performance.averageResponseTime =
      this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length;
  }

  /**
   * Clean up old metrics outside monitoring period
   */
  private cleanupOldMetrics(): void {
    // This would clean up old failures/successes outside the monitoring period
    // For now, we'll implement a simple version that resets counters periodically
    const timeSinceLastChange = Date.now() - this.state.lastStateChange.getTime();
    if (timeSinceLastChange > this.config.monitoringPeriod * 2) {
      if (this.state.state === CircuitState.CLOSED) {
        this.state.failureCount = 0;
        this.state.successCount = 0;
      }
    }
  }

  /**
   * Start health checks
   */
  private startHealthChecks(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<void> {
    // This would be implemented by the specific provider
    // For now, it's a placeholder that would be overridden
  }

  /**
   * Save state to file
   */
  private async saveState(): Promise<void> {
    if (!this.config.stateFile) return;

    try {
      const fs = await import('fs/promises');
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
    } catch (error) {
      console.error('Failed to save circuit breaker state:', error);
    }
  }

  /**
   * Load state from file
   */
  private async loadState(): Promise<void> {
    if (!this.config.stateFile) return;

    try {
      const fs = await import('fs/promises');
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
    } catch (error) {
      // File doesn't exist or is invalid, start with default state
      console.warn('Could not load circuit breaker state, using defaults:', error);
    }
  }
}

/**
 * Default circuit breaker configuration
 */
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  monitoringPeriod: 60000, // 1 minute
  resetTimeout: 300000, // 5 minutes
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
  healthCheckInterval: 30000, // 30 seconds
};

/**
 * Multi-Provider Circuit Breaker Manager
 */
export class CircuitBreakerManager {
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  /**
   * Add a circuit breaker for a provider
   */
  addProvider(providerName: string, config?: Partial<CircuitBreakerConfig>): void {
    const circuitBreaker = new CircuitBreaker(providerName, config);
    this.circuitBreakers.set(providerName, circuitBreaker);
  }

  /**
   * Remove a provider
   */
  removeProvider(providerName: string): void {
    const circuitBreaker = this.circuitBreakers.get(providerName);
    if (circuitBreaker) {
      circuitBreaker.destroy();
      this.circuitBreakers.delete(providerName);
    }
  }

  /**
   * Check if a provider can execute requests
   */
  async canExecute(providerName: string): Promise<CircuitBreakerResult> {
    const circuitBreaker = this.circuitBreakers.get(providerName);
    if (!circuitBreaker) {
      // If no circuit breaker exists, allow execution
      return { allowed: true, state: CircuitState.CLOSED };
    }

    return circuitBreaker.canExecute();
  }

  /**
   * Record successful execution for a provider
   */
  recordSuccess(providerName: string, responseTime?: number): void {
    const circuitBreaker = this.circuitBreakers.get(providerName);
    if (circuitBreaker) {
      circuitBreaker.recordSuccess(responseTime);
    }
  }

  /**
   * Record failed execution for a provider
   */
  recordFailure(providerName: string, error: Error, responseTime?: number): void {
    const circuitBreaker = this.circuitBreakers.get(providerName);
    if (circuitBreaker) {
      circuitBreaker.recordFailure(error, responseTime);
    }
  }

  /**
   * Get available providers (those whose circuits are not OPEN)
   */
  getAvailableProviders(): string[] {
    const available: string[] = [];
    for (const [providerName, circuitBreaker] of this.circuitBreakers) {
      const state = circuitBreaker.getCurrentState();
      if (state !== CircuitState.OPEN) {
        available.push(providerName);
      }
    }
    return available;
  }

  /**
   * Get best available provider based on circuit state
   */
  getBestProvider(): string | null {
    const available = this.getAvailableProviders();
    if (available.length === 0) {
      return null;
    }

    // Prefer CLOSED over HALF_OPEN
    const closedProviders = available.filter(provider => {
      const circuitBreaker = this.circuitBreakers.get(provider);
      return circuitBreaker?.getCurrentState() === CircuitState.CLOSED;
    });

    if (closedProviders.length > 0) {
      return closedProviders[0];
    }

    return available[0];
  }

  /**
   * Get statistics for all providers
   */
  getAllStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    for (const [providerName, circuitBreaker] of this.circuitBreakers) {
      stats[providerName] = circuitBreaker.getStats();
    }
    return stats;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const circuitBreaker of this.circuitBreakers.values()) {
      circuitBreaker.reset();
    }
  }

  /**
   * Destroy all circuit breakers
   */
  destroy(): void {
    for (const circuitBreaker of this.circuitBreakers.values()) {
      circuitBreaker.destroy();
    }
    this.circuitBreakers.clear();
  }
}

/**
 * Global circuit breaker manager instance
 */
export const globalCircuitBreakerManager = new CircuitBreakerManager();

/**
 * Convenience function to check if provider can execute
 */
export async function canExecuteProvider(providerName: string): Promise<CircuitBreakerResult> {
  return globalCircuitBreakerManager.canExecute(providerName);
}

/**
 * Convenience function to record provider success
 */
export function recordProviderSuccess(providerName: string, responseTime?: number): void {
  globalCircuitBreakerManager.recordSuccess(providerName, responseTime);
}

/**
 * Convenience function to record provider failure
 */
export function recordProviderFailure(providerName: string, error: Error, responseTime?: number): void {
  globalCircuitBreakerManager.recordFailure(providerName, error, responseTime);
}
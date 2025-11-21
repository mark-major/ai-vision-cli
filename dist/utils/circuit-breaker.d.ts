export declare enum CircuitState {
    CLOSED = "closed",
    OPEN = "open",
    HALF_OPEN = "half_open"
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
export declare class CircuitBreaker {
    private config;
    private state;
    private healthCheckTimer?;
    private responseTimes;
    private readonly maxResponseTimes;
    constructor(name: string, config?: Partial<CircuitBreakerConfig>);
    canExecute(): Promise<CircuitBreakerResult>;
    recordSuccess(responseTime?: number): void;
    recordFailure(error: Error, responseTime?: number): void;
    getState(): CircuitBreakerState;
    getCurrentState(): CircuitState;
    reset(): void;
    getStats(): {
        state: CircuitState;
        totalRequests: number;
        successCount: number;
        failureCount: number;
        successRate: number;
        failureRate: number;
        averageResponseTime: number;
        lastFailureTime: Date | undefined;
        lastSuccessTime: Date | undefined;
        lastStateChange: Date;
        errorCounts: {
            [k: string]: number;
        };
    };
    updateConfig(config: Partial<CircuitBreakerConfig>): void;
    destroy(): void;
    private initializeState;
    private transitionToOpen;
    private transitionToHalfOpen;
    private transitionToClosed;
    private recordResponseTime;
    private cleanupOldMetrics;
    private startHealthChecks;
    private performHealthCheck;
    private saveState;
    private loadState;
}
export declare const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig;
export declare class CircuitBreakerManager {
    private circuitBreakers;
    addProvider(providerName: string, config?: Partial<CircuitBreakerConfig>): void;
    removeProvider(providerName: string): void;
    canExecute(providerName: string): Promise<CircuitBreakerResult>;
    recordSuccess(providerName: string, responseTime?: number): void;
    recordFailure(providerName: string, error: Error, responseTime?: number): void;
    getAvailableProviders(): string[];
    getBestProvider(): string | null;
    getAllStats(): Record<string, any>;
    resetAll(): void;
    destroy(): void;
}
export declare const globalCircuitBreakerManager: CircuitBreakerManager;
export declare function canExecuteProvider(providerName: string): Promise<CircuitBreakerResult>;
export declare function recordProviderSuccess(providerName: string, responseTime?: number): void;
export declare function recordProviderFailure(providerName: string, error: Error, responseTime?: number): void;
//# sourceMappingURL=circuit-breaker.d.ts.map
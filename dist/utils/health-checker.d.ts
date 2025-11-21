import type { VisionProvider } from '../types/index.js';
export interface HealthCheckConfig {
    checkInterval: number;
    timeout: number;
    failureThreshold: number;
    enableDetailedChecks: boolean;
    enableCaching: boolean;
    cacheDuration: number;
}
export interface HealthCheckResult {
    provider: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    responseTime: number;
    lastCheck: Date;
    details: HealthCheckDetails;
    error?: string;
}
export interface HealthCheckDetails {
    authentication: boolean;
    connectivity: boolean;
    endpointAvailable: boolean;
    rateLimitStatus?: {
        remaining: number;
        limit: number;
        resetTime: Date;
    };
    serviceSpecific: Record<string, any>;
    performance: {
        averageResponseTime: number;
        successRate: number;
        totalChecks: number;
        consecutiveFailures: number;
    };
}
export interface HealthHistory {
    results: HealthCheckResult[];
    maxResults: number;
}
export declare const DEFAULT_HEALTH_CHECK_CONFIG: HealthCheckConfig;
export declare class HealthChecker {
    private config;
    private providers;
    private healthResults;
    private healthHistory;
    private checkIntervals;
    private isMonitoring;
    constructor(config?: Partial<HealthCheckConfig>);
    addProvider(name: string, provider: VisionProvider): void;
    removeProvider(name: string): void;
    startMonitoring(): void;
    stopMonitoring(): void;
    checkProviderHealth(providerName: string): Promise<HealthCheckResult>;
    checkAllProviders(): Promise<Map<string, HealthCheckResult>>;
    getProviderHealth(providerName: string): HealthCheckResult | undefined;
    getProviderHistory(providerName: string): HealthHistory | undefined;
    getAllProviderHealth(): Map<string, HealthCheckResult>;
    getHealthyProviders(): string[];
    getUnhealthyProviders(): string[];
    private startProviderMonitoring;
    private stopProviderMonitoring;
    private performDetailedHealthCheck;
    private determineHealthStatus;
    private isResultValid;
    private updateHealthHistory;
    private updatePerformanceMetrics;
    private calculateConsecutiveFailures;
    private createTimeoutPromise;
    getConfig(): HealthCheckConfig;
    updateConfig(config: Partial<HealthCheckConfig>): void;
    destroy(): void;
}
export declare const globalHealthChecker: HealthChecker;
export declare function checkHealth(providerName: string): Promise<HealthCheckResult>;
export declare function checkAllHealth(): Promise<Map<string, HealthCheckResult>>;
//# sourceMappingURL=health-checker.d.ts.map
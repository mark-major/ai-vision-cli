import { CLIConfig } from '../types/index.js';
export declare class ConfigService {
    private static instance;
    private config;
    private configPath;
    private defaultConfigPath;
    private constructor();
    static getInstance(): ConfigService;
    private loadEnvVars;
    setConfigPath(path: string): void;
    loadConfig(): Promise<CLIConfig>;
    saveConfig(config: CLIConfig): Promise<void>;
    createConfigFile(overridePath?: string): Promise<string>;
    private getDefaultConfig;
    private mergeWithEnvironment;
    private mergePhase5Config;
    private mergeAIParameter;
    private formatFileSize;
    parseFileSize(sizeStr: string): number;
    getConfigValue(path: string): Promise<unknown>;
    setConfigValue(path: string, value: unknown): Promise<void>;
    getConfigPath(): string;
    resetCache(): void;
    getRetryConfig(): Promise<NonNullable<CLIConfig['retry']>>;
    getHealthCheckConfig(): Promise<NonNullable<CLIConfig['health_check']>>;
    getRateLimitingConfig(): Promise<NonNullable<CLIConfig['rate_limiting']>>;
    getCircuitBreakerConfig(): Promise<NonNullable<CLIConfig['circuit_breaker']>>;
    getMetricsConfig(): Promise<NonNullable<CLIConfig['metrics']>>;
    isFeatureEnabled(feature: 'retry' | 'health_check' | 'rate_limiting' | 'circuit_breaker' | 'metrics'): Promise<boolean>;
    createPhase5ConfigFile(overridePath?: string): Promise<string>;
    validatePhase5Config(config: Partial<CLIConfig>): {
        valid: boolean;
        errors: string[];
    };
}
//# sourceMappingURL=ConfigService.d.ts.map
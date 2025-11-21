export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export interface LogEntry {
    level: LogLevel;
    timestamp: string;
    message: string;
    correlationId: string;
    module?: string;
    context?: Record<string, any>;
    error?: {
        name: string;
        message: string;
        stack?: string;
        code?: string;
    };
    performance?: {
        duration?: number;
        memoryUsage?: NodeJS.MemoryUsage;
        cpuUsage?: NodeJS.CpuUsage;
    };
    request?: {
        method?: string;
        url?: string;
        statusCode?: number;
        userAgent?: string;
        ip?: string;
    };
    provider?: {
        name: string;
        operation: string;
        model?: string;
        tokens?: number;
    };
}
export interface LoggerConfig {
    level: LogLevel;
    jsonOutput: boolean;
    includeTimestamp: boolean;
    includeCorrelationId: boolean;
    logFile?: string;
    maxFileSize: number;
    maxBackupFiles: number;
    enableConsole: boolean;
    enablePerformanceLogging: boolean;
    modules: string[];
}
export interface LogFilter {
    levels?: LogLevel[];
    modules?: string[];
    correlationIds?: string[];
    timeRange?: {
        start: Date;
        end: Date;
    };
}
export declare const DEFAULT_LOGGER_CONFIG: LoggerConfig;
export declare class Logger {
    private config;
    private currentCorrelationId;
    private currentModule?;
    private performanceStart;
    constructor(config?: Partial<LoggerConfig>);
    setCorrelationId(correlationId: string): void;
    getCorrelationId(): string;
    generateCorrelationId(): string;
    setModule(module: string): void;
    debug(message: string, context?: Record<string, any>): void;
    info(message: string, context?: Record<string, any>): void;
    warn(message: string, context?: Record<string, any>): void;
    error(message: string, error?: Error, context?: Record<string, any>): void;
    logRequest(method: string, url: string, statusCode: number, duration: number, context?: Record<string, any>): void;
    logProvider(providerName: string, operation: string, model?: string, tokens?: number, context?: Record<string, any>): void;
    startTimer(operation: string): string;
    endTimer(timerId: string, operation: string, context?: Record<string, any>): number;
    logPerformance(operation: string, metrics: Record<string, number>, context?: Record<string, any>): void;
    child(context: Record<string, any>): ChildLogger;
    private writeLogEntry;
    private createLogEntry;
    private shouldLog;
    private formatLogEntry;
    private writeToConsole;
    private writeToFile;
    private rotateLogFileIfNeeded;
    private getLevelFromStatusCode;
    updateConfig(config: Partial<LoggerConfig>): void;
    getConfig(): LoggerConfig;
}
export declare class ChildLogger {
    private parent;
    private context;
    constructor(parent: Logger, context: Record<string, any>);
    debug(message: string, additionalContext?: Record<string, any>): void;
    info(message: string, additionalContext?: Record<string, any>): void;
    warn(message: string, additionalContext?: Record<string, any>): void;
    error(message: string, error?: Error, additionalContext?: Record<string, any>): void;
    child(additionalContext: Record<string, any>): ChildLogger;
    setCorrelationId(correlationId: string): void;
    generateCorrelationId(): string;
}
export declare const logger: Logger;
export declare function createLogger(module: string, config?: Partial<LoggerConfig>): Logger;
export declare function getLogLevelFromEnv(): LogLevel;
//# sourceMappingURL=logger.d.ts.map

import { randomUUID } from 'crypto';
import fs from 'fs/promises';

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

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export const DEFAULT_LOGGER_CONFIG: LoggerConfig = {
  level: 'info',
  jsonOutput: false,
  includeTimestamp: true,
  includeCorrelationId: true,
  maxFileSize: 10 * 1024 * 1024,
  maxBackupFiles: 5,
  enableConsole: true,
  enablePerformanceLogging: false,
  modules: [],
};
export class Logger {
  private config: LoggerConfig;
  private currentCorrelationId: string;
  private currentModule?: string;
  private performanceStart: Map<string, number> = new Map();

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_LOGGER_CONFIG, ...config };
    this.currentCorrelationId = randomUUID();
  }

  setCorrelationId(correlationId: string): void {
    this.currentCorrelationId = correlationId;
  }

  getCorrelationId(): string {
    return this.currentCorrelationId;
  }

  generateCorrelationId(): string {
    this.currentCorrelationId = randomUUID();
    return this.currentCorrelationId;
  }

  setModule(module: string): void {
    this.currentModule = module;
  }

  debug(message: string, context?: Record<string, any>): void {
    this.writeLogEntry(this.createLogEntry('debug', message, context));
  }

  info(message: string, context?: Record<string, any>): void {
    this.writeLogEntry(this.createLogEntry('info', message, context));
  }

  warn(message: string, context?: Record<string, any>): void {
    this.writeLogEntry(this.createLogEntry('warn', message, context));
  }

  error(message: string, error?: Error, context?: Record<string, any>): void {
    const logEntry = this.createLogEntry('error', message, context);

    if (error) {
      logEntry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
      };
    }

    this.writeLogEntry(logEntry);
  }

  logRequest(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    context?: Record<string, any>
  ): void {
    const logEntry = this.createLogEntry(
      this.getLevelFromStatusCode(statusCode),
      `${method} ${url} - ${statusCode}`,
      context
    );

    logEntry.request = {
      method,
      url,
      statusCode,
      userAgent: context?.userAgent,
      ip: context?.ip,
    };

    if (this.config.enablePerformanceLogging) {
      logEntry.performance = {
        duration,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
      };
    }

    this.writeLogEntry(logEntry);
  }

  logProvider(
    providerName: string,
    operation: string,
    model?: string,
    tokens?: number,
    context?: Record<string, any>
  ): void {
    const logEntry = this.createLogEntry(
      'info',
      `Provider ${providerName} - ${operation}`,
      context
    );

    logEntry.provider = {
      name: providerName,
      operation,
      model,
      tokens,
    };

    this.writeLogEntry(logEntry);
  }

  startTimer(operation: string): string {
    const timerId = randomUUID();
    this.performanceStart.set(timerId, Date.now());
    this.debug(`Started timer for ${operation}`, { timerId, operation });
    return timerId;
  }

  endTimer(timerId: string, operation: string, context?: Record<string, any>): number {
    const startTime = this.performanceStart.get(timerId);
    if (!startTime) {
      this.warn(`Timer not found for ${operation}`, { timerId });
      return 0;
    }

    const duration = Date.now() - startTime;
    this.performanceStart.delete(timerId);

    const logEntry = this.createLogEntry('debug', `Completed ${operation}`, context);
    logEntry.performance = {
      duration,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
    };

    this.writeLogEntry(logEntry);
    return duration;
  }

  logPerformance(operation: string, metrics: Record<string, number>, context?: Record<string, any>): void {
    const logEntry = this.createLogEntry('debug', `Performance: ${operation}`, context);
    logEntry.performance = {
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
    };

    logEntry.context = {
      ...logEntry.context,
      ...metrics,
    };

    this.writeLogEntry(logEntry);
  }

  child(context: Record<string, any>): ChildLogger {
    return new ChildLogger(this, context);
  }

  private writeLogEntry(logEntry: LogEntry): void {
    if (!this.shouldLog(logEntry)) {
      return;
    }

    const formattedEntry = this.formatLogEntry(logEntry);

    if (this.config.enableConsole) {
      this.writeToConsole(formattedEntry, logEntry.level);
    }

    if (this.config.logFile) {
      this.writeToFile(formattedEntry);
    }
  }

  private createLogEntry(level: LogLevel, message: string, context?: Record<string, any>): LogEntry {
    return {
      level,
      timestamp: new Date().toISOString(),
      message,
      correlationId: this.config.includeCorrelationId ? this.currentCorrelationId : '',
      module: this.currentModule,
      context,
    };
  }

  private shouldLog(logEntry: LogEntry): boolean {
    if (LOG_LEVELS[logEntry.level] < LOG_LEVELS[this.config.level]) {
      return false;
    }

    if (this.config.modules.length > 0 && logEntry.module) {
      if (!this.config.modules.includes(logEntry.module)) {
        return false;
      }
    }

    return true;
  }

  private formatLogEntry(logEntry: LogEntry): string {
    if (this.config.jsonOutput) {
      return JSON.stringify(logEntry);
    }

    let formatted = '';

    if (this.config.includeTimestamp) {
      formatted += `[${logEntry.timestamp}] `;
    }

    if (this.config.includeCorrelationId && logEntry.correlationId) {
      formatted += `[${logEntry.correlationId.substring(0, 8)}] `;
    }

    formatted += `[${logEntry.level.toUpperCase()}]`;

    if (logEntry.module) {
      formatted += ` [${logEntry.module}]`;
    }

    formatted += ` ${logEntry.message}`;

    if (logEntry.context && Object.keys(logEntry.context).length > 0) {
      formatted += ` ${JSON.stringify(logEntry.context)}`;
    }

    if (logEntry.error) {
      formatted += ` Error: ${logEntry.error.name}: ${logEntry.error.message}`;
      if (this.config.level === 'debug' && logEntry.error.stack) {
        formatted += `\n${logEntry.error.stack}`;
      }
    }

    return formatted;
  }

  private writeToConsole(formattedEntry: string, level: LogLevel): void {
    switch (level) {
      case 'debug':
        console.debug(formattedEntry);
        break;
      case 'info':
        console.info(formattedEntry);
        break;
      case 'warn':
        console.warn(formattedEntry);
        break;
      case 'error':
        console.error(formattedEntry);
        break;
    }
  }

  private async writeToFile(formattedEntry: string): Promise<void> {
    if (!this.config.logFile) {
      return;
    }

    try {
      await this.rotateLogFileIfNeeded();
      await fs.appendFile(this.config.logFile, formattedEntry + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  private async rotateLogFileIfNeeded(): Promise<void> {
    if (!this.config.logFile) {
      return;
    }

    try {
      const stats = await fs.stat(this.config.logFile);
      if (stats.size < this.config.maxFileSize) {
        return;
      }

      for (let i = this.config.maxBackupFiles - 1; i > 0; i--) {
        const oldFile = `${this.config.logFile}.${i}`;
        const newFile = `${this.config.logFile}.${i + 1}`;

        try {
          await fs.access(oldFile);
          await fs.rename(oldFile, newFile);
        } catch {
        }
      }

      const backupFile = `${this.config.logFile}.1`;
      await fs.rename(this.config.logFile, backupFile);
    } catch (error) {
    }
  }

  private getLevelFromStatusCode(statusCode: number): LogLevel {
    if (statusCode >= 500) return 'error';
    if (statusCode >= 400) return 'warn';
    return 'info';
  }

  updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): LoggerConfig {
    return { ...this.config };
  }
}

export class ChildLogger {
  constructor(
    private parent: Logger,
    private context: Record<string, any>
  ) {}

  debug(message: string, additionalContext?: Record<string, any>): void {
    this.parent.debug(message, { ...this.context, ...additionalContext });
  }

  info(message: string, additionalContext?: Record<string, any>): void {
    this.parent.info(message, { ...this.context, ...additionalContext });
  }

  warn(message: string, additionalContext?: Record<string, any>): void {
    this.parent.warn(message, { ...this.context, ...additionalContext });
  }

  error(message: string, error?: Error, additionalContext?: Record<string, any>): void {
    this.parent.error(message, error, { ...this.context, ...additionalContext });
  }

  child(additionalContext: Record<string, any>): ChildLogger {
    return new ChildLogger(this.parent, { ...this.context, ...additionalContext });
  }

  setCorrelationId(correlationId: string): void {
    this.parent.setCorrelationId(correlationId);
  }

  generateCorrelationId(): string {
    return this.parent.generateCorrelationId();
  }
}

export const logger = new Logger();

export function createLogger(module: string, config?: Partial<LoggerConfig>): Logger {
  const instance = new Logger(config);
  instance.setModule(module);
  return instance;
}

export function getLogLevelFromEnv(): LogLevel {
  const level = process.env.LOG_LEVEL?.toLowerCase();
  switch (level) {
    case 'debug': return 'debug';
    case 'info': return 'info';
    case 'warn': return 'warn';
    case 'error': return 'error';
    default: return DEFAULT_LOGGER_CONFIG.level;
  }
}
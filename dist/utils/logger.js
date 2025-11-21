"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.ChildLogger = exports.Logger = exports.DEFAULT_LOGGER_CONFIG = void 0;
exports.createLogger = createLogger;
exports.getLogLevelFromEnv = getLogLevelFromEnv;
const crypto_1 = require("crypto");
const promises_1 = __importDefault(require("fs/promises"));
const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};
exports.DEFAULT_LOGGER_CONFIG = {
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
class Logger {
    config;
    currentCorrelationId;
    currentModule;
    performanceStart = new Map();
    constructor(config = {}) {
        this.config = { ...exports.DEFAULT_LOGGER_CONFIG, ...config };
        this.currentCorrelationId = (0, crypto_1.randomUUID)();
    }
    setCorrelationId(correlationId) {
        this.currentCorrelationId = correlationId;
    }
    getCorrelationId() {
        return this.currentCorrelationId;
    }
    generateCorrelationId() {
        this.currentCorrelationId = (0, crypto_1.randomUUID)();
        return this.currentCorrelationId;
    }
    setModule(module) {
        this.currentModule = module;
    }
    debug(message, context) {
        this.writeLogEntry(this.createLogEntry('debug', message, context));
    }
    info(message, context) {
        this.writeLogEntry(this.createLogEntry('info', message, context));
    }
    warn(message, context) {
        this.writeLogEntry(this.createLogEntry('warn', message, context));
    }
    error(message, error, context) {
        const logEntry = this.createLogEntry('error', message, context);
        if (error) {
            logEntry.error = {
                name: error.name,
                message: error.message,
                stack: error.stack,
                code: error.code,
            };
        }
        this.writeLogEntry(logEntry);
    }
    logRequest(method, url, statusCode, duration, context) {
        const logEntry = this.createLogEntry(this.getLevelFromStatusCode(statusCode), `${method} ${url} - ${statusCode}`, context);
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
    logProvider(providerName, operation, model, tokens, context) {
        const logEntry = this.createLogEntry('info', `Provider ${providerName} - ${operation}`, context);
        logEntry.provider = {
            name: providerName,
            operation,
            model,
            tokens,
        };
        this.writeLogEntry(logEntry);
    }
    startTimer(operation) {
        const timerId = (0, crypto_1.randomUUID)();
        this.performanceStart.set(timerId, Date.now());
        this.debug(`Started timer for ${operation}`, { timerId, operation });
        return timerId;
    }
    endTimer(timerId, operation, context) {
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
    logPerformance(operation, metrics, context) {
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
    child(context) {
        return new ChildLogger(this, context);
    }
    writeLogEntry(logEntry) {
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
    createLogEntry(level, message, context) {
        return {
            level,
            timestamp: new Date().toISOString(),
            message,
            correlationId: this.config.includeCorrelationId ? this.currentCorrelationId : '',
            module: this.currentModule,
            context,
        };
    }
    shouldLog(logEntry) {
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
    formatLogEntry(logEntry) {
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
    writeToConsole(formattedEntry, level) {
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
    async writeToFile(formattedEntry) {
        if (!this.config.logFile) {
            return;
        }
        try {
            await this.rotateLogFileIfNeeded();
            await promises_1.default.appendFile(this.config.logFile, formattedEntry + '\n');
        }
        catch (error) {
            console.error('Failed to write to log file:', error);
        }
    }
    async rotateLogFileIfNeeded() {
        if (!this.config.logFile) {
            return;
        }
        try {
            const stats = await promises_1.default.stat(this.config.logFile);
            if (stats.size < this.config.maxFileSize) {
                return;
            }
            for (let i = this.config.maxBackupFiles - 1; i > 0; i--) {
                const oldFile = `${this.config.logFile}.${i}`;
                const newFile = `${this.config.logFile}.${i + 1}`;
                try {
                    await promises_1.default.access(oldFile);
                    await promises_1.default.rename(oldFile, newFile);
                }
                catch {
                }
            }
            const backupFile = `${this.config.logFile}.1`;
            await promises_1.default.rename(this.config.logFile, backupFile);
        }
        catch (error) {
        }
    }
    getLevelFromStatusCode(statusCode) {
        if (statusCode >= 500)
            return 'error';
        if (statusCode >= 400)
            return 'warn';
        return 'info';
    }
    updateConfig(config) {
        this.config = { ...this.config, ...config };
    }
    getConfig() {
        return { ...this.config };
    }
}
exports.Logger = Logger;
class ChildLogger {
    parent;
    context;
    constructor(parent, context) {
        this.parent = parent;
        this.context = context;
    }
    debug(message, additionalContext) {
        this.parent.debug(message, { ...this.context, ...additionalContext });
    }
    info(message, additionalContext) {
        this.parent.info(message, { ...this.context, ...additionalContext });
    }
    warn(message, additionalContext) {
        this.parent.warn(message, { ...this.context, ...additionalContext });
    }
    error(message, error, additionalContext) {
        this.parent.error(message, error, { ...this.context, ...additionalContext });
    }
    child(additionalContext) {
        return new ChildLogger(this.parent, { ...this.context, ...additionalContext });
    }
    setCorrelationId(correlationId) {
        this.parent.setCorrelationId(correlationId);
    }
    generateCorrelationId() {
        return this.parent.generateCorrelationId();
    }
}
exports.ChildLogger = ChildLogger;
exports.logger = new Logger();
function createLogger(module, config) {
    const instance = new Logger(config);
    instance.setModule(module);
    return instance;
}
function getLogLevelFromEnv() {
    const level = process.env.LOG_LEVEL?.toLowerCase();
    switch (level) {
        case 'debug': return 'debug';
        case 'info': return 'info';
        case 'warn': return 'warn';
        case 'error': return 'error';
        default: return exports.DEFAULT_LOGGER_CONFIG.level;
    }
}
//# sourceMappingURL=logger.js.map
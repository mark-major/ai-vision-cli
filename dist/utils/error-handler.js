"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalErrorHandler = exports.ErrorHandler = void 0;
exports.handleError = handleError;
exports.createErrorContext = createErrorContext;
exports.logError = logError;
exports.isRetryableError = isRetryableError;
const chalk_1 = __importDefault(require("chalk"));
const Errors_js_1 = require("../types/Errors.js");
class ErrorHandler {
    options;
    constructor(options = {}) {
        this.options = {
            enableMetrics: true,
            ...options,
        };
    }
    handleError(error, context, options = {}) {
        const errorContext = this.normalizeContext(context);
        const analysis = this.analyzeError(error, errorContext);
        this.logError(error, errorContext, analysis);
        if (this.options.enableMetrics && this.options.metrics) {
            this.recordErrorMetrics(error, errorContext, analysis);
        }
        this.displayErrorMessage(error, errorContext, analysis);
        if (options.exit !== false) {
            process.exit(this.getExitCode(error));
        }
        throw error;
    }
    analyzeError(error, context) {
        if (error instanceof Errors_js_1.VisionError) {
            return this.analyzeVisionError(error, context);
        }
        if (error.name === 'FetchError' || error.message.includes('network') || error.message.includes('ENOTFOUND')) {
            return {
                isRetryable: true,
                shouldTriggerCircuitBreaker: false,
                shouldApplyRateLimitBackoff: false,
                suggestedAction: 'retry',
                estimatedRetryDelay: 1000,
                category: 'transient',
                severity: 'medium',
            };
        }
        return {
            isRetryable: false,
            shouldTriggerCircuitBreaker: false,
            shouldApplyRateLimitBackoff: false,
            suggestedAction: 'fail',
            category: 'permanent',
            severity: 'high',
        };
    }
    analyzeVisionError(error, _context) {
        switch (error.code) {
            case 'RATE_LIMIT_EXCEEDED':
                return {
                    isRetryable: true,
                    shouldTriggerCircuitBreaker: false,
                    shouldApplyRateLimitBackoff: true,
                    suggestedAction: 'backoff',
                    estimatedRetryDelay: error.retryAfter ? error.retryAfter * 1000 : 60000,
                    category: 'rate_limit',
                    severity: 'medium',
                };
            case 'NETWORK_ERROR':
                return {
                    isRetryable: true,
                    shouldTriggerCircuitBreaker: true,
                    shouldApplyRateLimitBackoff: false,
                    suggestedAction: 'retry',
                    estimatedRetryDelay: 2000,
                    category: 'transient',
                    severity: 'medium',
                };
            case 'PROVIDER_ERROR':
                if (error.statusCode && error.statusCode >= 500) {
                    return {
                        isRetryable: true,
                        shouldTriggerCircuitBreaker: true,
                        shouldApplyRateLimitBackoff: false,
                        suggestedAction: 'switch_provider',
                        estimatedRetryDelay: 1000,
                        category: 'transient',
                        severity: 'high',
                    };
                }
                else {
                    return {
                        isRetryable: false,
                        shouldTriggerCircuitBreaker: false,
                        shouldApplyRateLimitBackoff: false,
                        suggestedAction: 'fail',
                        category: 'permanent',
                        severity: 'high',
                    };
                }
            case 'AUTHENTICATION_ERROR':
                return {
                    isRetryable: false,
                    shouldTriggerCircuitBreaker: true,
                    shouldApplyRateLimitBackoff: false,
                    suggestedAction: 'fail',
                    category: 'authentication',
                    severity: 'critical',
                };
            case 'AUTHORIZATION_ERROR':
                return {
                    isRetryable: false,
                    shouldTriggerCircuitBreaker: false,
                    shouldApplyRateLimitBackoff: false,
                    suggestedAction: 'fail',
                    category: 'authentication',
                    severity: 'high',
                };
            case 'FILE_SIZE_EXCEEDED':
            case 'UNSUPPORTED_FILE_TYPE':
            case 'VALIDATION_ERROR':
                return {
                    isRetryable: false,
                    shouldTriggerCircuitBreaker: false,
                    shouldApplyRateLimitBackoff: false,
                    suggestedAction: 'fail',
                    category: 'permanent',
                    severity: 'medium',
                };
            case 'STORAGE_ERROR':
                return {
                    isRetryable: true,
                    shouldTriggerCircuitBreaker: false,
                    shouldApplyRateLimitBackoff: false,
                    suggestedAction: 'retry',
                    estimatedRetryDelay: 5000,
                    category: 'transient',
                    severity: 'high',
                };
            default:
                return {
                    isRetryable: false,
                    shouldTriggerCircuitBreaker: false,
                    shouldApplyRateLimitBackoff: false,
                    suggestedAction: 'fail',
                    category: 'permanent',
                    severity: 'medium',
                };
        }
    }
    logError(error, context, analysis) {
        if (!this.options.logger)
            return;
        this.options.logger.error('Error occurred', error, {
            context,
            analysis,
            correlationId: this.options.correlationId,
            timestamp: new Date().toISOString(),
        });
    }
    recordErrorMetrics(error, context, analysis) {
        if (!this.options.metrics)
            return;
        const contextTags = {
            error_type: error instanceof Errors_js_1.VisionError ? error.code : 'UNKNOWN',
            provider: context.provider || 'unknown',
            operation: context.operation,
            category: analysis.category,
            severity: analysis.severity,
            is_retryable: analysis.isRetryable.toString(),
        };
        this.options.metrics.incrementCounter('errors_total', 1, contextTags);
        this.options.metrics.recordHistogram('error_latency', 0, undefined, contextTags);
        this.options.metrics.setGauge('error_rate', 1, contextTags);
        if (analysis.shouldTriggerCircuitBreaker && this.options.circuitBreaker) {
            this.options.metrics.incrementCounter('circuit_breaker_triggers', 1, contextTags);
        }
        if (analysis.category === 'rate_limit') {
            this.options.metrics.incrementCounter('rate_limit_hits', 1, contextTags);
        }
    }
    displayErrorMessage(error, context, analysis) {
        if (error instanceof Errors_js_1.VisionError) {
            this.displayVisionErrorMessage(error, context, analysis);
        }
        else {
            this.displayGenericErrorMessage(error, context, analysis);
        }
        this.displayContextInfo(context);
        this.displayAnalysisInfo(analysis);
        if (process.env.LOG_LEVEL === 'debug') {
            this.displayDebugInfo(error);
        }
    }
    displayVisionErrorMessage(error, _context, analysis) {
        const icon = this.getErrorIcon(analysis.severity);
        const color = this.getErrorColor(analysis.severity);
        console.error(color(`${icon} ${this.getErrorTitle(error.code)}:`), error.message);
        if (analysis.suggestedAction !== 'fail') {
            const suggestion = this.getActionSuggestion(analysis);
            if (suggestion) {
                console.error(chalk_1.default.yellow(`💡 Suggestion: ${suggestion}`));
            }
        }
        this.displayErrorDetails(error);
    }
    displayGenericErrorMessage(error, _context, analysis) {
        const icon = this.getErrorIcon(analysis.severity);
        const color = this.getErrorColor(analysis.severity);
        console.error(color(`${icon} Unexpected Error:`), error.message);
        if (analysis.isRetryable) {
            console.error(chalk_1.default.yellow('💡 This error appears to be temporary. You can try again.'));
        }
        else {
            console.error(chalk_1.default.yellow('💡 This appears to be a permanent error. Please check your setup.'));
        }
    }
    displayErrorDetails(error) {
        switch (error.code) {
            case 'CONFIG_ERROR':
                if (error instanceof Errors_js_1.ConfigFileError && error.configPath) {
                    console.error(chalk_1.default.yellow(`📁 Config file: ${error.configPath}`));
                }
                break;
            case 'RATE_LIMIT_EXCEEDED':
                if (error.retryAfter) {
                    console.error(chalk_1.default.yellow(`⏰ Retry after: ${error.retryAfter} seconds`));
                }
                break;
            case 'AUTHENTICATION_ERROR':
                console.error(chalk_1.default.yellow('🔑 Please check your API credentials.'));
                break;
            case 'FILE_SIZE_EXCEEDED':
                console.error(chalk_1.default.yellow('📏 Consider compressing the image or using a smaller file.'));
                break;
            case 'UNSUPPORTED_FILE_TYPE':
                console.error(chalk_1.default.yellow('🖼️ Supported formats: JPEG, PNG, GIF, WebP, BMP, TIFF'));
                break;
        }
        if (error.provider) {
            console.error(chalk_1.default.yellow(`🏢 Provider: ${error.provider}`));
        }
        if (error.statusCode) {
            console.error(chalk_1.default.yellow(`📊 Status Code: ${error.statusCode}`));
        }
    }
    displayContextInfo(context) {
        if (context.operation) {
            console.error(chalk_1.default.gray(`⚙️ Operation: ${context.operation}`));
        }
        if (context.provider) {
            console.error(chalk_1.default.gray(`🏢 Provider: ${context.provider}`));
        }
        if (context.command) {
            console.error(chalk_1.default.gray(`💻 Command: ${context.command}`));
        }
    }
    displayAnalysisInfo(analysis) {
        if (analysis.estimatedRetryDelay && analysis.isRetryable) {
            const delay = analysis.estimatedRetryDelay / 1000;
            console.error(chalk_1.default.gray(`⏱️ Suggested retry delay: ${delay} seconds`));
        }
        if (process.env.LOG_LEVEL === 'debug') {
            console.error(chalk_1.default.gray(`🔍 Error category: ${analysis.category}`));
            console.error(chalk_1.default.gray(`🎯 Severity: ${analysis.severity}`));
            console.error(chalk_1.default.gray(`🔄 Retryable: ${analysis.isRetryable}`));
        }
    }
    displayDebugInfo(error) {
        console.error(chalk_1.default.gray('\n📋 Debug Information:'));
        console.error(chalk_1.default.gray(`Error: ${error.name}`));
        if (error instanceof Errors_js_1.VisionError) {
            console.error(chalk_1.default.gray(`Code: ${error.code}`));
            if (error.originalError) {
                console.error(chalk_1.default.gray('Original Error:'));
                console.error(chalk_1.default.gray(error.originalError.stack || error.originalError.message));
            }
        }
        console.error(chalk_1.default.gray('\n📚 Stack Trace:'));
        console.error(chalk_1.default.gray(error.stack || 'No stack trace available'));
    }
    getErrorIcon(severity) {
        switch (severity) {
            case 'critical': return '🚨';
            case 'high': return '❌';
            case 'medium': return '⚠️';
            case 'low': return 'ℹ️';
            default: return '❌';
        }
    }
    getErrorColor(severity) {
        switch (severity) {
            case 'critical':
            case 'high': return chalk_1.default.red;
            case 'medium': return chalk_1.default.yellow;
            case 'low': return chalk_1.default.blue;
            default: return chalk_1.default.red;
        }
    }
    getErrorTitle(code) {
        const titles = {
            'CONFIG_ERROR': 'Configuration Error',
            'AUTHENTICATION_ERROR': 'Authentication Error',
            'AUTHORIZATION_ERROR': 'Authorization Error',
            'FILE_NOT_FOUND': 'File Not Found',
            'FILE_SIZE_EXCEEDED': 'File Size Exceeded',
            'UNSUPPORTED_FILE_TYPE': 'Unsupported File Type',
            'RATE_LIMIT_EXCEEDED': 'Rate Limit Exceeded',
            'NETWORK_ERROR': 'Network Error',
            'PROVIDER_ERROR': 'Provider Error',
            'VALIDATION_ERROR': 'Validation Error',
            'STORAGE_ERROR': 'Storage Error',
            'CLI_ERROR': 'CLI Error',
            'COMMAND_ERROR': 'Command Error',
            'CONFIG_FILE_ERROR': 'Config File Error',
        };
        return titles[code] || 'Error';
    }
    getActionSuggestion(analysis) {
        switch (analysis.suggestedAction) {
            case 'retry':
                return 'Try the operation again in a few moments.';
            case 'backoff':
                return `Wait ${analysis.estimatedRetryDelay ? analysis.estimatedRetryDelay / 1000 : 60} seconds before trying again.`;
            case 'switch_provider':
                return 'Try using a different provider if available.';
            case 'fail':
                return null;
            default:
                return null;
        }
    }
    normalizeContext(context) {
        if (!context) {
            return { operation: 'unknown' };
        }
        if (typeof context === 'string') {
            return { operation: context };
        }
        return context;
    }
    getExitCode(error) {
        if (error instanceof Errors_js_1.VisionError && error.statusCode) {
            return error.statusCode;
        }
        return 1;
    }
}
exports.ErrorHandler = ErrorHandler;
exports.globalErrorHandler = new ErrorHandler();
function handleError(error, context, options = {}) {
    return exports.globalErrorHandler.handleError(error, context, options);
}
function createErrorContext(command, operation) {
    return {
        command,
        operation: operation || command,
    };
}
function logError(error, context) {
    const errorContext = typeof context === 'string' ? { operation: context } : context;
    if (errorContext && exports.globalErrorHandler.options.logger) {
        exports.globalErrorHandler.options.logger.error('Error logged', error, {
            context: errorContext,
        });
    }
    else {
        const timestamp = new Date().toISOString();
        const contextStr = errorContext ? ` [${errorContext.operation}]` : '';
        console.error(chalk_1.default.red(`[${timestamp}]${contextStr} ${error.name}: ${error.message}`));
    }
}
function isRetryableError(error) {
    if (error instanceof Errors_js_1.VisionError) {
        return [
            'NETWORK_ERROR',
            'RATE_LIMIT_EXCEEDED',
            'PROVIDER_ERROR',
            'STORAGE_ERROR',
        ].includes(error.code);
    }
    return error.name === 'FetchError' ||
        error.message.includes('network') ||
        error.message.includes('ENOTFOUND') ||
        error.message.includes('timeout');
}
//# sourceMappingURL=error-handler.js.map
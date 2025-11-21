import chalk from 'chalk';
import { VisionError, ConfigFileError } from '../types/Errors.js';
import { Logger } from './logger.js';
import { MetricsCollector } from './metrics.js';
import { RetryHandler } from './retry-handler.js';
import { CircuitBreaker } from './circuit-breaker.js';
import { TokenBucketRateLimiter } from './rate-limiter.js';

export interface ErrorHandlerOptions {
  logger?: Logger;
  metrics?: MetricsCollector;
  retryHandler?: RetryHandler;
  circuitBreaker?: CircuitBreaker;
  rateLimiter?: TokenBucketRateLimiter;
  enableMetrics?: boolean;
  correlationId?: string;
}

export interface ErrorContext {
  operation: string;
  provider?: string;
  command?: string;
  userId?: string;
  requestId?: string;
  additionalData?: Record<string, any>;
}

export interface ErrorAnalysis {
  isRetryable: boolean;
  shouldTriggerCircuitBreaker: boolean;
  shouldApplyRateLimitBackoff: boolean;
  suggestedAction: 'retry' | 'fail' | 'backoff' | 'switch_provider';
  estimatedRetryDelay?: number;
  category: 'transient' | 'permanent' | 'rate_limit' | 'authentication' | 'network';
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export class ErrorHandler {
  public options: ErrorHandlerOptions;

  constructor(options: ErrorHandlerOptions = {}) {
    this.options = {
      enableMetrics: true,
      ...options,
    };
  }

  handleError(error: Error, context?: string | ErrorContext, options: { exit?: boolean } = {}): never {
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

  analyzeError(error: Error, context: ErrorContext): ErrorAnalysis {
    if (error instanceof VisionError) {
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

  /**
   * Analyze VisionError types
   */
  private analyzeVisionError(error: VisionError, _context: ErrorContext): ErrorAnalysis {
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
        // Check if it's a server error (5xx) or client error (4xx)
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
        } else {
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

  /**
   * Log error with structured logging
   */
  private logError(error: Error, context: ErrorContext, analysis: ErrorAnalysis): void {
    if (!this.options.logger) return;

    this.options.logger.error('Error occurred', error, {
      context,
      analysis,
      correlationId: this.options.correlationId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Record error metrics
   */
  private recordErrorMetrics(error: Error, context: ErrorContext, analysis: ErrorAnalysis): void {
    if (!this.options.metrics) return;

    const contextTags = {
      error_type: error instanceof VisionError ? error.code : 'UNKNOWN',
      provider: context.provider || 'unknown',
      operation: context.operation,
      category: analysis.category,
      severity: analysis.severity,
      is_retryable: analysis.isRetryable.toString(),
    };

    // Increment error counter
    this.options.metrics.incrementCounter('errors_total', 1, contextTags);

    // Record error latency (0 for instant errors)
    this.options.metrics.recordHistogram('error_latency', 0, undefined, contextTags);

    // Update error rate gauge
    this.options.metrics.setGauge('error_rate', 1, contextTags);

    // Track circuit breaker triggers
    if (analysis.shouldTriggerCircuitBreaker && this.options.circuitBreaker) {
      this.options.metrics.incrementCounter('circuit_breaker_triggers', 1, contextTags);
    }

    // Track rate limit hits
    if (analysis.category === 'rate_limit') {
      this.options.metrics.incrementCounter('rate_limit_hits', 1, contextTags);
    }
  }

  /**
   * Display user-friendly error message
   */
  private displayErrorMessage(error: Error, context: ErrorContext, analysis: ErrorAnalysis): void {
    if (error instanceof VisionError) {
      this.displayVisionErrorMessage(error, context, analysis);
    } else {
      this.displayGenericErrorMessage(error, context, analysis);
    }

    // Display context information
    this.displayContextInfo(context);

    // Display additional information based on error analysis
    this.displayAnalysisInfo(analysis);

    // Display debug information if enabled
    if (process.env.LOG_LEVEL === 'debug') {
      this.displayDebugInfo(error);
    }
  }

  /**
   * Display VisionError messages with enhanced formatting
   */
  private displayVisionErrorMessage(error: VisionError, _context: ErrorContext, analysis: ErrorAnalysis): void {
    const icon = this.getErrorIcon(analysis.severity);
    const color = this.getErrorColor(analysis.severity);

    console.error(color(`${icon} ${this.getErrorTitle(error.code)}:`), error.message);

    // Add action suggestions
    if (analysis.suggestedAction !== 'fail') {
      const suggestion = this.getActionSuggestion(analysis);
      if (suggestion) {
        console.error(chalk.yellow(`💡 Suggestion: ${suggestion}`));
      }
    }

    // Display specific error details
    this.displayErrorDetails(error);
  }

  /**
   * Display generic error messages
   */
  private displayGenericErrorMessage(error: Error, _context: ErrorContext, analysis: ErrorAnalysis): void {
    const icon = this.getErrorIcon(analysis.severity);
    const color = this.getErrorColor(analysis.severity);

    console.error(color(`${icon} Unexpected Error:`), error.message);

    if (analysis.isRetryable) {
      console.error(chalk.yellow('💡 This error appears to be temporary. You can try again.'));
    } else {
      console.error(chalk.yellow('💡 This appears to be a permanent error. Please check your setup.'));
    }
  }

  /**
   * Display error-specific details
   */
  private displayErrorDetails(error: VisionError): void {
    switch (error.code) {
      case 'CONFIG_ERROR':
        if (error instanceof ConfigFileError && error.configPath) {
          console.error(chalk.yellow(`📁 Config file: ${error.configPath}`));
        }
        break;

      case 'RATE_LIMIT_EXCEEDED':
        if (error.retryAfter) {
          console.error(chalk.yellow(`⏰ Retry after: ${error.retryAfter} seconds`));
        }
        break;

      case 'AUTHENTICATION_ERROR':
        console.error(chalk.yellow('🔑 Please check your API credentials.'));
        break;

      case 'FILE_SIZE_EXCEEDED':
        console.error(chalk.yellow('📏 Consider compressing the image or using a smaller file.'));
        break;

      case 'UNSUPPORTED_FILE_TYPE':
        console.error(chalk.yellow('🖼️ Supported formats: JPEG, PNG, GIF, WebP, BMP, TIFF'));
        break;
    }

    // Show provider information if available
    if (error.provider) {
      console.error(chalk.yellow(`🏢 Provider: ${error.provider}`));
    }

    // Show status code if available
    if (error.statusCode) {
      console.error(chalk.yellow(`📊 Status Code: ${error.statusCode}`));
    }
  }

  /**
   * Display context information
   */
  private displayContextInfo(context: ErrorContext): void {
    if (context.operation) {
      console.error(chalk.gray(`⚙️ Operation: ${context.operation}`));
    }
    if (context.provider) {
      console.error(chalk.gray(`🏢 Provider: ${context.provider}`));
    }
    if (context.command) {
      console.error(chalk.gray(`💻 Command: ${context.command}`));
    }
  }

  /**
   * Display analysis-based information
   */
  private displayAnalysisInfo(analysis: ErrorAnalysis): void {
    if (analysis.estimatedRetryDelay && analysis.isRetryable) {
      const delay = analysis.estimatedRetryDelay / 1000;
      console.error(chalk.gray(`⏱️ Suggested retry delay: ${delay} seconds`));
    }

    if (process.env.LOG_LEVEL === 'debug') {
      console.error(chalk.gray(`🔍 Error category: ${analysis.category}`));
      console.error(chalk.gray(`🎯 Severity: ${analysis.severity}`));
      console.error(chalk.gray(`🔄 Retryable: ${analysis.isRetryable}`));
    }
  }

  /**
   * Display debug information
   */
  private displayDebugInfo(error: Error): void {
    console.error(chalk.gray('\n📋 Debug Information:'));
    console.error(chalk.gray(`Error: ${error.name}`));

    if (error instanceof VisionError) {
      console.error(chalk.gray(`Code: ${error.code}`));
      if (error.originalError) {
        console.error(chalk.gray('Original Error:'));
        console.error(chalk.gray(error.originalError.stack || error.originalError.message));
      }
    }

    console.error(chalk.gray('\n📚 Stack Trace:'));
    console.error(chalk.gray(error.stack || 'No stack trace available'));
  }

  /**
   * Get error icon based on severity
   */
  private getErrorIcon(severity: string): string {
    switch (severity) {
      case 'critical': return '🚨';
      case 'high': return '❌';
      case 'medium': return '⚠️';
      case 'low': return 'ℹ️';
      default: return '❌';
    }
  }

  /**
   * Get error color based on severity
   */
  private getErrorColor(severity: string): typeof chalk.red | typeof chalk.yellow | typeof chalk.blue {
    switch (severity) {
      case 'critical':
      case 'high': return chalk.red;
      case 'medium': return chalk.yellow;
      case 'low': return chalk.blue;
      default: return chalk.red;
    }
  }

  /**
   * Get error title based on error code
   */
  private getErrorTitle(code: string): string {
    const titles: Record<string, string> = {
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

  /**
   * Get action suggestion based on analysis
   */
  private getActionSuggestion(analysis: ErrorAnalysis): string | null {
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

  /**
   * Normalize context input
   */
  private normalizeContext(context?: string | ErrorContext): ErrorContext {
    if (!context) {
      return { operation: 'unknown' };
    }

    if (typeof context === 'string') {
      return { operation: context };
    }

    return context;
  }

  /**
   * Get exit code based on error
   */
  private getExitCode(error: Error): number {
    if (error instanceof VisionError && error.statusCode) {
      return error.statusCode;
    }
    return 1;
  }
}

// Global error handler instance
export const globalErrorHandler = new ErrorHandler();

// Legacy function for backward compatibility
export function handleError(error: Error, context?: string | ErrorContext, options: { exit?: boolean } = {}): never {
  return globalErrorHandler.handleError(error, context, options);
}

export function createErrorContext(command: string, operation?: string): ErrorContext {
  return {
    command,
    operation: operation || command,
  };
}

export function logError(error: Error, context?: string | ErrorContext): void {
  const errorContext = typeof context === 'string' ? { operation: context } : context;
  if (errorContext && globalErrorHandler.options.logger) {
    globalErrorHandler.options.logger.error('Error logged', error, {
      context: errorContext,
    });
  } else {
    // Fallback to console logging
    const timestamp = new Date().toISOString();
    const contextStr = errorContext ? ` [${errorContext.operation}]` : '';
    console.error(chalk.red(`[${timestamp}]${contextStr} ${error.name}: ${error.message}`));
  }
}

export function isRetryableError(error: Error): boolean {
  if (error instanceof VisionError) {
    return [
      'NETWORK_ERROR',
      'RATE_LIMIT_EXCEEDED',
      'PROVIDER_ERROR',
      'STORAGE_ERROR',
    ].includes(error.code);
  }

  // Check for network-related generic errors
  return error.name === 'FetchError' ||
         error.message.includes('network') ||
         error.message.includes('ENOTFOUND') ||
         error.message.includes('timeout');
}
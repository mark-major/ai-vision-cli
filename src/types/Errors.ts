/**
 * Error types for the AI Vision CLI
 */

export class VisionError extends Error {
  constructor(
    message: string,
    public code: string,
    public provider?: string,
    public originalError?: Error,
    public statusCode?: number,
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'VisionError';

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, VisionError);
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      provider: this.provider,
      statusCode: this.statusCode,
      retryAfter: this.retryAfter,
      stack: this.stack,
    };
  }
}

export class ConfigurationError extends VisionError {
  constructor(message: string, variable?: string) {
    super(message, 'CONFIG_ERROR', undefined, undefined, 400);
    this.name = 'ConfigurationError';
    if (variable !== undefined) {
      this.variable = variable;
    }
  }

  public variable?: string;
}

export class ProviderError extends VisionError {
  constructor(
    message: string,
    provider: string,
    originalError?: Error,
    statusCode?: number
  ) {
    super(message, 'PROVIDER_ERROR', provider, originalError, statusCode);
    this.name = 'ProviderError';
  }
}

export class FileUploadError extends VisionError {
  constructor(
    message: string,
    provider?: string,
    originalError?: Error,
    statusCode?: number
  ) {
    super(message, 'FILE_UPLOAD_ERROR', provider, originalError, statusCode);
    this.name = 'FileUploadError';
  }
}

export class FileNotFoundError extends VisionError {
  constructor(fileId: string, provider?: string) {
    super(
      `File not found: ${fileId}`,
      'FILE_NOT_FOUND',
      provider,
      undefined,
      404
    );
    this.name = 'FileNotFoundError';
    this.fileId = fileId;
  }

  public fileId: string;
}

export class UnsupportedFileTypeError extends VisionError {
  constructor(mimeType: string, supportedTypes?: string[]) {
    const message = supportedTypes
      ? `Unsupported file type: ${mimeType}. Supported types: ${supportedTypes.join(', ')}`
      : `Unsupported file type: ${mimeType}`;
    super(message, 'UNSUPPORTED_FILE_TYPE', undefined, undefined, 400);
    this.name = 'UnsupportedFileTypeError';
    this.mimeType = mimeType;
    if (supportedTypes !== undefined) {
      this.supportedTypes = supportedTypes;
    }
  }

  public mimeType: string;
  public supportedTypes?: string[];
}

export class FileSizeExceededError extends VisionError {
  constructor(fileSize: number, maxSize: number) {
    const message = `File size ${fileSize} bytes exceeds maximum allowed size ${maxSize} bytes`;
    super(message, 'FILE_SIZE_EXCEEDED', undefined, undefined, 400);
    this.name = 'FileSizeExceededError';
    this.fileSize = fileSize;
    this.maxSize = maxSize;
  }

  public fileSize: number;
  public maxSize: number;
}

export class RateLimitExceededError extends VisionError {
  constructor(message: string, provider?: string, retryAfter?: number) {
    super(message, 'RATE_LIMIT_EXCEEDED', provider, undefined, 429, retryAfter);
    this.name = 'RateLimitExceededError';
  }
}

export class AuthenticationError extends VisionError {
  constructor(message: string, provider?: string) {
    super(message, 'AUTHENTICATION_ERROR', provider, undefined, 401);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends VisionError {
  constructor(message: string, provider?: string) {
    super(message, 'AUTHORIZATION_ERROR', provider, undefined, 403);
    this.name = 'AuthorizationError';
  }
}

export class NetworkError extends VisionError {
  constructor(message: string, originalError?: Error) {
    super(message, 'NETWORK_ERROR', undefined, originalError);
    this.name = 'NetworkError';
  }
}

export class ValidationError extends VisionError {
  constructor(message: string, field?: string) {
    super(message, 'VALIDATION_ERROR', undefined, undefined, 400);
    this.name = 'ValidationError';
    if (field !== undefined) {
      this.field = field;
    }
  }

  public field?: string;
}

export class StorageError extends VisionError {
  constructor(
    message: string,
    storageType?: string,
    originalError?: Error,
    statusCode?: number
  ) {
    super(message, 'STORAGE_ERROR', storageType, originalError, statusCode);
    this.name = 'StorageError';
  }
}

// CLI-specific errors
export class CLIError extends VisionError {
  constructor(message: string, command?: string, originalError?: Error) {
    super(message, 'CLI_ERROR', 'cli', originalError, 1);
    this.name = 'CLIError';
    if (command !== undefined) {
      this.command = command;
    }
  }

  public command?: string;
}

export class ConfigFileError extends VisionError {
  constructor(message: string, configPath?: string, originalError?: Error) {
    super(message, 'CONFIG_FILE_ERROR', undefined, originalError, 1);
    this.name = 'ConfigFileError';
    if (configPath !== undefined) {
      this.configPath = configPath;
    }
  }

  public configPath?: string;
}

export class CommandError extends VisionError {
  constructor(
    message: string,
    command: string,
    exitCode: number = 1,
    originalError?: Error
  ) {
    super(message, 'COMMAND_ERROR', 'cli', originalError, exitCode);
    this.name = 'CommandError';
    this.command = command;
    this.exitCode = exitCode;
  }

  public command: string;
  public exitCode: number;
}

export type ErrorType =
  | 'CONFIG_ERROR'
  | 'PROVIDER_ERROR'
  | 'FILE_UPLOAD_ERROR'
  | 'FILE_NOT_FOUND'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'FILE_SIZE_EXCEEDED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'NETWORK_ERROR'
  | 'VALIDATION_ERROR'
  | 'STORAGE_ERROR'
  | 'CLI_ERROR'
  | 'CONFIG_FILE_ERROR'
  | 'COMMAND_ERROR';

export interface ErrorDetails {
  code: ErrorType;
  message: string;
  provider?: string;
  statusCode?: number;
  originalError?: string;
  timestamp: string;
  requestId?: string;
  command?: string;
  configPath?: string;
}

// Error handler types
export interface ErrorHandler {
  handle(error: Error, context?: string): void;
}

export interface ErrorContext {
  command?: string;
  operation?: string;
  provider?: string;
  file?: string;
  requestId?: string;
}
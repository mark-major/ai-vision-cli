export declare class VisionError extends Error {
    code: string;
    provider?: string | undefined;
    originalError?: Error | undefined;
    statusCode?: number | undefined;
    retryAfter?: number | undefined;
    constructor(message: string, code: string, provider?: string | undefined, originalError?: Error | undefined, statusCode?: number | undefined, retryAfter?: number | undefined);
    toJSON(): Record<string, unknown>;
}
export declare class ConfigurationError extends VisionError {
    constructor(message: string, variable?: string);
    variable?: string;
}
export declare class ProviderError extends VisionError {
    constructor(message: string, provider: string, originalError?: Error, statusCode?: number);
}
export declare class FileUploadError extends VisionError {
    constructor(message: string, provider?: string, originalError?: Error, statusCode?: number);
}
export declare class FileNotFoundError extends VisionError {
    constructor(fileId: string, provider?: string);
    fileId: string;
}
export declare class UnsupportedFileTypeError extends VisionError {
    constructor(mimeType: string, supportedTypes?: string[]);
    mimeType: string;
    supportedTypes?: string[];
}
export declare class FileSizeExceededError extends VisionError {
    constructor(fileSize: number, maxSize: number);
    fileSize: number;
    maxSize: number;
}
export declare class RateLimitExceededError extends VisionError {
    constructor(message: string, provider?: string, retryAfter?: number);
}
export declare class AuthenticationError extends VisionError {
    constructor(message: string, provider?: string);
}
export declare class AuthorizationError extends VisionError {
    constructor(message: string, provider?: string);
}
export declare class NetworkError extends VisionError {
    constructor(message: string, originalError?: Error);
}
export declare class ValidationError extends VisionError {
    constructor(message: string, field?: string);
    field?: string;
}
export declare class StorageError extends VisionError {
    constructor(message: string, storageType?: string, originalError?: Error, statusCode?: number);
}
export declare class CLIError extends VisionError {
    constructor(message: string, command?: string, originalError?: Error);
    command?: string;
}
export declare class ConfigFileError extends VisionError {
    constructor(message: string, configPath?: string, originalError?: Error);
    configPath?: string;
}
export declare class CommandError extends VisionError {
    constructor(message: string, command: string, exitCode?: number, originalError?: Error);
    command: string;
    exitCode: number;
}
export type ErrorType = 'CONFIG_ERROR' | 'PROVIDER_ERROR' | 'FILE_UPLOAD_ERROR' | 'FILE_NOT_FOUND' | 'UNSUPPORTED_FILE_TYPE' | 'FILE_SIZE_EXCEEDED' | 'RATE_LIMIT_EXCEEDED' | 'AUTHENTICATION_ERROR' | 'AUTHORIZATION_ERROR' | 'NETWORK_ERROR' | 'VALIDATION_ERROR' | 'STORAGE_ERROR' | 'CLI_ERROR' | 'CONFIG_FILE_ERROR' | 'COMMAND_ERROR';
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
//# sourceMappingURL=Errors.d.ts.map
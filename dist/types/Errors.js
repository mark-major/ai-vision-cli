"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandError = exports.ConfigFileError = exports.CLIError = exports.StorageError = exports.ValidationError = exports.NetworkError = exports.AuthorizationError = exports.AuthenticationError = exports.RateLimitExceededError = exports.FileSizeExceededError = exports.UnsupportedFileTypeError = exports.FileNotFoundError = exports.FileUploadError = exports.ProviderError = exports.ConfigurationError = exports.VisionError = void 0;
class VisionError extends Error {
    code;
    provider;
    originalError;
    statusCode;
    retryAfter;
    constructor(message, code, provider, originalError, statusCode, retryAfter) {
        super(message);
        this.code = code;
        this.provider = provider;
        this.originalError = originalError;
        this.statusCode = statusCode;
        this.retryAfter = retryAfter;
        this.name = 'VisionError';
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, VisionError);
        }
    }
    toJSON() {
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
exports.VisionError = VisionError;
class ConfigurationError extends VisionError {
    constructor(message, variable) {
        super(message, 'CONFIG_ERROR', undefined, undefined, 400);
        this.name = 'ConfigurationError';
        if (variable !== undefined) {
            this.variable = variable;
        }
    }
    variable;
}
exports.ConfigurationError = ConfigurationError;
class ProviderError extends VisionError {
    constructor(message, provider, originalError, statusCode) {
        super(message, 'PROVIDER_ERROR', provider, originalError, statusCode);
        this.name = 'ProviderError';
    }
}
exports.ProviderError = ProviderError;
class FileUploadError extends VisionError {
    constructor(message, provider, originalError, statusCode) {
        super(message, 'FILE_UPLOAD_ERROR', provider, originalError, statusCode);
        this.name = 'FileUploadError';
    }
}
exports.FileUploadError = FileUploadError;
class FileNotFoundError extends VisionError {
    constructor(fileId, provider) {
        super(`File not found: ${fileId}`, 'FILE_NOT_FOUND', provider, undefined, 404);
        this.name = 'FileNotFoundError';
        this.fileId = fileId;
    }
    fileId;
}
exports.FileNotFoundError = FileNotFoundError;
class UnsupportedFileTypeError extends VisionError {
    constructor(mimeType, supportedTypes) {
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
    mimeType;
    supportedTypes;
}
exports.UnsupportedFileTypeError = UnsupportedFileTypeError;
class FileSizeExceededError extends VisionError {
    constructor(fileSize, maxSize) {
        const message = `File size ${fileSize} bytes exceeds maximum allowed size ${maxSize} bytes`;
        super(message, 'FILE_SIZE_EXCEEDED', undefined, undefined, 400);
        this.name = 'FileSizeExceededError';
        this.fileSize = fileSize;
        this.maxSize = maxSize;
    }
    fileSize;
    maxSize;
}
exports.FileSizeExceededError = FileSizeExceededError;
class RateLimitExceededError extends VisionError {
    constructor(message, provider, retryAfter) {
        super(message, 'RATE_LIMIT_EXCEEDED', provider, undefined, 429, retryAfter);
        this.name = 'RateLimitExceededError';
    }
}
exports.RateLimitExceededError = RateLimitExceededError;
class AuthenticationError extends VisionError {
    constructor(message, provider) {
        super(message, 'AUTHENTICATION_ERROR', provider, undefined, 401);
        this.name = 'AuthenticationError';
    }
}
exports.AuthenticationError = AuthenticationError;
class AuthorizationError extends VisionError {
    constructor(message, provider) {
        super(message, 'AUTHORIZATION_ERROR', provider, undefined, 403);
        this.name = 'AuthorizationError';
    }
}
exports.AuthorizationError = AuthorizationError;
class NetworkError extends VisionError {
    constructor(message, originalError) {
        super(message, 'NETWORK_ERROR', undefined, originalError);
        this.name = 'NetworkError';
    }
}
exports.NetworkError = NetworkError;
class ValidationError extends VisionError {
    constructor(message, field) {
        super(message, 'VALIDATION_ERROR', undefined, undefined, 400);
        this.name = 'ValidationError';
        if (field !== undefined) {
            this.field = field;
        }
    }
    field;
}
exports.ValidationError = ValidationError;
class StorageError extends VisionError {
    constructor(message, storageType, originalError, statusCode) {
        super(message, 'STORAGE_ERROR', storageType, originalError, statusCode);
        this.name = 'StorageError';
    }
}
exports.StorageError = StorageError;
class CLIError extends VisionError {
    constructor(message, command, originalError) {
        super(message, 'CLI_ERROR', 'cli', originalError, 1);
        this.name = 'CLIError';
        if (command !== undefined) {
            this.command = command;
        }
    }
    command;
}
exports.CLIError = CLIError;
class ConfigFileError extends VisionError {
    constructor(message, configPath, originalError) {
        super(message, 'CONFIG_FILE_ERROR', undefined, originalError, 1);
        this.name = 'ConfigFileError';
        if (configPath !== undefined) {
            this.configPath = configPath;
        }
    }
    configPath;
}
exports.ConfigFileError = ConfigFileError;
class CommandError extends VisionError {
    constructor(message, command, exitCode = 1, originalError) {
        super(message, 'COMMAND_ERROR', 'cli', originalError, exitCode);
        this.name = 'CommandError';
        this.command = command;
        this.exitCode = exitCode;
    }
    command;
    exitCode;
}
exports.CommandError = CommandError;
//# sourceMappingURL=Errors.js.map
/**
 * Central type exports for the AI Vision CLI
 */

// Export Config types with aliases
export type {
  CLIConfig,
  EnvironmentConfig,
  CLIOptions,
  CommandOptions,
  BatchOptions,
  GeminiConfig,
  VertexAIConfig,
  GCSConfig,
  FileUploadConfig,
  ApiConfig,
  FileProcessingConfig,
} from './Config.js';

// Export Analysis types
export type {
  TaskType,
  FunctionName,
  AnalysisOptions,
  AnalysisResult,
  AnalysisMetadata,
  UsageMetadata,
  UploadedFile,
  FileReference,
  HealthStatus,
  RateLimitInfo,
  ProviderCapabilities,
  ModelCapabilities,
  ProviderInfo,
  CLIAnalysisResult,
  BatchAnalysisResult,
  BatchSummary,
  ComparisonResult,
  ObjectDetectionResult,
  DetectedObject,
  BoundingBox,
  AnnotationResult,
  ImageInfo,
  ProgressInfo,
  ProgressCallback,
} from './Analysis.js';

// Export Object Detection types
export type {
  ObjectDetectionArgs,
  ObjectDetectionMetadata,
  ObjectDetectionResponse,
  CLIDetectionWithFile,
  CLIDetectionWithTempFile,
  CLIDetectionOnly,
  BatchObjectDetectionResult,
  DetectionFilterOptions,
  DetectionOutputOptions,
  WebElementDetection,
  WebPageDetectionResult,
} from './ObjectDetection.js';

// Export Provider types
export type {
  VisionProvider,
  CLIVisionProvider,
  FileUploadStrategy,
  ProviderConfig,
  ProviderFactory,
  ProviderSelection,
  ProviderCredentials,
  ProviderRegistration,
  ProviderStatus,
  GeminiConfig as GeminiProviderConfig,
  GeminiFileMetadata,
  GeminiGenerateContentRequest,
  GeminiContent,
  GeminiPart,
  GeminiGenerationConfig,
  GeminiSafetySetting,
  GeminiGenerateContentResponse,
  GeminiCandidate,
  GeminiSafetyRating,
  VertexAIConfig as VertexAIProviderConfig,
  VertexAIGenerateContentRequest,
  VertexAIContent,
  VertexAIPart,
  VertexAIGenerationConfig,
  VertexAISafetySetting,
  VertexAIGenerateContentResponse,
  VertexAICandidate,
  VertexAISafetyRating,
} from './Providers.js';

// Export Error types
export {
  VisionError,
  ConfigurationError,
  ProviderError,
  FileUploadError,
  FileNotFoundError,
  UnsupportedFileTypeError,
  FileSizeExceededError,
  RateLimitExceededError,
  AuthenticationError,
  AuthorizationError,
  NetworkError,
  ValidationError,
  StorageError,
  CLIError,
  ConfigFileError,
  CommandError,
} from './Errors.js';

export type {
  ErrorType,
  ErrorDetails,
  ErrorHandler,
  ErrorContext,
} from './Errors.js';

// CLI-specific utility types
export interface OutputFormat {
  type: 'json' | 'text' | 'table' | 'csv';
  pretty?: boolean;
  colors?: boolean;
}

export interface ProgressOptions {
  showProgress: boolean;
  showETA: boolean;
  message?: string;
}

// Forward declare these to avoid circular imports
interface CLIOptions {
  verbose?: boolean;
  quiet?: boolean;
  config?: string;
  output?: 'json' | 'text' | 'table';
  provider?: 'google' | 'vertex_ai';
}

interface CLIConfig {
  providers: {
    image: 'google' | 'vertex_ai';
  };
  credentials: {
    gemini_api_key?: string;
    vertex_credentials?: string;
    gcs_bucket_name?: string;
  };
  settings: {
    image_model?: string;
    temperature?: number;
    top_p?: number;
    top_k?: number;
    max_tokens?: number;
    output_format?: 'json' | 'text' | 'table';
    progress_bars?: boolean;
  };
  limits: {
    max_image_size: string;
    gemini_files_api_threshold: number;
    vertex_ai_files_api_threshold: number;
  };
  formats: {
    allowed_image_formats: string[];
  };
  logging: {
    log_level: 'info' | 'debug' | 'warn' | 'error';
  };
}

export interface CLIContext {
  command: string;
  args: string[];
  options: CLIOptions;
  config: CLIConfig;
  startTime: number;
  verbose: boolean;
  quiet: boolean;
}

export interface CLIResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  metadata: {
    command: string;
    executionTime: number;
    timestamp: string;
    provider?: string;
    model?: string;
  };
}

// Command specific types
export interface AnalyzeImageCommand {
  image: string;
  prompt?: string;
  output?: string;
  save?: string;
  temperature?: number;
  maxTokens?: number;
  provider?: string;
  format?: string;
}

export interface CompareImagesCommand {
  images: string[];
  prompt?: string;
  output?: string;
  save?: string;
  temperature?: number;
  maxTokens?: number;
  provider?: string;
  format?: string;
}

export interface DetectObjectsCommand {
  image: string;
  prompt?: string;
  output?: string;
  save?: string;
  minConfidence?: number;
  annotation?: boolean;
  format?: string;
  provider?: string;
}

export interface AnalyzeVideoCommand {
  video: string;
  prompt?: string;
  output?: string;
  save?: string;
  temperature?: number;
  maxTokens?: number;
  provider?: string;
  format?: string;
}

export interface ConfigCommand {
  action: 'get' | 'set' | 'list' | 'test';
  key?: string;
  value?: string;
  provider?: string;
}

export interface InitCommand {
  provider?: string;
  interactive?: boolean;
  configPath?: string;
  defaults?: boolean;
}
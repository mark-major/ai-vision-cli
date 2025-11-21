/**
 * Configuration types for the AI Vision CLI
 */

export interface CLIConfig {
  // Provider selection
  providers: {
    image: 'google' | 'vertex_ai';
  };

  // Credentials
  credentials: {
    gemini_api_key?: string;
    vertex_credentials?: string;
    gcs_bucket_name?: string;
  };

  // Model configuration
  settings: {
    image_model?: string;
    temperature?: number;
    top_p?: number;
    top_k?: number;
    max_tokens?: number;
    output_format?: 'json' | 'text' | 'table';
    progress_bars?: boolean;
  };

  // Limits and thresholds
  limits: {
    max_image_size: string; // e.g., "20MB"
    gemini_files_api_threshold: number; // in bytes
    vertex_ai_files_api_threshold: number; // in bytes
  };

  // File formats
  formats: {
    allowed_image_formats: string[];
  };

  // Logging
  logging: {
    log_level: 'info' | 'debug' | 'warn' | 'error';
  };

  // Phase 5 Advanced Features Configuration (optional for backward compatibility)
  retry?: {
    enabled: boolean;
    max_attempts: number;
    base_delay: number; // ms
    max_delay: number; // ms
    backoff_multiplier: number;
    jitter: boolean;
    retryable_errors: string[];
  };

  health_check?: {
    enabled: boolean;
    interval: number; // ms
    timeout: number; // ms
    unhealthy_threshold: number;
    healthy_threshold: number;
  };

  rate_limiting?: {
    enabled: boolean;
    requests_per_second: number;
    burst_size: number;
    quota_per_day?: number;
    backoff_on_limit: boolean;
    max_backoff_delay: number; // ms
    enable_adaptive_limiting: boolean;
  };

  circuit_breaker?: {
    enabled: boolean;
    failure_threshold: number;
    recovery_timeout: number; // ms
    half_open_max_calls: number;
    success_threshold: number;
  };

  metrics?: {
    enabled: boolean;
    collection_interval: number; // ms
    retention_period: number; // ms
    export_format: 'json' | 'prometheus';
  };
}

export interface GeminiConfig {
  apiKey: string;
  baseUrl: string;
  imageModel: string;
}

export interface VertexAIConfig {
  projectId: string;
  location: string;
  endpoint: string;
  credentials?: string;
  imageModel: string;
}

export interface GCSConfig {
  bucketName: string;
  projectId: string;
  credentials: string;
  region: string;
}

export interface FileUploadConfig {
  useProviderFilesApi: boolean;
  geminiFilesApiThreshold: number;
  vertexAIFilesApiThreshold: number;
}

export interface ApiConfig {
  temperature: number;
  topP: number;
  topK: number;
  maxTokens: number;
  maxTokensForImage: number;
  temperatureForImage?: number;
  topPForImage?: number;
  topKForImage?: number;
  temperatureForAnalyzeImage?: number;
  topPForAnalyzeImage?: number;
  topKForAnalyzeImage?: number;
  maxTokensForAnalyzeImage?: number;
  temperatureForCompareImages?: number;
  topPForCompareImages?: number;
  topKForCompareImages?: number;
  maxTokensForCompareImages?: number;
  temperatureForDetectObjectsInImage?: number;
  topPForDetectObjectsInImage?: number;
  topKForDetectObjectsInImage?: number;
  maxTokensForDetectObjectsInImage?: number;
  // Model configuration
  analyzeImageModel?: string;
  compareImagesModel?: string;
  detectObjectsInImageModel?: string;
}

export interface FileProcessingConfig {
  maxImageSize: number;
  allowedImageFormats: string[];
  maxImagesForComparison: number;
}

// Environment variable interface for legacy support
export interface EnvironmentConfig {
  // Provider selection
  IMAGE_PROVIDER: 'google' | 'vertex_ai';

  // Gemini API configuration
  GEMINI_API_KEY?: string;
  GEMINI_BASE_URL?: string;

  // Vertex AI configuration
  VERTEX_CREDENTIALS?: string;
  VERTEX_PROJECT_ID?: string;
  VERTEX_LOCATION?: string;
  VERTEX_ENDPOINT?: string;

  // Model configuration
  IMAGE_MODEL?: string;

  // Function-specific model configuration
  ANALYZE_IMAGE_MODEL?: string;
  COMPARE_IMAGES_MODEL?: string;
  DETECT_OBJECTS_IN_IMAGE_MODEL?: string;

  // Google Cloud Storage configuration
  GCS_BUCKET_NAME?: string;
  GCS_PROJECT_ID?: string;
  GCS_CREDENTIALS?: string;
  GCS_REGION?: string;

  // Universal API parameters
  TEMPERATURE?: string;
  TOP_P?: string;
  TOP_K?: string;
  MAX_TOKENS?: string;

  // Task-specific API parameters
  TEMPERATURE_FOR_IMAGE?: string;
  TOP_P_FOR_IMAGE?: string;
  TOP_K_FOR_IMAGE?: string;
  MAX_TOKENS_FOR_IMAGE?: string;

  // Function-specific API parameters
  TEMPERATURE_FOR_ANALYZE_IMAGE?: string;
  TOP_P_FOR_ANALYZE_IMAGE?: string;
  TOP_K_FOR_ANALYZE_IMAGE?: string;
  MAX_TOKENS_FOR_ANALYZE_IMAGE?: string;
  TEMPERATURE_FOR_COMPARE_IMAGES?: string;
  TOP_P_FOR_COMPARE_IMAGES?: string;
  TOP_K_FOR_COMPARE_IMAGES?: string;
  MAX_TOKENS_FOR_COMPARE_IMAGES?: string;
  TEMPERATURE_FOR_DETECT_OBJECTS_IN_IMAGE?: string;
  TOP_P_FOR_DETECT_OBJECTS_IN_IMAGE?: string;
  TOP_K_FOR_DETECT_OBJECTS_IN_IMAGE?: string;
  MAX_TOKENS_FOR_DETECT_OBJECTS_IN_IMAGE?: string;

  // File processing configuration
  MAX_IMAGE_SIZE?: number;
  ALLOWED_IMAGE_FORMATS?: string[];
  MAX_IMAGES_FOR_COMPARISON?: number;

  // File upload configuration
  GEMINI_FILES_API_THRESHOLD?: number;
  VERTEX_AI_FILES_API_THRESHOLD?: number;

  // Logging configuration
  LOG_LEVEL?: 'info' | 'debug' | 'warn' | 'error';

  // Development configuration
  NODE_ENV?: 'development' | 'production';

  // Phase 5 Advanced Features Environment Variables

  // Retry Configuration
  RETRY_ENABLED?: string;
  RETRY_MAX_ATTEMPTS?: string;
  RETRY_BASE_DELAY?: string;
  RETRY_MAX_DELAY?: string;
  RETRY_BACKOFF_MULTIPLIER?: string;
  RETRY_JITTER?: string;

  // Health Check Configuration
  HEALTH_CHECK_ENABLED?: string;
  HEALTH_CHECK_INTERVAL?: string;
  HEALTH_CHECK_TIMEOUT?: string;
  HEALTH_CHECK_UNHEALTHY_THRESHOLD?: string;
  HEALTH_CHECK_HEALTHY_THRESHOLD?: string;

  // Rate Limiting Configuration
  RATE_LIMITING_ENABLED?: string;
  RATE_LIMITING_REQUESTS_PER_SECOND?: string;
  RATE_LIMITING_BURST_SIZE?: string;
  RATE_LIMITING_QUOTA_PER_DAY?: string;
  RATE_LIMITING_BACKOFF_ON_LIMIT?: string;
  RATE_LIMITING_MAX_BACKOFF_DELAY?: string;
  RATE_LIMITING_ENABLE_ADAPTIVE?: string;

  // Circuit Breaker Configuration
  CIRCUIT_BREAKER_ENABLED?: string;
  CIRCUIT_BREAKER_FAILURE_THRESHOLD?: string;
  CIRCUIT_BREAKER_RECOVERY_TIMEOUT?: string;
  CIRCUIT_BREAKER_HALF_OPEN_MAX_CALLS?: string;
  CIRCUIT_BREAKER_SUCCESS_THRESHOLD?: string;

  // Metrics Configuration
  METRICS_ENABLED?: string;
  METRICS_COLLECTION_INTERVAL?: string;
  METRICS_RETENTION_PERIOD?: string;
  METRICS_EXPORT_FORMAT?: 'json' | 'prometheus';
}

// CLI-specific interfaces
export interface CLIOptions {
  verbose?: boolean;
  quiet?: boolean;
  config?: string;
  output?: 'json' | 'text' | 'table';
  provider?: 'google' | 'vertex_ai';
}

export interface CommandOptions {
  prompt?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  output?: string;
  save?: string;
  progress?: boolean;
}

export interface BatchOptions extends CommandOptions {
  parallel?: number;
  pattern?: string;
  recursive?: boolean;
}

// CLI context interfaces
export interface CLIOptions {
  verbose?: boolean;
  quiet?: boolean;
  config?: string;
  output?: 'json' | 'text' | 'table';
  provider?: 'google' | 'vertex_ai';
}
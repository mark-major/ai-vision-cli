import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { z } from 'zod';
import {
  CLIConfig,
  EnvironmentConfig,
  ConfigFileError,
  ConfigurationError
} from '../types/index.js';
import dotenv from 'dotenv';
import { expandUser } from '../utils/path-utils.js';

// Configuration schema for validation
const configSchema = z.object({
  providers: z.object({
    image: z.enum(['google', 'vertex_ai']),
  }),
  credentials: z.object({
    gemini_api_key: z.string().optional(),
    vertex_credentials: z.string().optional(),
    gcs_bucket_name: z.string().optional(),
  }),
  settings: z.object({
    image_model: z.string().optional(),
    temperature: z.number().min(0).max(1).optional(),
    top_p: z.number().min(0).max(1).optional(),
    top_k: z.number().min(1).optional(),
    max_tokens: z.number().positive().optional(),
    output_format: z.enum(['json', 'text', 'table']).optional(),
    progress_bars: z.boolean().optional(),
  }),
  limits: z.object({
    max_image_size: z.string(),
    gemini_files_api_threshold: z.number().positive(),
    vertex_ai_files_api_threshold: z.number().positive(),
  }),
  formats: z.object({
    allowed_image_formats: z.array(z.string()),
  }),
  logging: z.object({
    log_level: z.enum(['info', 'debug', 'warn', 'error']),
  }),
  // Phase 5 Advanced Features Configuration (optional for backward compatibility)
  retry: z.object({
    enabled: z.boolean().default(true),
    max_attempts: z.number().min(1).max(10).default(3),
    base_delay: z.number().min(100).default(1000),
    max_delay: z.number().min(1000).default(60000),
    backoff_multiplier: z.number().min(1).max(5).default(2),
    jitter: z.boolean().default(true),
    retryable_errors: z.array(z.string()).default(['NETWORK_ERROR', 'RATE_LIMIT_EXCEEDED', 'PROVIDER_ERROR', 'STORAGE_ERROR']),
  }).optional(),
  health_check: z.object({
    enabled: z.boolean().default(true),
    interval: z.number().min(5000).default(30000), // 30 seconds
    timeout: z.number().min(1000).default(10000), // 10 seconds
    unhealthy_threshold: z.number().min(1).max(10).default(3),
    healthy_threshold: z.number().min(1).max(10).default(2),
  }).optional(),
  rate_limiting: z.object({
    enabled: z.boolean().default(true),
    requests_per_second: z.number().min(0.1).default(10),
    burst_size: z.number().min(1).default(20),
    quota_per_day: z.number().min(1).optional(),
    backoff_on_limit: z.boolean().default(true),
    max_backoff_delay: z.number().min(1000).default(60000),
    enable_adaptive_limiting: z.boolean().default(true),
  }).optional(),
  circuit_breaker: z.object({
    enabled: z.boolean().default(true),
    failure_threshold: z.number().min(1).max(100).default(5),
    recovery_timeout: z.number().min(1000).default(60000),
    half_open_max_calls: z.number().min(1).default(3),
    success_threshold: z.number().min(1).default(2),
  }).optional(),
  metrics: z.object({
    enabled: z.boolean().default(true),
    collection_interval: z.number().min(1000).default(10000), // 10 seconds
    retention_period: z.number().min(60000).default(3600000), // 1 hour
    export_format: z.enum(['json', 'prometheus']).default('json'),
  }).optional(),
});

export class ConfigService {
  private static instance: ConfigService;
  private config: CLIConfig | null = null;
  private configPath: string;
  private defaultConfigPath: string;

  private constructor() {
    this.defaultConfigPath = expandUser('~/.ai-vision/config.yaml');
    this.configPath = this.defaultConfigPath;

    // Load environment variables
    this.loadEnvVars();
  }

  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  private loadEnvVars(): void {
    // Try to load from .env file
    const envPath = join(process.cwd(), '.env');
    if (existsSync(envPath)) {
      dotenv.config({ path: envPath });
    }

    // Also try global .env
    const globalEnvPath = expandUser('~/.ai-vision/.env');
    if (existsSync(globalEnvPath)) {
      dotenv.config({ path: globalEnvPath });
    }
  }

  public setConfigPath(path: string): void {
    this.configPath = expandUser(path);
  }

  public async loadConfig(): Promise<CLIConfig> {
    if (this.config && this.configPath === this.defaultConfigPath) {
      return this.config;
    }

    try {
      if (existsSync(this.configPath)) {
        const configData = await fs.readFile(this.configPath, 'utf-8');
        const parsedConfig = parseYaml(configData);

        // Validate with Zod
        this.config = configSchema.parse(parsedConfig);
      } else {
        // Use defaults if no config file exists
        this.config = this.getDefaultConfig();
      }

      // Override with environment variables
      this.config = this.mergeWithEnvironment(this.config);

      return this.config;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ConfigFileError(
          `Invalid configuration: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
          this.configPath,
          error
        );
      }
      throw new ConfigFileError(
        `Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`,
        this.configPath,
        error instanceof Error ? error : undefined
      );
    }
  }

  public async saveConfig(config: CLIConfig): Promise<void> {
    try {
      // Validate before saving
      configSchema.parse(config);

      // Ensure directory exists
      const configDir = dirname(this.configPath);
      await fs.mkdir(configDir, { recursive: true });

      // Save as YAML
      const yamlContent = stringifyYaml(config);
      await fs.writeFile(this.configPath, yamlContent, 'utf-8');

      this.config = config;
    } catch (error) {
      throw new ConfigFileError(
        `Failed to save configuration: ${error instanceof Error ? error.message : String(error)}`,
        this.configPath,
        error instanceof Error ? error : undefined
      );
    }
  }

  public async createConfigFile(overridePath?: string): Promise<string> {
    const configPath = overridePath ? expandUser(overridePath) : this.configPath;

    try {
      // Ensure directory exists
      const configDir = dirname(configPath);
      await fs.mkdir(configDir, { recursive: true });

      // Create default config
      const defaultConfig = this.getDefaultConfig();
      const yamlContent = stringifyYaml(defaultConfig);
      await fs.writeFile(configPath, yamlContent, 'utf-8');

      return configPath;
    } catch (error) {
      throw new ConfigFileError(
        `Failed to create config file: ${error instanceof Error ? error.message : String(error)}`,
        configPath,
        error instanceof Error ? error : undefined
      );
    }
  }

  private getDefaultConfig(): CLIConfig {
    return {
      providers: {
        image: 'google',
      },
      credentials: {},
      settings: {
        temperature: 0.4,
        top_p: 0.95,
        top_k: 32,
        max_tokens: 4096,
        output_format: 'json',
        progress_bars: true,
      },
      limits: {
        max_image_size: '20MB',
        gemini_files_api_threshold: 10485760, // 10MB
        vertex_ai_files_api_threshold: 1, // Minimum positive value
      },
      formats: {
        allowed_image_formats: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff'],
      },
      logging: {
        log_level: 'info',
      },
      // Phase 5 Advanced Features Default Configuration
      retry: {
        enabled: true,
        max_attempts: 3,
        base_delay: 1000,
        max_delay: 60000,
        backoff_multiplier: 2,
        jitter: true,
        retryable_errors: ['NETWORK_ERROR', 'RATE_LIMIT_EXCEEDED', 'PROVIDER_ERROR', 'STORAGE_ERROR'],
      },
      health_check: {
        enabled: true,
        interval: 30000, // 30 seconds
        timeout: 10000, // 10 seconds
        unhealthy_threshold: 3,
        healthy_threshold: 2,
      },
      rate_limiting: {
        enabled: true,
        requests_per_second: 10,
        burst_size: 20,
        quota_per_day: 1000,
        backoff_on_limit: true,
        max_backoff_delay: 60000,
        enable_adaptive_limiting: true,
      },
      circuit_breaker: {
        enabled: true,
        failure_threshold: 5,
        recovery_timeout: 60000,
        half_open_max_calls: 3,
        success_threshold: 2,
      },
      metrics: {
        enabled: true,
        collection_interval: 10000, // 10 seconds
        retention_period: 3600000, // 1 hour
        export_format: 'json',
      },
    };
  }

  private mergeWithEnvironment(config: CLIConfig): CLIConfig {
    const env = process.env as unknown as EnvironmentConfig;

    // Provider selection
    if (env.IMAGE_PROVIDER) {
      config.providers.image = env.IMAGE_PROVIDER;
    }

    // Credentials
    if (env.GEMINI_API_KEY) {
      config.credentials.gemini_api_key = env.GEMINI_API_KEY;
    }
    if (env.VERTEX_CREDENTIALS) {
      config.credentials.vertex_credentials = env.VERTEX_CREDENTIALS;
    }
    if (env.GCS_BUCKET_NAME) {
      config.credentials.gcs_bucket_name = env.GCS_BUCKET_NAME;
    }

    // Settings
    if (env.IMAGE_MODEL) {
      config.settings.image_model = env.IMAGE_MODEL;
    }

    // Function-specific models (highest priority)
    if (env.ANALYZE_IMAGE_MODEL) {
      config.settings.image_model = env.ANALYZE_IMAGE_MODEL;
    }
    if (env.COMPARE_IMAGES_MODEL) {
      config.settings.image_model = env.COMPARE_IMAGES_MODEL;
    }
    if (env.DETECT_OBJECTS_IN_IMAGE_MODEL) {
      config.settings.image_model = env.DETECT_OBJECTS_IN_IMAGE_MODEL;
    }

    // AI parameters with hierarchy
    this.mergeAIParameter(config, env, 'temperature');
    this.mergeAIParameter(config, env, 'top_p');
    this.mergeAIParameter(config, env, 'top_k');
    this.mergeAIParameter(config, env, 'max_tokens');

    // File processing limits
    if (env.MAX_IMAGE_SIZE) {
      config.limits.max_image_size = this.formatFileSize(env.MAX_IMAGE_SIZE);
    }

    // Upload thresholds
    if (env.GEMINI_FILES_API_THRESHOLD) {
      config.limits.gemini_files_api_threshold = env.GEMINI_FILES_API_THRESHOLD;
    }
    if (env.VERTEX_AI_FILES_API_THRESHOLD) {
      config.limits.vertex_ai_files_api_threshold = env.VERTEX_AI_FILES_API_THRESHOLD;
    }

    // File formats
    if (env.ALLOWED_IMAGE_FORMATS) {
      config.formats.allowed_image_formats = env.ALLOWED_IMAGE_FORMATS;
    }

    // Logging
    if (env.LOG_LEVEL) {
      config.logging.log_level = env.LOG_LEVEL;
    }

    // Phase 5 Advanced Features - Environment Variable Override
    this.mergePhase5Config(config, env);

    return config;
  }

  /**
   * Merge Phase 5 advanced features configuration from environment variables
   */
  private mergePhase5Config(config: CLIConfig, env: EnvironmentConfig): void {
    const defaults = this.getDefaultConfig();

    // Retry Configuration
    if (env.RETRY_ENABLED !== undefined || env.RETRY_MAX_ATTEMPTS || env.RETRY_BASE_DELAY ||
        env.RETRY_MAX_DELAY || env.RETRY_BACKOFF_MULTIPLIER || env.RETRY_JITTER !== undefined) {
      config.retry = {
        enabled: env.RETRY_ENABLED !== undefined ? env.RETRY_ENABLED === 'true' : defaults.retry!.enabled,
        max_attempts: env.RETRY_MAX_ATTEMPTS ? parseInt(env.RETRY_MAX_ATTEMPTS, 10) : defaults.retry!.max_attempts,
        base_delay: env.RETRY_BASE_DELAY ? parseInt(env.RETRY_BASE_DELAY, 10) : defaults.retry!.base_delay,
        max_delay: env.RETRY_MAX_DELAY ? parseInt(env.RETRY_MAX_DELAY, 10) : defaults.retry!.max_delay,
        backoff_multiplier: env.RETRY_BACKOFF_MULTIPLIER ? parseFloat(env.RETRY_BACKOFF_MULTIPLIER) : defaults.retry!.backoff_multiplier,
        jitter: env.RETRY_JITTER !== undefined ? env.RETRY_JITTER === 'true' : defaults.retry!.jitter,
        retryable_errors: defaults.retry!.retryable_errors,
      };
    }

    // Health Check Configuration
    if (env.HEALTH_CHECK_ENABLED !== undefined || env.HEALTH_CHECK_INTERVAL || env.HEALTH_CHECK_TIMEOUT ||
        env.HEALTH_CHECK_UNHEALTHY_THRESHOLD || env.HEALTH_CHECK_HEALTHY_THRESHOLD) {
      config.health_check = {
        enabled: env.HEALTH_CHECK_ENABLED !== undefined ? env.HEALTH_CHECK_ENABLED === 'true' : defaults.health_check!.enabled,
        interval: env.HEALTH_CHECK_INTERVAL ? parseInt(env.HEALTH_CHECK_INTERVAL, 10) : defaults.health_check!.interval,
        timeout: env.HEALTH_CHECK_TIMEOUT ? parseInt(env.HEALTH_CHECK_TIMEOUT, 10) : defaults.health_check!.timeout,
        unhealthy_threshold: env.HEALTH_CHECK_UNHEALTHY_THRESHOLD ? parseInt(env.HEALTH_CHECK_UNHEALTHY_THRESHOLD, 10) : defaults.health_check!.unhealthy_threshold,
        healthy_threshold: env.HEALTH_CHECK_HEALTHY_THRESHOLD ? parseInt(env.HEALTH_CHECK_HEALTHY_THRESHOLD, 10) : defaults.health_check!.healthy_threshold,
      };
    }

    // Rate Limiting Configuration
    if (env.RATE_LIMITING_ENABLED !== undefined || env.RATE_LIMITING_REQUESTS_PER_SECOND ||
        env.RATE_LIMITING_BURST_SIZE || env.RATE_LIMITING_QUOTA_PER_DAY ||
        env.RATE_LIMITING_BACKOFF_ON_LIMIT !== undefined || env.RATE_LIMITING_MAX_BACKOFF_DELAY ||
        env.RATE_LIMITING_ENABLE_ADAPTIVE !== undefined) {
      config.rate_limiting = {
        enabled: env.RATE_LIMITING_ENABLED !== undefined ? env.RATE_LIMITING_ENABLED === 'true' : defaults.rate_limiting!.enabled,
        requests_per_second: env.RATE_LIMITING_REQUESTS_PER_SECOND ? parseFloat(env.RATE_LIMITING_REQUESTS_PER_SECOND) : defaults.rate_limiting!.requests_per_second,
        burst_size: env.RATE_LIMITING_BURST_SIZE ? parseInt(env.RATE_LIMITING_BURST_SIZE, 10) : defaults.rate_limiting!.burst_size,
        quota_per_day: env.RATE_LIMITING_QUOTA_PER_DAY ? parseInt(env.RATE_LIMITING_QUOTA_PER_DAY, 10) : defaults.rate_limiting!.quota_per_day,
        backoff_on_limit: env.RATE_LIMITING_BACKOFF_ON_LIMIT !== undefined ? env.RATE_LIMITING_BACKOFF_ON_LIMIT === 'true' : defaults.rate_limiting!.backoff_on_limit,
        max_backoff_delay: env.RATE_LIMITING_MAX_BACKOFF_DELAY ? parseInt(env.RATE_LIMITING_MAX_BACKOFF_DELAY, 10) : defaults.rate_limiting!.max_backoff_delay,
        enable_adaptive_limiting: env.RATE_LIMITING_ENABLE_ADAPTIVE !== undefined ? env.RATE_LIMITING_ENABLE_ADAPTIVE === 'true' : defaults.rate_limiting!.enable_adaptive_limiting,
      };
    }

    // Circuit Breaker Configuration
    if (env.CIRCUIT_BREAKER_ENABLED !== undefined || env.CIRCUIT_BREAKER_FAILURE_THRESHOLD ||
        env.CIRCUIT_BREAKER_RECOVERY_TIMEOUT || env.CIRCUIT_BREAKER_HALF_OPEN_MAX_CALLS ||
        env.CIRCUIT_BREAKER_SUCCESS_THRESHOLD) {
      config.circuit_breaker = {
        enabled: env.CIRCUIT_BREAKER_ENABLED !== undefined ? env.CIRCUIT_BREAKER_ENABLED === 'true' : defaults.circuit_breaker!.enabled,
        failure_threshold: env.CIRCUIT_BREAKER_FAILURE_THRESHOLD ? parseInt(env.CIRCUIT_BREAKER_FAILURE_THRESHOLD, 10) : defaults.circuit_breaker!.failure_threshold,
        recovery_timeout: env.CIRCUIT_BREAKER_RECOVERY_TIMEOUT ? parseInt(env.CIRCUIT_BREAKER_RECOVERY_TIMEOUT, 10) : defaults.circuit_breaker!.recovery_timeout,
        half_open_max_calls: env.CIRCUIT_BREAKER_HALF_OPEN_MAX_CALLS ? parseInt(env.CIRCUIT_BREAKER_HALF_OPEN_MAX_CALLS, 10) : defaults.circuit_breaker!.half_open_max_calls,
        success_threshold: env.CIRCUIT_BREAKER_SUCCESS_THRESHOLD ? parseInt(env.CIRCUIT_BREAKER_SUCCESS_THRESHOLD, 10) : defaults.circuit_breaker!.success_threshold,
      };
    }

    // Metrics Configuration
    if (env.METRICS_ENABLED !== undefined || env.METRICS_COLLECTION_INTERVAL ||
        env.METRICS_RETENTION_PERIOD || env.METRICS_EXPORT_FORMAT) {
      config.metrics = {
        enabled: env.METRICS_ENABLED !== undefined ? env.METRICS_ENABLED === 'true' : defaults.metrics!.enabled,
        collection_interval: env.METRICS_COLLECTION_INTERVAL ? parseInt(env.METRICS_COLLECTION_INTERVAL, 10) : defaults.metrics!.collection_interval,
        retention_period: env.METRICS_RETENTION_PERIOD ? parseInt(env.METRICS_RETENTION_PERIOD, 10) : defaults.metrics!.retention_period,
        export_format: env.METRICS_EXPORT_FORMAT ? env.METRICS_EXPORT_FORMAT as 'json' | 'prometheus' : defaults.metrics!.export_format,
      };
    }
  }

  private mergeAIParameter(config: CLIConfig, env: EnvironmentConfig, param: 'temperature' | 'top_p' | 'top_k' | 'max_tokens'): void {
    const envKey = param.toUpperCase();
    const universalKey = `TEMPERATURE_${envKey}` as keyof EnvironmentConfig;
    const imageKey = `TEMPERATURE_FOR_IMAGE_${envKey}` as keyof EnvironmentConfig;

    // Helper function to parse parameter value
    const parseParamValue = (value: string | undefined, param: 'temperature' | 'top_p' | 'top_k' | 'max_tokens'): number | undefined => {
      if (!value) return undefined;

      if (param === 'top_k' || param === 'max_tokens') {
        const parsed = parseInt(value, 10);
        return isNaN(parsed) ? undefined : parsed;
      } else {
        const parsed = parseFloat(value);
        return isNaN(parsed) ? undefined : parsed;
      }
    };

    // Check function-specific first (highest priority)
    const analyzeValue = env[`TEMPERATURE_FOR_ANALYZE_IMAGE_${envKey}` as keyof EnvironmentConfig] as string;
    if (analyzeValue) {
      const parsed = parseParamValue(analyzeValue, param);
      if (parsed !== undefined) config.settings[param] = parsed;
    } else {
      const compareValue = env[`TEMPERATURE_FOR_COMPARE_IMAGES_${envKey}` as keyof EnvironmentConfig] as string;
      if (compareValue) {
        const parsed = parseParamValue(compareValue, param);
        if (parsed !== undefined) config.settings[param] = parsed;
      } else {
        const detectValue = env[`TEMPERATURE_FOR_DETECT_OBJECTS_IN_IMAGE_${envKey}` as keyof EnvironmentConfig] as string;
        if (detectValue) {
          const parsed = parseParamValue(detectValue, param);
          if (parsed !== undefined) config.settings[param] = parsed;
        }
        // Then task-specific
        else if (env[imageKey]) {
          const parsed = parseParamValue(env[imageKey] as string, param);
          if (parsed !== undefined) config.settings[param] = parsed;
        }
        // Finally universal (lowest priority)
        else if (env[universalKey]) {
          const parsed = parseParamValue(env[universalKey] as string, param);
          if (parsed !== undefined) config.settings[param] = parsed;
        }
      }
    }
  }

  private formatFileSize(size: number): string {
    if (size >= 1024 * 1024 * 1024) {
      return `${Math.round(size / (1024 * 1024 * 1024))}GB`;
    } else if (size >= 1024 * 1024) {
      return `${Math.round(size / (1024 * 1024))}MB`;
    } else if (size >= 1024) {
      return `${Math.round(size / 1024)}KB`;
    } else {
      return `${size}B`;
    }
  }

  public parseFileSize(sizeStr: string): number {
    const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)$/i);
    if (!match) {
      throw new ConfigurationError(`Invalid file size format: ${sizeStr}`, 'MAX_FILE_SIZE');
    }

    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();

    switch (unit) {
      case 'B': return Math.floor(value);
      case 'KB': return Math.floor(value * 1024);
      case 'MB': return Math.floor(value * 1024 * 1024);
      case 'GB': return Math.floor(value * 1024 * 1024 * 1024);
      default: throw new ConfigurationError(`Unknown file size unit: ${unit}`, 'MAX_FILE_SIZE');
    }
  }

  public async getConfigValue(path: string): Promise<unknown> {
    const config = await this.loadConfig();
    const keys = path.split('.');
    let current: unknown = config;

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = (current as Record<string, unknown>)[key];
      } else {
        throw new ConfigurationError(`Configuration path not found: ${path}`, path);
      }
    }

    return current;
  }

  public async setConfigValue(path: string, value: unknown): Promise<void> {
    const config = await this.loadConfig();
    const keys = path.split('.');

    // Navigate to the parent object
    let current: Record<string, unknown> = config as unknown as Record<string, unknown>;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (current[key] && typeof current[key] === 'object') {
        current = current[key] as Record<string, unknown>;
      } else {
        throw new ConfigurationError(`Configuration path not found: ${keys.slice(0, i + 1).join('.')}`, path);
      }
    }

    // Set the value
    const finalKey = keys[keys.length - 1];
    current[finalKey] = value;

    // Save the updated config
    await this.saveConfig(config);
  }

  public getConfigPath(): string {
    return this.configPath;
  }

  public resetCache(): void {
    this.config = null;
  }

  /**
   * Get retry configuration with defaults
   */
  public async getRetryConfig(): Promise<NonNullable<CLIConfig['retry']>> {
    const config = await this.loadConfig();
    return config.retry ?? this.getDefaultConfig().retry!;
  }

  /**
   * Get health check configuration with defaults
   */
  public async getHealthCheckConfig(): Promise<NonNullable<CLIConfig['health_check']>> {
    const config = await this.loadConfig();
    return config.health_check ?? this.getDefaultConfig().health_check!;
  }

  /**
   * Get rate limiting configuration with defaults
   */
  public async getRateLimitingConfig(): Promise<NonNullable<CLIConfig['rate_limiting']>> {
    const config = await this.loadConfig();
    return config.rate_limiting ?? this.getDefaultConfig().rate_limiting!;
  }

  /**
   * Get circuit breaker configuration with defaults
   */
  public async getCircuitBreakerConfig(): Promise<NonNullable<CLIConfig['circuit_breaker']>> {
    const config = await this.loadConfig();
    return config.circuit_breaker ?? this.getDefaultConfig().circuit_breaker!;
  }

  /**
   * Get metrics configuration with defaults
   */
  public async getMetricsConfig(): Promise<NonNullable<CLIConfig['metrics']>> {
    const config = await this.loadConfig();
    return config.metrics ?? this.getDefaultConfig().metrics!;
  }

  /**
   * Check if a Phase 5 feature is enabled
   */
  public async isFeatureEnabled(feature: 'retry' | 'health_check' | 'rate_limiting' | 'circuit_breaker' | 'metrics'): Promise<boolean> {
    const config = await this.loadConfig();
    return config[feature]?.enabled ?? true; // Default to enabled for Phase 5 features
  }

  /**
   * Create a Phase 5 enabled configuration file with examples
   */
  public async createPhase5ConfigFile(overridePath?: string): Promise<string> {
    const configPath = overridePath ? expandUser(overridePath) : this.configPath;

    try {
      // Ensure directory exists
      const configDir = dirname(configPath);
      await fs.mkdir(configDir, { recursive: true });

      // Create Phase 5 enhanced default config with comments

      const yamlContent = `# AI Vision CLI Configuration
# Enhanced with Phase 5 Advanced Features

# Provider Configuration
providers:
  image: google  # or vertex_ai

# API Credentials (can also be set via environment variables)
credentials:
  gemini_api_key: ""  # Set via GEMINI_API_KEY env var
  vertex_credentials: ""  # Set via VERTEX_CREDENTIALS env var
  gcs_bucket_name: ""  # Set via GCS_BUCKET_NAME env var

# AI Model Settings
settings:
  image_model: ""  # Set via IMAGE_MODEL env var
  temperature: 0.4  # Set via TEMPERATURE_TEMPERATURE env var
  top_p: 0.95  # Set via TEMPERATURE_TOP_P env var
  top_k: 32  # Set via TEMPERATURE_TOP_K env var
  max_tokens: 4096  # Set via TEMPERATURE_MAX_TOKENS env var
  output_format: json  # json, text, or table
  progress_bars: true

# File Processing Limits
limits:
  max_image_size: 20MB  # Set via MAX_IMAGE_SIZE env var
  gemini_files_api_threshold: 10485760  # 10MB, Set via GEMINI_FILES_API_THRESHOLD env var
  vertex_ai_files_api_threshold: 1  # Set via VERTEX_AI_FILES_API_THRESHOLD env var

# Supported File Formats
formats:
  allowed_image_formats: [png, jpg, jpeg, webp, gif, bmp, tiff]  # Set via ALLOWED_IMAGE_FORMATS env var

# Logging Configuration
logging:
  log_level: info  # debug, info, warn, error (Set via LOG_LEVEL env var)

# Phase 5 Advanced Features
retry:
  enabled: true  # Set via RETRY_ENABLED env var
  max_attempts: 3  # Set via RETRY_MAX_ATTEMPTS env var
  base_delay: 1000  # ms, Set via RETRY_BASE_DELAY env var
  max_delay: 60000  # ms, Set via RETRY_MAX_DELAY env var
  backoff_multiplier: 2  # Set via RETRY_BACKOFF_MULTIPLIER env var
  jitter: true  # Add randomness to delays, Set via RETRY_JITTER env var
  retryable_errors: [NETWORK_ERROR, RATE_LIMIT_EXCEEDED, PROVIDER_ERROR, STORAGE_ERROR]

health_check:
  enabled: true  # Set via HEALTH_CHECK_ENABLED env var
  interval: 30000  # ms, Set via HEALTH_CHECK_INTERVAL env var
  timeout: 10000  # ms, Set via HEALTH_CHECK_TIMEOUT env var
  unhealthy_threshold: 3  # Set via HEALTH_CHECK_UNHEALTHY_THRESHOLD env var
  healthy_threshold: 2  # Set via HEALTH_CHECK_HEALTHY_THRESHOLD env var

rate_limiting:
  enabled: true  # Set via RATE_LIMITING_ENABLED env var
  requests_per_second: 10  # Set via RATE_LIMITING_REQUESTS_PER_SECOND env var
  burst_size: 20  # Set via RATE_LIMITING_BURST_SIZE env var
  quota_per_day: 1000  # Set via RATE_LIMITING_QUOTA_PER_DAY env var
  backoff_on_limit: true  # Set via RATE_LIMITING_BACKOFF_ON_LIMIT env var
  max_backoff_delay: 60000  # ms, Set via RATE_LIMITING_MAX_BACKOFF_DELAY env var
  enable_adaptive_limiting: true  # Set via RATE_LIMITING_ENABLE_ADAPTIVE env var

circuit_breaker:
  enabled: true  # Set via CIRCUIT_BREAKER_ENABLED env var
  failure_threshold: 5  # Set via CIRCUIT_BREAKER_FAILURE_THRESHOLD env var
  recovery_timeout: 60000  # ms, Set via CIRCUIT_BREAKER_RECOVERY_TIMEOUT env var
  half_open_max_calls: 3  # Set via CIRCUIT_BREAKER_HALF_OPEN_MAX_CALLS env var
  success_threshold: 2  # Set via CIRCUIT_BREAKER_SUCCESS_THRESHOLD env var

metrics:
  enabled: true  # Set via METRICS_ENABLED env var
  collection_interval: 10000  # ms, Set via METRICS_COLLECTION_INTERVAL env var
  retention_period: 3600000  # ms (1 hour), Set via METRICS_RETENTION_PERIOD env var
  export_format: json  # json or prometheus, Set via METRICS_EXPORT_FORMAT env var
`;

      await fs.writeFile(configPath, yamlContent, 'utf-8');

      return configPath;
    } catch (error) {
      throw new ConfigFileError(
        `Failed to create Phase 5 config file: ${error instanceof Error ? error.message : String(error)}`,
        configPath,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Validate Phase 5 configuration
   */
  public validatePhase5Config(config: Partial<CLIConfig>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate retry configuration
    if (config.retry) {
      if (config.retry.max_attempts && (config.retry.max_attempts < 1 || config.retry.max_attempts > 10)) {
        errors.push('retry.max_attempts must be between 1 and 10');
      }
      if (config.retry.base_delay && config.retry.base_delay < 100) {
        errors.push('retry.base_delay must be at least 100ms');
      }
      if (config.retry.max_delay && config.retry.max_delay < 1000) {
        errors.push('retry.max_delay must be at least 1000ms');
      }
      if (config.retry.backoff_multiplier && (config.retry.backoff_multiplier < 1 || config.retry.backoff_multiplier > 5)) {
        errors.push('retry.backoff_multiplier must be between 1 and 5');
      }
    }

    // Validate health check configuration
    if (config.health_check) {
      if (config.health_check.interval && config.health_check.interval < 5000) {
        errors.push('health_check.interval must be at least 5000ms');
      }
      if (config.health_check.timeout && config.health_check.timeout < 1000) {
        errors.push('health_check.timeout must be at least 1000ms');
      }
      if (config.health_check.unhealthy_threshold && (config.health_check.unhealthy_threshold < 1 || config.health_check.unhealthy_threshold > 10)) {
        errors.push('health_check.unhealthy_threshold must be between 1 and 10');
      }
      if (config.health_check.healthy_threshold && (config.health_check.healthy_threshold < 1 || config.health_check.healthy_threshold > 10)) {
        errors.push('health_check.healthy_threshold must be between 1 and 10');
      }
    }

    // Validate rate limiting configuration
    if (config.rate_limiting) {
      if (config.rate_limiting.requests_per_second && config.rate_limiting.requests_per_second < 0.1) {
        errors.push('rate_limiting.requests_per_second must be at least 0.1');
      }
      if (config.rate_limiting.burst_size && config.rate_limiting.burst_size < 1) {
        errors.push('rate_limiting.burst_size must be at least 1');
      }
      if (config.rate_limiting.quota_per_day && config.rate_limiting.quota_per_day < 1) {
        errors.push('rate_limiting.quota_per_day must be at least 1');
      }
      if (config.rate_limiting.max_backoff_delay && config.rate_limiting.max_backoff_delay < 1000) {
        errors.push('rate_limiting.max_backoff_delay must be at least 1000ms');
      }
    }

    // Validate circuit breaker configuration
    if (config.circuit_breaker) {
      if (config.circuit_breaker.failure_threshold && (config.circuit_breaker.failure_threshold < 1 || config.circuit_breaker.failure_threshold > 100)) {
        errors.push('circuit_breaker.failure_threshold must be between 1 and 100');
      }
      if (config.circuit_breaker.recovery_timeout && config.circuit_breaker.recovery_timeout < 1000) {
        errors.push('circuit_breaker.recovery_timeout must be at least 1000ms');
      }
      if (config.circuit_breaker.half_open_max_calls && config.circuit_breaker.half_open_max_calls < 1) {
        errors.push('circuit_breaker.half_open_max_calls must be at least 1');
      }
      if (config.circuit_breaker.success_threshold && config.circuit_breaker.success_threshold < 1) {
        errors.push('circuit_breaker.success_threshold must be at least 1');
      }
    }

    // Validate metrics configuration
    if (config.metrics) {
      if (config.metrics.collection_interval && config.metrics.collection_interval < 1000) {
        errors.push('metrics.collection_interval must be at least 1000ms');
      }
      if (config.metrics.retention_period && config.metrics.retention_period < 60000) {
        errors.push('metrics.retention_period must be at least 60000ms');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
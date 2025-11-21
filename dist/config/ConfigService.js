"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigService = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const fs_2 = require("fs");
const yaml_1 = require("yaml");
const zod_1 = require("zod");
const index_js_1 = require("../types/index.js");
const dotenv_1 = __importDefault(require("dotenv"));
const path_utils_js_1 = require("../utils/path-utils.js");
const configSchema = zod_1.z.object({
    providers: zod_1.z.object({
        image: zod_1.z.enum(['google', 'vertex_ai']),
    }),
    credentials: zod_1.z.object({
        gemini_api_key: zod_1.z.string().optional(),
        vertex_credentials: zod_1.z.string().optional(),
        gcs_bucket_name: zod_1.z.string().optional(),
    }),
    settings: zod_1.z.object({
        image_model: zod_1.z.string().optional(),
        temperature: zod_1.z.number().min(0).max(1).optional(),
        top_p: zod_1.z.number().min(0).max(1).optional(),
        top_k: zod_1.z.number().min(1).optional(),
        max_tokens: zod_1.z.number().positive().optional(),
        output_format: zod_1.z.enum(['json', 'text', 'table']).optional(),
        progress_bars: zod_1.z.boolean().optional(),
    }),
    limits: zod_1.z.object({
        max_image_size: zod_1.z.string(),
        gemini_files_api_threshold: zod_1.z.number().positive(),
        vertex_ai_files_api_threshold: zod_1.z.number().positive(),
    }),
    formats: zod_1.z.object({
        allowed_image_formats: zod_1.z.array(zod_1.z.string()),
    }),
    logging: zod_1.z.object({
        log_level: zod_1.z.enum(['info', 'debug', 'warn', 'error']),
    }),
    retry: zod_1.z.object({
        enabled: zod_1.z.boolean().default(true),
        max_attempts: zod_1.z.number().min(1).max(10).default(3),
        base_delay: zod_1.z.number().min(100).default(1000),
        max_delay: zod_1.z.number().min(1000).default(60000),
        backoff_multiplier: zod_1.z.number().min(1).max(5).default(2),
        jitter: zod_1.z.boolean().default(true),
        retryable_errors: zod_1.z.array(zod_1.z.string()).default(['NETWORK_ERROR', 'RATE_LIMIT_EXCEEDED', 'PROVIDER_ERROR', 'STORAGE_ERROR']),
    }).optional(),
    health_check: zod_1.z.object({
        enabled: zod_1.z.boolean().default(true),
        interval: zod_1.z.number().min(5000).default(30000),
        timeout: zod_1.z.number().min(1000).default(10000),
        unhealthy_threshold: zod_1.z.number().min(1).max(10).default(3),
        healthy_threshold: zod_1.z.number().min(1).max(10).default(2),
    }).optional(),
    rate_limiting: zod_1.z.object({
        enabled: zod_1.z.boolean().default(true),
        requests_per_second: zod_1.z.number().min(0.1).default(10),
        burst_size: zod_1.z.number().min(1).default(20),
        quota_per_day: zod_1.z.number().min(1).optional(),
        backoff_on_limit: zod_1.z.boolean().default(true),
        max_backoff_delay: zod_1.z.number().min(1000).default(60000),
        enable_adaptive_limiting: zod_1.z.boolean().default(true),
    }).optional(),
    circuit_breaker: zod_1.z.object({
        enabled: zod_1.z.boolean().default(true),
        failure_threshold: zod_1.z.number().min(1).max(100).default(5),
        recovery_timeout: zod_1.z.number().min(1000).default(60000),
        half_open_max_calls: zod_1.z.number().min(1).default(3),
        success_threshold: zod_1.z.number().min(1).default(2),
    }).optional(),
    metrics: zod_1.z.object({
        enabled: zod_1.z.boolean().default(true),
        collection_interval: zod_1.z.number().min(1000).default(10000),
        retention_period: zod_1.z.number().min(60000).default(3600000),
        export_format: zod_1.z.enum(['json', 'prometheus']).default('json'),
    }).optional(),
});
class ConfigService {
    static instance;
    config = null;
    configPath;
    defaultConfigPath;
    constructor() {
        this.defaultConfigPath = (0, path_utils_js_1.expandUser)('~/.ai-vision/config.yaml');
        this.configPath = this.defaultConfigPath;
        this.loadEnvVars();
    }
    static getInstance() {
        if (!ConfigService.instance) {
            ConfigService.instance = new ConfigService();
        }
        return ConfigService.instance;
    }
    loadEnvVars() {
        const envPath = (0, path_1.join)(process.cwd(), '.env');
        if ((0, fs_2.existsSync)(envPath)) {
            dotenv_1.default.config({ path: envPath });
        }
        const globalEnvPath = (0, path_utils_js_1.expandUser)('~/.ai-vision/.env');
        if ((0, fs_2.existsSync)(globalEnvPath)) {
            dotenv_1.default.config({ path: globalEnvPath });
        }
    }
    setConfigPath(path) {
        this.configPath = (0, path_utils_js_1.expandUser)(path);
    }
    async loadConfig() {
        if (this.config && this.configPath === this.defaultConfigPath) {
            return this.config;
        }
        try {
            if ((0, fs_2.existsSync)(this.configPath)) {
                const configData = await fs_1.promises.readFile(this.configPath, 'utf-8');
                const parsedConfig = (0, yaml_1.parse)(configData);
                this.config = configSchema.parse(parsedConfig);
            }
            else {
                this.config = this.getDefaultConfig();
            }
            this.config = this.mergeWithEnvironment(this.config);
            return this.config;
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                throw new index_js_1.ConfigFileError(`Invalid configuration: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`, this.configPath, error);
            }
            throw new index_js_1.ConfigFileError(`Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`, this.configPath, error instanceof Error ? error : undefined);
        }
    }
    async saveConfig(config) {
        try {
            configSchema.parse(config);
            const configDir = (0, path_1.dirname)(this.configPath);
            await fs_1.promises.mkdir(configDir, { recursive: true });
            const yamlContent = (0, yaml_1.stringify)(config);
            await fs_1.promises.writeFile(this.configPath, yamlContent, 'utf-8');
            this.config = config;
        }
        catch (error) {
            throw new index_js_1.ConfigFileError(`Failed to save configuration: ${error instanceof Error ? error.message : String(error)}`, this.configPath, error instanceof Error ? error : undefined);
        }
    }
    async createConfigFile(overridePath) {
        const configPath = overridePath ? (0, path_utils_js_1.expandUser)(overridePath) : this.configPath;
        try {
            const configDir = (0, path_1.dirname)(configPath);
            await fs_1.promises.mkdir(configDir, { recursive: true });
            const defaultConfig = this.getDefaultConfig();
            const yamlContent = (0, yaml_1.stringify)(defaultConfig);
            await fs_1.promises.writeFile(configPath, yamlContent, 'utf-8');
            return configPath;
        }
        catch (error) {
            throw new index_js_1.ConfigFileError(`Failed to create config file: ${error instanceof Error ? error.message : String(error)}`, configPath, error instanceof Error ? error : undefined);
        }
    }
    getDefaultConfig() {
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
                gemini_files_api_threshold: 10485760,
                vertex_ai_files_api_threshold: 1,
            },
            formats: {
                allowed_image_formats: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff'],
            },
            logging: {
                log_level: 'info',
            },
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
                interval: 30000,
                timeout: 10000,
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
                collection_interval: 10000,
                retention_period: 3600000,
                export_format: 'json',
            },
        };
    }
    mergeWithEnvironment(config) {
        const env = process.env;
        if (env.IMAGE_PROVIDER) {
            config.providers.image = env.IMAGE_PROVIDER;
        }
        if (env.GEMINI_API_KEY) {
            config.credentials.gemini_api_key = env.GEMINI_API_KEY;
        }
        if (env.VERTEX_CREDENTIALS) {
            config.credentials.vertex_credentials = env.VERTEX_CREDENTIALS;
        }
        if (env.GCS_BUCKET_NAME) {
            config.credentials.gcs_bucket_name = env.GCS_BUCKET_NAME;
        }
        if (env.IMAGE_MODEL) {
            config.settings.image_model = env.IMAGE_MODEL;
        }
        if (env.ANALYZE_IMAGE_MODEL) {
            config.settings.image_model = env.ANALYZE_IMAGE_MODEL;
        }
        if (env.COMPARE_IMAGES_MODEL) {
            config.settings.image_model = env.COMPARE_IMAGES_MODEL;
        }
        if (env.DETECT_OBJECTS_IN_IMAGE_MODEL) {
            config.settings.image_model = env.DETECT_OBJECTS_IN_IMAGE_MODEL;
        }
        this.mergeAIParameter(config, env, 'temperature');
        this.mergeAIParameter(config, env, 'top_p');
        this.mergeAIParameter(config, env, 'top_k');
        this.mergeAIParameter(config, env, 'max_tokens');
        if (env.MAX_IMAGE_SIZE) {
            config.limits.max_image_size = this.formatFileSize(env.MAX_IMAGE_SIZE);
        }
        if (env.GEMINI_FILES_API_THRESHOLD) {
            config.limits.gemini_files_api_threshold = env.GEMINI_FILES_API_THRESHOLD;
        }
        if (env.VERTEX_AI_FILES_API_THRESHOLD) {
            config.limits.vertex_ai_files_api_threshold = env.VERTEX_AI_FILES_API_THRESHOLD;
        }
        if (env.ALLOWED_IMAGE_FORMATS) {
            config.formats.allowed_image_formats = env.ALLOWED_IMAGE_FORMATS;
        }
        if (env.LOG_LEVEL) {
            config.logging.log_level = env.LOG_LEVEL;
        }
        this.mergePhase5Config(config, env);
        return config;
    }
    mergePhase5Config(config, env) {
        const defaults = this.getDefaultConfig();
        if (env.RETRY_ENABLED !== undefined || env.RETRY_MAX_ATTEMPTS || env.RETRY_BASE_DELAY ||
            env.RETRY_MAX_DELAY || env.RETRY_BACKOFF_MULTIPLIER || env.RETRY_JITTER !== undefined) {
            config.retry = {
                enabled: env.RETRY_ENABLED !== undefined ? env.RETRY_ENABLED === 'true' : defaults.retry.enabled,
                max_attempts: env.RETRY_MAX_ATTEMPTS ? parseInt(env.RETRY_MAX_ATTEMPTS, 10) : defaults.retry.max_attempts,
                base_delay: env.RETRY_BASE_DELAY ? parseInt(env.RETRY_BASE_DELAY, 10) : defaults.retry.base_delay,
                max_delay: env.RETRY_MAX_DELAY ? parseInt(env.RETRY_MAX_DELAY, 10) : defaults.retry.max_delay,
                backoff_multiplier: env.RETRY_BACKOFF_MULTIPLIER ? parseFloat(env.RETRY_BACKOFF_MULTIPLIER) : defaults.retry.backoff_multiplier,
                jitter: env.RETRY_JITTER !== undefined ? env.RETRY_JITTER === 'true' : defaults.retry.jitter,
                retryable_errors: defaults.retry.retryable_errors,
            };
        }
        if (env.HEALTH_CHECK_ENABLED !== undefined || env.HEALTH_CHECK_INTERVAL || env.HEALTH_CHECK_TIMEOUT ||
            env.HEALTH_CHECK_UNHEALTHY_THRESHOLD || env.HEALTH_CHECK_HEALTHY_THRESHOLD) {
            config.health_check = {
                enabled: env.HEALTH_CHECK_ENABLED !== undefined ? env.HEALTH_CHECK_ENABLED === 'true' : defaults.health_check.enabled,
                interval: env.HEALTH_CHECK_INTERVAL ? parseInt(env.HEALTH_CHECK_INTERVAL, 10) : defaults.health_check.interval,
                timeout: env.HEALTH_CHECK_TIMEOUT ? parseInt(env.HEALTH_CHECK_TIMEOUT, 10) : defaults.health_check.timeout,
                unhealthy_threshold: env.HEALTH_CHECK_UNHEALTHY_THRESHOLD ? parseInt(env.HEALTH_CHECK_UNHEALTHY_THRESHOLD, 10) : defaults.health_check.unhealthy_threshold,
                healthy_threshold: env.HEALTH_CHECK_HEALTHY_THRESHOLD ? parseInt(env.HEALTH_CHECK_HEALTHY_THRESHOLD, 10) : defaults.health_check.healthy_threshold,
            };
        }
        if (env.RATE_LIMITING_ENABLED !== undefined || env.RATE_LIMITING_REQUESTS_PER_SECOND ||
            env.RATE_LIMITING_BURST_SIZE || env.RATE_LIMITING_QUOTA_PER_DAY ||
            env.RATE_LIMITING_BACKOFF_ON_LIMIT !== undefined || env.RATE_LIMITING_MAX_BACKOFF_DELAY ||
            env.RATE_LIMITING_ENABLE_ADAPTIVE !== undefined) {
            config.rate_limiting = {
                enabled: env.RATE_LIMITING_ENABLED !== undefined ? env.RATE_LIMITING_ENABLED === 'true' : defaults.rate_limiting.enabled,
                requests_per_second: env.RATE_LIMITING_REQUESTS_PER_SECOND ? parseFloat(env.RATE_LIMITING_REQUESTS_PER_SECOND) : defaults.rate_limiting.requests_per_second,
                burst_size: env.RATE_LIMITING_BURST_SIZE ? parseInt(env.RATE_LIMITING_BURST_SIZE, 10) : defaults.rate_limiting.burst_size,
                quota_per_day: env.RATE_LIMITING_QUOTA_PER_DAY ? parseInt(env.RATE_LIMITING_QUOTA_PER_DAY, 10) : defaults.rate_limiting.quota_per_day,
                backoff_on_limit: env.RATE_LIMITING_BACKOFF_ON_LIMIT !== undefined ? env.RATE_LIMITING_BACKOFF_ON_LIMIT === 'true' : defaults.rate_limiting.backoff_on_limit,
                max_backoff_delay: env.RATE_LIMITING_MAX_BACKOFF_DELAY ? parseInt(env.RATE_LIMITING_MAX_BACKOFF_DELAY, 10) : defaults.rate_limiting.max_backoff_delay,
                enable_adaptive_limiting: env.RATE_LIMITING_ENABLE_ADAPTIVE !== undefined ? env.RATE_LIMITING_ENABLE_ADAPTIVE === 'true' : defaults.rate_limiting.enable_adaptive_limiting,
            };
        }
        if (env.CIRCUIT_BREAKER_ENABLED !== undefined || env.CIRCUIT_BREAKER_FAILURE_THRESHOLD ||
            env.CIRCUIT_BREAKER_RECOVERY_TIMEOUT || env.CIRCUIT_BREAKER_HALF_OPEN_MAX_CALLS ||
            env.CIRCUIT_BREAKER_SUCCESS_THRESHOLD) {
            config.circuit_breaker = {
                enabled: env.CIRCUIT_BREAKER_ENABLED !== undefined ? env.CIRCUIT_BREAKER_ENABLED === 'true' : defaults.circuit_breaker.enabled,
                failure_threshold: env.CIRCUIT_BREAKER_FAILURE_THRESHOLD ? parseInt(env.CIRCUIT_BREAKER_FAILURE_THRESHOLD, 10) : defaults.circuit_breaker.failure_threshold,
                recovery_timeout: env.CIRCUIT_BREAKER_RECOVERY_TIMEOUT ? parseInt(env.CIRCUIT_BREAKER_RECOVERY_TIMEOUT, 10) : defaults.circuit_breaker.recovery_timeout,
                half_open_max_calls: env.CIRCUIT_BREAKER_HALF_OPEN_MAX_CALLS ? parseInt(env.CIRCUIT_BREAKER_HALF_OPEN_MAX_CALLS, 10) : defaults.circuit_breaker.half_open_max_calls,
                success_threshold: env.CIRCUIT_BREAKER_SUCCESS_THRESHOLD ? parseInt(env.CIRCUIT_BREAKER_SUCCESS_THRESHOLD, 10) : defaults.circuit_breaker.success_threshold,
            };
        }
        if (env.METRICS_ENABLED !== undefined || env.METRICS_COLLECTION_INTERVAL ||
            env.METRICS_RETENTION_PERIOD || env.METRICS_EXPORT_FORMAT) {
            config.metrics = {
                enabled: env.METRICS_ENABLED !== undefined ? env.METRICS_ENABLED === 'true' : defaults.metrics.enabled,
                collection_interval: env.METRICS_COLLECTION_INTERVAL ? parseInt(env.METRICS_COLLECTION_INTERVAL, 10) : defaults.metrics.collection_interval,
                retention_period: env.METRICS_RETENTION_PERIOD ? parseInt(env.METRICS_RETENTION_PERIOD, 10) : defaults.metrics.retention_period,
                export_format: env.METRICS_EXPORT_FORMAT ? env.METRICS_EXPORT_FORMAT : defaults.metrics.export_format,
            };
        }
    }
    mergeAIParameter(config, env, param) {
        const envKey = param.toUpperCase();
        const universalKey = `TEMPERATURE_${envKey}`;
        const imageKey = `TEMPERATURE_FOR_IMAGE_${envKey}`;
        const parseParamValue = (value, param) => {
            if (!value)
                return undefined;
            if (param === 'top_k' || param === 'max_tokens') {
                const parsed = parseInt(value, 10);
                return isNaN(parsed) ? undefined : parsed;
            }
            else {
                const parsed = parseFloat(value);
                return isNaN(parsed) ? undefined : parsed;
            }
        };
        const analyzeValue = env[`TEMPERATURE_FOR_ANALYZE_IMAGE_${envKey}`];
        if (analyzeValue) {
            const parsed = parseParamValue(analyzeValue, param);
            if (parsed !== undefined)
                config.settings[param] = parsed;
        }
        else {
            const compareValue = env[`TEMPERATURE_FOR_COMPARE_IMAGES_${envKey}`];
            if (compareValue) {
                const parsed = parseParamValue(compareValue, param);
                if (parsed !== undefined)
                    config.settings[param] = parsed;
            }
            else {
                const detectValue = env[`TEMPERATURE_FOR_DETECT_OBJECTS_IN_IMAGE_${envKey}`];
                if (detectValue) {
                    const parsed = parseParamValue(detectValue, param);
                    if (parsed !== undefined)
                        config.settings[param] = parsed;
                }
                else if (env[imageKey]) {
                    const parsed = parseParamValue(env[imageKey], param);
                    if (parsed !== undefined)
                        config.settings[param] = parsed;
                }
                else if (env[universalKey]) {
                    const parsed = parseParamValue(env[universalKey], param);
                    if (parsed !== undefined)
                        config.settings[param] = parsed;
                }
            }
        }
    }
    formatFileSize(size) {
        if (size >= 1024 * 1024 * 1024) {
            return `${Math.round(size / (1024 * 1024 * 1024))}GB`;
        }
        else if (size >= 1024 * 1024) {
            return `${Math.round(size / (1024 * 1024))}MB`;
        }
        else if (size >= 1024) {
            return `${Math.round(size / 1024)}KB`;
        }
        else {
            return `${size}B`;
        }
    }
    parseFileSize(sizeStr) {
        const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)$/i);
        if (!match) {
            throw new index_js_1.ConfigurationError(`Invalid file size format: ${sizeStr}`, 'MAX_FILE_SIZE');
        }
        const value = parseFloat(match[1]);
        const unit = match[2].toUpperCase();
        switch (unit) {
            case 'B': return Math.floor(value);
            case 'KB': return Math.floor(value * 1024);
            case 'MB': return Math.floor(value * 1024 * 1024);
            case 'GB': return Math.floor(value * 1024 * 1024 * 1024);
            default: throw new index_js_1.ConfigurationError(`Unknown file size unit: ${unit}`, 'MAX_FILE_SIZE');
        }
    }
    async getConfigValue(path) {
        const config = await this.loadConfig();
        const keys = path.split('.');
        let current = config;
        for (const key of keys) {
            if (current && typeof current === 'object' && key in current) {
                current = current[key];
            }
            else {
                throw new index_js_1.ConfigurationError(`Configuration path not found: ${path}`, path);
            }
        }
        return current;
    }
    async setConfigValue(path, value) {
        const config = await this.loadConfig();
        const keys = path.split('.');
        let current = config;
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (current[key] && typeof current[key] === 'object') {
                current = current[key];
            }
            else {
                throw new index_js_1.ConfigurationError(`Configuration path not found: ${keys.slice(0, i + 1).join('.')}`, path);
            }
        }
        const finalKey = keys[keys.length - 1];
        current[finalKey] = value;
        await this.saveConfig(config);
    }
    getConfigPath() {
        return this.configPath;
    }
    resetCache() {
        this.config = null;
    }
    async getRetryConfig() {
        const config = await this.loadConfig();
        return config.retry ?? this.getDefaultConfig().retry;
    }
    async getHealthCheckConfig() {
        const config = await this.loadConfig();
        return config.health_check ?? this.getDefaultConfig().health_check;
    }
    async getRateLimitingConfig() {
        const config = await this.loadConfig();
        return config.rate_limiting ?? this.getDefaultConfig().rate_limiting;
    }
    async getCircuitBreakerConfig() {
        const config = await this.loadConfig();
        return config.circuit_breaker ?? this.getDefaultConfig().circuit_breaker;
    }
    async getMetricsConfig() {
        const config = await this.loadConfig();
        return config.metrics ?? this.getDefaultConfig().metrics;
    }
    async isFeatureEnabled(feature) {
        const config = await this.loadConfig();
        return config[feature]?.enabled ?? true;
    }
    async createPhase5ConfigFile(overridePath) {
        const configPath = overridePath ? (0, path_utils_js_1.expandUser)(overridePath) : this.configPath;
        try {
            const configDir = (0, path_1.dirname)(configPath);
            await fs_1.promises.mkdir(configDir, { recursive: true });
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
            await fs_1.promises.writeFile(configPath, yamlContent, 'utf-8');
            return configPath;
        }
        catch (error) {
            throw new index_js_1.ConfigFileError(`Failed to create Phase 5 config file: ${error instanceof Error ? error.message : String(error)}`, configPath, error instanceof Error ? error : undefined);
        }
    }
    validatePhase5Config(config) {
        const errors = [];
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
exports.ConfigService = ConfigService;
//# sourceMappingURL=ConfigService.js.map
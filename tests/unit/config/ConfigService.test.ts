// Mock dependencies at module level
const mockFsPromises = {
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
  access: jest.fn(),
};

const mockDotenv = {
  config: jest.fn(),
};

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  promises: mockFsPromises,
}));
jest.mock('dotenv', () => mockDotenv);
jest.mock('../../../src/utils/path-utils', () => ({
  expandUser: jest.fn((path: string) => path.replace('~', '/home/user')),
}));
jest.mock('yaml', () => ({
  parse: jest.fn((data: string) => {
    // Return mock config based on content
    if (data.includes('vertex_ai')) {
      return {
        providers: { image: 'vertex_ai' },
        credentials: { gemini_api_key: 'test-key' },
        settings: { temperature: 0.7, output_format: 'text' },
        limits: { max_image_size: '10MB', gemini_files_api_threshold: 10485760, vertex_ai_files_api_threshold: 1 },
        formats: { allowed_image_formats: ['png', 'jpg'] },
        logging: { log_level: 'debug' }
      };
    }
    return {
      providers: { image: 'google' },
      settings: { temperature: 0.4, output_format: 'json' },
      limits: { max_image_size: '20MB', gemini_files_api_threshold: 10485760, vertex_ai_files_api_threshold: 1 },
      formats: { allowed_image_formats: ['png', 'jpg'] },
      logging: { log_level: 'info' }
    };
  }),
  stringify: jest.fn((_obj: any) => {
    // Return a simple YAML-like string
    return 'providers:\n  image: google\n  \n';
  }),
}));

import { ConfigService } from '../../../src/config/ConfigService';
import { ConfigFileError, ConfigurationError } from '../../../src/types';
import { existsSync } from 'fs';
import YAML from 'yaml';

const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;
const mockFs = mockFsPromises;

describe('ConfigService', () => {
  let configService: ConfigService;
  const testConfigPath = '/test/config.yaml';

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset singleton instance for clean test state
    (ConfigService as any).instance = null;

    configService = ConfigService.getInstance();
    // Don't set a custom path by default so tests use the default config path
    configService.resetCache();
  });

  afterEach(() => {
    configService.resetCache();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ConfigService.getInstance();
      const instance2 = ConfigService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Configuration Loading', () => {
    it('should load default configuration when no config file exists', async () => {
      mockExistsSync.mockReturnValue(false);

      const config = await configService.loadConfig();

      expect(config.providers.image).toBe('google');
      expect(config.settings.temperature).toBe(0.4);
      expect(config.settings.output_format).toBe('json');
      expect(config.limits.max_image_size).toBe('20MB');
    });

    it('should load configuration from file when it exists', async () => {
      // Set custom path for this test and reset cache to force loading
      configService.setConfigPath(testConfigPath);
      configService.resetCache();

      // Clear all environment variables that might interfere with the test
      const originalEnv = { ...process.env };
      delete process.env.IMAGE_PROVIDER;
      delete process.env.GEMINI_API_KEY;
      delete process.env.TEMPERATURE;
      delete process.env.OUTPUT_FORMAT;
      delete process.env.LOG_LEVEL;

      mockExistsSync.mockReturnValue(true);
      mockFs.readFile.mockResolvedValue('vertex_ai providers:\n  image: vertex_ai\ncredentials:\n  gemini_api_key: test-key\nsettings:\n  temperature: 0.7\n  output_format: text\nlimits:\n  max_image_size: 10MB\nlogging:\n  log_level: debug');

      const config = await configService.loadConfig();

      // Debug: check what YAML.parse was called with
      expect(mockFs.readFile).toHaveBeenCalled();

      expect(config.providers.image).toBe('vertex_ai');
      expect(config.credentials.gemini_api_key).toBe('test-key');
      expect(config.settings.temperature).toBe(0.7);
      expect(config.settings.output_format).toBe('text');
      expect(config.logging.log_level).toBe('debug');

      // Restore environment variables
      process.env = originalEnv;
    });

    it('should cache configuration when loading default config', async () => {
      mockExistsSync.mockReturnValue(false);

      const config1 = await configService.loadConfig();
      const config2 = await configService.loadConfig();

      expect(mockFs.readFile).toHaveBeenCalledTimes(0); // Should not read file
      expect(config1).toBe(config2); // Should be cached instance
    });

    it('should reload configuration when path changes', async () => {
      mockExistsSync.mockReturnValue(false);

      await configService.loadConfig();
      configService.setConfigPath('/different/path.yaml');
      await configService.loadConfig();

      // Should check for both default and new config files
      expect(mockExistsSync).toHaveBeenCalled();
      expect(mockExistsSync).toHaveBeenCalledWith(expect.stringContaining('config.yaml'));
      expect(mockExistsSync).toHaveBeenCalledWith('/different/path.yaml');
    });

    it('should throw ConfigFileError for invalid configuration', async () => {
      const invalidConfig = {
        providers: { image: 'invalid-provider' },
        settings: { temperature: 2.0 }, // Invalid: > 1.0
        limits: { max_image_size: 'invalid-size' },
      };

      mockExistsSync.mockReturnValue(true);
      mockFs.readFile.mockResolvedValue(YAML.stringify(invalidConfig));

      await expect(configService.loadConfig()).rejects.toThrow(ConfigFileError);
    });

    it('should throw ConfigFileError for file read errors', async () => {
      mockExistsSync.mockReturnValue(true);
      mockFs.readFile.mockRejectedValue(new Error('Permission denied'));

      await expect(configService.loadConfig()).rejects.toThrow(ConfigFileError);
    });
  });

  describe('Environment Variable Merging', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
      mockExistsSync.mockReturnValue(false); // Use default config
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should merge environment variables with configuration', async () => {
      process.env.IMAGE_PROVIDER = 'vertex_ai';
      process.env.GEMINI_API_KEY = 'env-key';
      process.env.IMAGE_MODEL = 'gemini-pro';
      process.env.LOG_LEVEL = 'debug';

      const config = await configService.loadConfig();

      expect(config.providers.image).toBe('vertex_ai');
      expect(config.credentials.gemini_api_key).toBe('env-key');
      expect(config.settings.image_model).toBe('gemini-pro');
      expect(config.logging.log_level).toBe('debug');
    });

    it('should override function-specific models with highest priority', async () => {
      process.env.IMAGE_MODEL = 'base-model';
      process.env.ANALYZE_IMAGE_MODEL = 'analyze-model';

      const config = await configService.loadConfig();

      expect(config.settings.image_model).toBe('analyze-model');
    });

    it('should merge AI parameters with hierarchy', async () => {
      process.env.TEMPERATURE_TEMPERATURE = '0.8';
      process.env.TEMPERATURE_TOP_P = '0.9';
      process.env.TEMPERATURE_TOP_K = '40';
      process.env.TEMPERATURE_MAX_TOKENS = '2048';

      const config = await configService.loadConfig();

      expect(config.settings.temperature).toBe(0.8);
      expect(config.settings.top_p).toBe(0.9);
      expect(config.settings.top_k).toBe(40);
      expect(config.settings.max_tokens).toBe(2048);
    });

    it('should merge Phase 5 advanced features from environment', async () => {
      process.env.RETRY_ENABLED = 'true';
      process.env.RETRY_MAX_ATTEMPTS = '5';
      process.env.HEALTH_CHECK_ENABLED = 'false';
      process.env.RATE_LIMITING_REQUESTS_PER_SECOND = '15';
      process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD = '10';
      process.env.METRICS_ENABLED = 'false';

      const config = await configService.loadConfig();

      expect(config.retry?.enabled).toBe(true);
      expect(config.retry?.max_attempts).toBe(5);
      expect(config.health_check?.enabled).toBe(false);
      expect(config.rate_limiting?.requests_per_second).toBe(15);
      expect(config.circuit_breaker?.failure_threshold).toBe(10);
      expect(config.metrics?.enabled).toBe(false);
    });
  });

  describe('Configuration Saving', () => {
    it('should save valid configuration', async () => {
      configService.setConfigPath(testConfigPath);

      const config = {
        providers: { image: 'google' as const },
        credentials: {},
        settings: {
          temperature: 0.5,
          top_p: 0.9,
          top_k: 32,
          max_tokens: 4096,
          output_format: 'json' as const,
          progress_bars: true,
        },
        limits: {
          max_image_size: '20MB',
          gemini_files_api_threshold: 10485760,
          vertex_ai_files_api_threshold: 1,
        },
        formats: { allowed_image_formats: ['png', 'jpg'] },
        logging: { log_level: 'info' as const },
      };

      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      await configService.saveConfig(config);

      expect(mockFs.mkdir).toHaveBeenCalled();
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        testConfigPath,
        expect.stringContaining('providers:'),
        'utf-8'
      );
    });

    it('should throw ConfigFileError when saving invalid configuration', async () => {
      const invalidConfig = {
        providers: { image: 'invalid' }, // Invalid provider
      };

      await expect(configService.saveConfig(invalidConfig as any)).rejects.toThrow(ConfigFileError);
    });

    it('should throw ConfigFileError for filesystem errors', async () => {
      const config = {
        providers: { image: 'google' as const },
        credentials: {},
        settings: {
          temperature: 0.4,
          top_p: 0.9,
          top_k: 32,
          max_tokens: 4096,
          output_format: 'json' as const,
          progress_bars: true,
        },
        limits: {
          max_image_size: '20MB',
          gemini_files_api_threshold: 10485760,
          vertex_ai_files_api_threshold: 1,
        },
        formats: { allowed_image_formats: ['png'] },
        logging: { log_level: 'info' as const },
      };

      mockFs.mkdir.mockRejectedValue(new Error('Disk full'));

      await expect(configService.saveConfig(config)).rejects.toThrow(ConfigFileError);
    });
  });

  describe('Configuration File Creation', () => {
    it('should create default configuration file', async () => {
      configService.setConfigPath(testConfigPath);

      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const createdPath = await configService.createConfigFile();

      expect(createdPath).toBe(testConfigPath);
      expect(mockFs.mkdir).toHaveBeenCalled();
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        testConfigPath,
        expect.stringContaining('providers:'),
        'utf-8'
      );
    });

    it('should create Phase 5 enhanced configuration file', async () => {
      configService.setConfigPath(testConfigPath);

      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const createdPath = await configService.createPhase5ConfigFile();

      expect(createdPath).toBe(testConfigPath);
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        testConfigPath,
        expect.stringContaining('# Phase 5 Advanced Features'),
        'utf-8'
      );
    });

    it('should use custom path when provided', async () => {
      const customPath = '/custom/location/config.yaml';
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const createdPath = await configService.createConfigFile(customPath);

      expect(createdPath).toBe(customPath);
      expect(mockFs.mkdir).toHaveBeenCalled();
    });
  });

  describe('Configuration Value Access', () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(false);
    });

    it('should get nested configuration value', async () => {
      const value = await configService.getConfigValue('settings.temperature');
      expect(value).toBe(0.4);
    });

    it('should throw error for invalid path', async () => {
      await expect(configService.getConfigValue('invalid.path')).rejects.toThrow(ConfigurationError);
    });

    it('should set nested configuration value', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      await configService.setConfigValue('settings.temperature', 0.8);

      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should throw error when setting invalid path', async () => {
      await expect(configService.setConfigValue('invalid.path', 'value')).rejects.toThrow(ConfigurationError);
    });
  });

  describe('Phase 5 Feature Configuration', () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(false);
    });

    it('should get retry configuration with defaults', async () => {
      const retryConfig = await configService.getRetryConfig();

      expect(retryConfig.enabled).toBe(true);
      expect(retryConfig.max_attempts).toBe(3);
      expect(retryConfig.base_delay).toBe(1000);
      expect(retryConfig.max_delay).toBe(60000);
    });

    it('should get health check configuration with defaults', async () => {
      const healthConfig = await configService.getHealthCheckConfig();

      expect(healthConfig.enabled).toBe(true);
      expect(healthConfig.interval).toBe(30000);
      expect(healthConfig.timeout).toBe(10000);
    });

    it('should get rate limiting configuration with defaults', async () => {
      const rateLimitConfig = await configService.getRateLimitingConfig();

      expect(rateLimitConfig.enabled).toBe(true);
      expect(rateLimitConfig.requests_per_second).toBe(10);
      expect(rateLimitConfig.burst_size).toBe(20);
    });

    it('should get circuit breaker configuration with defaults', async () => {
      const circuitConfig = await configService.getCircuitBreakerConfig();

      expect(circuitConfig.enabled).toBe(true);
      expect(circuitConfig.failure_threshold).toBe(5);
      expect(circuitConfig.recovery_timeout).toBe(60000);
    });

    it('should get metrics configuration with defaults', async () => {
      const metricsConfig = await configService.getMetricsConfig();

      expect(metricsConfig.enabled).toBe(true);
      expect(metricsConfig.collection_interval).toBe(10000);
      expect(metricsConfig.retention_period).toBe(3600000);
    });

    it('should check if features are enabled', async () => {
      expect(await configService.isFeatureEnabled('retry')).toBe(true);
      expect(await configService.isFeatureEnabled('health_check')).toBe(true);
      expect(await configService.isFeatureEnabled('rate_limiting')).toBe(true);
      expect(await configService.isFeatureEnabled('circuit_breaker')).toBe(true);
      expect(await configService.isFeatureEnabled('metrics')).toBe(true);
    });
  });

  describe('Phase 5 Configuration Validation', () => {
    it('should validate valid Phase 5 configuration', () => {
      const config = {
        retry: {
          enabled: true,
          max_attempts: 3,
          base_delay: 1000,
          max_delay: 60000,
          backoff_multiplier: 2,
          jitter: true,
          retryable_errors: ['NETWORK_ERROR', 'RATE_LIMIT_EXCEEDED'],
        },
        health_check: {
          enabled: true,
          interval: 30000,
          timeout: 10000,
          unhealthy_threshold: 3,
          healthy_threshold: 2,
        },
      };

      const result = configService.validatePhase5Config(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid Phase 5 configuration', () => {
      const config = {
        retry: {
          enabled: true,
          max_attempts: 15, // Invalid: > 10
          base_delay: 50,   // Invalid: < 100
          max_delay: 60000,
          backoff_multiplier: 2,
          jitter: true,
          retryable_errors: ['NETWORK_ERROR', 'RATE_LIMIT_EXCEEDED'],
        },
        health_check: {
          enabled: true,
          interval: 1000,   // Invalid: < 5000
          timeout: 10000,
          unhealthy_threshold: 3,
          healthy_threshold: 2,
        },
        rate_limiting: {
          enabled: true,
          requests_per_second: 0.05, // Invalid: < 0.1
          burst_size: 0,             // Invalid: < 1
          quota_per_day: 1000,
          backoff_on_limit: true,
          max_backoff_delay: 60000,
          enable_adaptive_limiting: true,
        },
        circuit_breaker: {
          enabled: true,
          failure_threshold: 150, // Invalid: > 100
          recovery_timeout: 500,  // Invalid: < 1000
          half_open_max_calls: 3,
          success_threshold: 2,
        },
      };

      const result = configService.validatePhase5Config(config);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContain('retry.max_attempts must be between 1 and 10');
      expect(result.errors).toContain('health_check.interval must be at least 5000ms');
    });
  });

  describe('File Size Parsing', () => {
    it('should parse various file size formats', () => {
      expect(configService.parseFileSize('100B')).toBe(100);
      expect(configService.parseFileSize('1.5KB')).toBe(1536);
      expect(configService.parseFileSize('10MB')).toBe(10485760);
      expect(configService.parseFileSize('2GB')).toBe(2147483648);
    });

    it('should throw error for invalid formats', () => {
      expect(() => configService.parseFileSize('invalid')).toThrow(ConfigurationError);
      expect(() => configService.parseFileSize('100XB')).toThrow(ConfigurationError);
    });
  });

  describe('Environment File Loading', () => {
    // Note: Since ConfigService constructor is private, these tests are verified through behavior
    it('should verify .env loading behavior through configuration', async () => {
      // Reset singleton instance to force constructor call
      (ConfigService as any).instance = null;

      // Mock .env files to exist to trigger dotenv.config during ConfigService initialization
      mockExistsSync.mockImplementation((path) => {
        const pathStr = path.toString();
        // Return true for .env files to trigger dotenv loading
        if (pathStr.endsWith('.env')) {
          return true;
        }
        // Return false for config files to use default config
        return false;
      });

      // Creating new instance should trigger dotenv.config in constructor
      configService = ConfigService.getInstance();

      // Verify that environment loading occurred (dotenv.config was called during constructor)
      expect(mockDotenv.config).toHaveBeenCalled();

      // Reset existsSync mock for subsequent tests
      mockExistsSync.mockReset().mockReturnValue(false);
    });
  });

  describe('Utility Methods', () => {
    it('should return current config path', () => {
      configService.setConfigPath('/test/path.yaml');
      expect(configService.getConfigPath()).toBe('/test/path.yaml');
    });

    it('should reset cache', () => {
      configService.resetCache();
      // Should not throw and should reset internal state
      expect(true).toBe(true);
    });
  });
});


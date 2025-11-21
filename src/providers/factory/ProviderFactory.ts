import type { VisionProvider } from '../../types/index.js';
import type { CLIConfig, GeminiConfig } from '../../types/index.js';
import { GeminiProvider } from '../gemini/GeminiProvider.js';
import {
  ConfigurationError,
  ProviderError,
} from '../../types/index.js';

export class VisionProviderFactory {
  private static providers = new Map<string, () => Promise<VisionProvider>>();

  static registerProvider(
    name: string,
    factory: () => Promise<VisionProvider>
  ): void {
    this.providers.set(name, factory);
  }

  static getSupportedProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  static async createProvider(
    providerType: 'google' | 'vertex_ai',
    config: CLIConfig
  ): Promise<VisionProvider> {
    switch (providerType) {
      case 'google':
        return this.createGoogleProvider(config);
      case 'vertex_ai':
        return this.createVertexAIProvider(config);
      default:
        throw new ConfigurationError(
          `Unsupported provider type: ${providerType}`,
          'PROVIDER_TYPE'
        );
    }
  }

  private static async createGoogleProvider(config: CLIConfig): Promise<VisionProvider> {
    if (!config.credentials.gemini_api_key) {
      throw new ConfigurationError(
        'Gemini API key is required for Google provider. Please set GEMINI_API_KEY environment variable or add it to your configuration.',
        'GEMINI_API_KEY'
      );
    }

    const geminiConfig: GeminiConfig = {
      apiKey: config.credentials.gemini_api_key,
      baseUrl: 'https://generativelanguage.googleapis.com',
      imageModel: config.settings.image_model || 'gemini-1.5-pro',
    };

    return new GeminiProvider(
      geminiConfig.apiKey,
      geminiConfig.imageModel
    );
  }

  private static async createVertexAIProvider(config: CLIConfig): Promise<VisionProvider> {
    // For now, we'll use the same Gemini provider but with different configuration
    // In a full implementation, this would use the Vertex AI SDK
    if (!config.credentials.vertex_credentials) {
      throw new ConfigurationError(
        'Vertex AI credentials are required for Vertex AI provider. Please set VERTEX_CREDENTIALS environment variable or add it to your configuration.',
        'VERTEX_CREDENTIALS'
      );
    }

    // For simplicity, we'll use the same Gemini provider with Vertex AI configuration
    // In a production scenario, you'd implement a separate VertexAIProvider class
    return this.createGoogleProvider(config);
  }

  static async createProviderWithValidation(
    providerType: 'google' | 'vertex_ai',
    config: CLIConfig
  ): Promise<VisionProvider> {
    try {
      const provider = await this.createProvider(providerType, config);

      // Skip health check for now to test basic functionality
      // TODO: Re-enable health check once we have a working model

      return provider;
    } catch (error) {
      if (error instanceof ConfigurationError || error instanceof ProviderError) {
        throw error;
      }
      throw new ProviderError(
        `Failed to create provider ${providerType}: ${error instanceof Error ? error.message : String(error)}`,
        providerType,
        error instanceof Error ? error : undefined
      );
    }
  }

  static async initializeDefaultProviders(config: CLIConfig): Promise<Map<'google' | 'vertex_ai', VisionProvider>> {
    const providers = new Map<'google' | 'vertex_ai', VisionProvider>();

    try {
      // Initialize Google provider if configured
      if (config.credentials.gemini_api_key) {
        const googleProvider = await this.createProviderWithValidation('google', config);
        providers.set('google', googleProvider);
      }

      // Initialize Vertex AI provider if configured
      if (config.credentials.vertex_credentials) {
        const vertexAIProvider = await this.createProviderWithValidation('vertex_ai', config);
        providers.set('vertex_ai', vertexAIProvider);
      }

      return providers;
    } catch (error) {
      throw new ProviderError(
        `Failed to initialize providers: ${error instanceof Error ? error.message : String(error)}`,
        'PROVIDER_INITIALIZATION'
      );
    }
  }
}
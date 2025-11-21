import type { VisionProvider } from '../types/index.js';
import { ConfigService } from '../config/ConfigService.js';
import { VisionProviderFactory } from '../providers/factory/ProviderFactory.js';
import {
  VisionError,
} from '../types/index.js';

export class VisionService {
  private static instance: VisionService;
  private providers: Map<string, VisionProvider> | null = null;
  private configService: ConfigService;

  private constructor() {
    this.configService = ConfigService.getInstance();
    this.providers = null;
  }

  public static getInstance(): VisionService {
    if (!VisionService.instance) {
      VisionService.instance = new VisionService();
    }
    return VisionService.instance;
  }

  public async initializeProviders(force = false): Promise<void> {
    if (this.providers && !force) {
      return;
    }

    try {
      const config = await this.configService.loadConfig();
      this.providers = await VisionProviderFactory.initializeDefaultProviders(config);
    } catch (error) {
      throw new VisionError(
        `Failed to initialize vision providers: ${error instanceof Error ? error.message : String(error)}`,
        'PROVIDER_INITIALIZATION_ERROR'
      );
    }
  }

  public async getProvider(providerType?: 'google' | 'vertex_ai'): Promise<VisionProvider> {
    await this.initializeProviders();

    if (!this.providers || this.providers.size === 0) {
      throw new VisionError(
        'No providers are available. Please run "ai-vision init" to set up configuration.',
        'NO_PROVIDERS_AVAILABLE'
      );
    }

    let providerName: 'google' | 'vertex_ai';

    if (providerType) {
      providerName = providerType;
    } else {
      const config = await this.configService.loadConfig();
      providerName = config.providers.image || 'google';
    }

    const provider = this.providers.get(providerName);

    if (!provider) {
      throw new VisionError(
        `Provider "${providerName}" is not available. Please check your configuration.`,
        'PROVIDER_NOT_AVAILABLE'
      );
    }

    return provider;
  }

  public async getAvailableProviders(): Promise<string[]> {
    await this.initializeProviders();

    if (!this.providers) {
      return [];
    }

    return Array.from(this.providers.keys());
  }

  public async getProviderInfo(providerType?: 'google' | 'vertex_ai'): Promise<any> {
    const provider = await this.getProvider(providerType);
    return provider.getProviderInfo();
  }

  public async healthCheck(providerType?: 'google' | 'vertex_ai'): Promise<any> {
    const provider = await this.getProvider(providerType);
    return provider.healthCheck();
  }

  public resetProviders(): void {
    this.providers = null;
  }

    public async analyzeImage(
    imageSource: string,
    prompt: string,
    options?: any,
    providerType?: 'google' | 'vertex_ai'
  ): Promise<any> {
    const provider = await this.getProvider(providerType);
    return provider.analyzeImage(imageSource, prompt, options);
  }

  
  public async compareImages(
    imageSources: string[],
    prompt: string,
    options?: any,
    providerType?: 'google' | 'vertex_ai'
  ): Promise<any> {
    const provider = await this.getProvider(providerType);
    return provider.compareImages(imageSources, prompt, options);
  }

  public async uploadFile(
    buffer: Buffer,
    filename: string,
    mimeType: string,
    providerType?: 'google' | 'vertex_ai'
  ): Promise<any> {
    const provider = await this.getProvider(providerType);
    return provider.uploadFile(buffer, filename, mimeType);
  }

  public async downloadFile(
    fileId: string,
    providerType?: 'google' | 'vertex_ai'
  ): Promise<Buffer> {
    const provider = await this.getProvider(providerType);
    return provider.downloadFile(fileId);
  }

  public async deleteFile(
    fileId: string,
    providerType?: 'google' | 'vertex_ai'
  ): Promise<void> {
    const provider = await this.getProvider(providerType);
    return provider.deleteFile(fileId);
  }

    public async detectObjects(
    imageSource: string,
    prompt: string,
    options?: any,
    providerType?: 'google' | 'vertex_ai'
  ): Promise<any> {
    const provider = await this.getProvider(providerType);
    return provider.analyzeImage(imageSource, prompt, options);
  }
}
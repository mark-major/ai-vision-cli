import type {
  VisionProvider,
  AnalysisOptions,
  AnalysisResult,
  UploadedFile,
  HealthStatus,
  ProviderCapabilities,
  ModelCapabilities,
  ProviderInfo,
  AnalysisMetadata,
  UsageMetadata,
} from '../../types/index.js';
import type { GeminiConfig } from '../../types/index.js';

export abstract class BaseVisionProvider implements VisionProvider {
  protected config: GeminiConfig;
  protected imageModel: string;
  protected providerName: string;

  constructor(config: GeminiConfig, providerName: string) {
    this.config = config;
    this.providerName = providerName;
    this.imageModel = config.imageModel;
  }

    protected buildConfigWithOptions(
    taskType: 'image',
    functionName?: string,
    options?: AnalysisOptions
  ): any {
    const config: any = {
      temperature: this.resolveTemperatureForFunction(taskType, functionName),
      topP: this.resolveTopPForFunction(taskType, functionName),
      topK: this.resolveTopKForFunction(taskType, functionName),
      maxOutputTokens: this.resolveMaxTokensForFunction(taskType, functionName),
      candidateCount: 1,
    };

    if (options?.stopSequences && options.stopSequences.length > 0) {
      config.stopSequences = options.stopSequences;
    }

    if (options?.responseSchema) {
      config.responseMimeType = 'application/json';
      config.responseSchema = options.responseSchema;
    }

    if (options?.systemInstruction) {
      config.systemInstruction = options.systemInstruction;
    }

    return config;
  }

    protected resolveTemperatureForFunction(
    taskType: 'image',
    functionName?: string
  ): number {
    const envKey = functionName
      ? `TEMPERATURE_FOR_${functionName.toUpperCase()}`
      : undefined;

    if (envKey && process.env[envKey]) {
      return parseFloat(process.env[envKey]);
    }

    const taskKey = `TEMPERATURE_FOR_${taskType.toUpperCase()}`;
    if (process.env[taskKey]) {
      return parseFloat(process.env[taskKey]);
    }

    if (process.env.TEMPERATURE) {
      return parseFloat(process.env.TEMPERATURE);
    }
    return 0.4;
  }

  protected resolveTopPForFunction(
    taskType: 'image',
    functionName?: string
  ): number {
    const envKey = functionName
      ? `TOP_P_FOR_${functionName.toUpperCase()}`
      : undefined;

    if (envKey && process.env[envKey]) {
      return parseFloat(process.env[envKey]);
    }

    const taskKey = `TOP_P_FOR_${taskType.toUpperCase()}`;
    if (process.env[taskKey]) {
      return parseFloat(process.env[taskKey]);
    }

    if (process.env.TOP_P) {
      return parseFloat(process.env.TOP_P);
    }

    return 0.95;
  }

  protected resolveTopKForFunction(
    taskType: 'image',
    functionName?: string
  ): number {
    const envKey = functionName
      ? `TOP_K_FOR_${functionName.toUpperCase()}`
      : undefined;

    if (envKey && process.env[envKey]) {
      return parseInt(process.env[envKey]);
    }

    const taskKey = `TOP_K_FOR_${taskType.toUpperCase()}`;
    if (process.env[taskKey]) {
      return parseInt(process.env[taskKey]);
    }

    if (process.env.TOP_K) {
      return parseInt(process.env.TOP_K);
    }

    return 32;
  }

  protected resolveMaxTokensForFunction(
    taskType: 'image',
    functionName?: string
  ): number {
    const envKey = functionName
      ? `MAX_TOKENS_FOR_${functionName.toUpperCase()}`
      : undefined;

    if (envKey && process.env[envKey]) {
      return parseInt(process.env[envKey]);
    }

    const taskKey = `MAX_TOKENS_FOR_${taskType.toUpperCase()}`;
    if (process.env[taskKey]) {
      return parseInt(process.env[taskKey]);
    }

    if (process.env.MAX_TOKENS) {
      return parseInt(process.env.MAX_TOKENS);
    }

    return 4096;
  }

  protected createAnalysisResult(
    text: string,
    model: string,
    usage?: UsageMetadata,
    processingTime?: number,
    responseId?: string
  ): AnalysisResult {
    const metadata: AnalysisMetadata = {
      model,
      provider: this.providerName,
      usage,
      processingTime,
      modelVersion: model,
      responseId,
    };

    return {
      text,
      metadata,
    };
  }

    abstract analyzeImage(
    imageSource: string,
    prompt: string,
    options?: AnalysisOptions
  ): Promise<AnalysisResult>;

  
  abstract compareImages(
    imageSources: string[],
    prompt: string,
    options?: AnalysisOptions
  ): Promise<AnalysisResult>;

  abstract uploadFile(
    buffer: Buffer,
    filename: string,
    mimeType: string
  ): Promise<UploadedFile>;

  abstract downloadFile(fileId: string): Promise<Buffer>;

  abstract deleteFile(fileId: string): Promise<void>;

  abstract setModel(imageModel: string): void;
  abstract getImageModel(): string;

  abstract getSupportedFormats(): ProviderCapabilities;
  abstract getModelCapabilities(): ModelCapabilities;
  abstract getProviderInfo(): ProviderInfo;
  abstract healthCheck(): Promise<HealthStatus>;
}
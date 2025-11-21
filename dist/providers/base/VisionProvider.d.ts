import type { VisionProvider, AnalysisOptions, AnalysisResult, UploadedFile, HealthStatus, ProviderCapabilities, ModelCapabilities, ProviderInfo, UsageMetadata } from '../../types/index.js';
import type { GeminiConfig } from '../../types/index.js';
export declare abstract class BaseVisionProvider implements VisionProvider {
    protected config: GeminiConfig;
    protected imageModel: string;
    protected providerName: string;
    constructor(config: GeminiConfig, providerName: string);
    protected buildConfigWithOptions(taskType: 'image', functionName?: string, options?: AnalysisOptions): any;
    protected resolveTemperatureForFunction(taskType: 'image', functionName?: string): number;
    protected resolveTopPForFunction(taskType: 'image', functionName?: string): number;
    protected resolveTopKForFunction(taskType: 'image', functionName?: string): number;
    protected resolveMaxTokensForFunction(taskType: 'image', functionName?: string): number;
    protected createAnalysisResult(text: string, model: string, usage?: UsageMetadata, processingTime?: number, responseId?: string): AnalysisResult;
    abstract analyzeImage(imageSource: string, prompt: string, options?: AnalysisOptions): Promise<AnalysisResult>;
    abstract compareImages(imageSources: string[], prompt: string, options?: AnalysisOptions): Promise<AnalysisResult>;
    abstract uploadFile(buffer: Buffer, filename: string, mimeType: string): Promise<UploadedFile>;
    abstract downloadFile(fileId: string): Promise<Buffer>;
    abstract deleteFile(fileId: string): Promise<void>;
    abstract setModel(imageModel: string): void;
    abstract getImageModel(): string;
    abstract getSupportedFormats(): ProviderCapabilities;
    abstract getModelCapabilities(): ModelCapabilities;
    abstract getProviderInfo(): ProviderInfo;
    abstract healthCheck(): Promise<HealthStatus>;
}
//# sourceMappingURL=VisionProvider.d.ts.map
import type { AnalysisOptions, AnalysisResult, HealthStatus, UploadedFile } from '../../types/index.js';
import { BaseVisionProvider } from '../base/VisionProvider.js';
export declare class GeminiProvider extends BaseVisionProvider {
    private client;
    private fileService;
    constructor(apiKey: string, imageModel: string);
    analyzeImage(imageSource: string, prompt: string, options?: AnalysisOptions): Promise<AnalysisResult>;
    compareImages(imageSources: string[], prompt: string, options?: AnalysisOptions): Promise<AnalysisResult>;
    uploadFile(buffer: Buffer, filename: string, mimeType: string): Promise<UploadedFile>;
    downloadFile(_fileId: string): Promise<Buffer>;
    deleteFile(_fileId: string): Promise<void>;
    setModel(imageModel: string): void;
    getImageModel(): string;
    getSupportedFormats(): {
        supportedImageFormats: string[];
        maxImageSize: number;
        supportsFileUpload: boolean;
    };
    getModelCapabilities(): {
        imageAnalysis: boolean;
        maxTokensForImage: number;
        supportedFormats: string[];
    };
    getProviderInfo(): {
        name: string;
        version: string;
        description: string;
        capabilities: {
            supportedImageFormats: string[];
            maxImageSize: number;
            supportsFileUpload: boolean;
        };
        modelCapabilities: {
            imageAnalysis: boolean;
            maxTokensForImage: number;
            supportedFormats: string[];
        };
    };
    healthCheck(): Promise<HealthStatus>;
    supportsVideo(): boolean;
    private buildContentFromReference;
    private handleError;
}
//# sourceMappingURL=GeminiProvider.d.ts.map
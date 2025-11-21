import type { VisionProvider } from '../types/index.js';
export declare class VisionService {
    private static instance;
    private providers;
    private configService;
    private constructor();
    static getInstance(): VisionService;
    initializeProviders(force?: boolean): Promise<void>;
    getProvider(providerType?: 'google' | 'vertex_ai'): Promise<VisionProvider>;
    getAvailableProviders(): Promise<string[]>;
    getProviderInfo(providerType?: 'google' | 'vertex_ai'): Promise<any>;
    healthCheck(providerType?: 'google' | 'vertex_ai'): Promise<any>;
    resetProviders(): void;
    analyzeImage(imageSource: string, prompt: string, options?: any, providerType?: 'google' | 'vertex_ai'): Promise<any>;
    compareImages(imageSources: string[], prompt: string, options?: any, providerType?: 'google' | 'vertex_ai'): Promise<any>;
    uploadFile(buffer: Buffer, filename: string, mimeType: string, providerType?: 'google' | 'vertex_ai'): Promise<any>;
    downloadFile(fileId: string, providerType?: 'google' | 'vertex_ai'): Promise<Buffer>;
    deleteFile(fileId: string, providerType?: 'google' | 'vertex_ai'): Promise<void>;
    detectObjects(imageSource: string, prompt: string, options?: any, providerType?: 'google' | 'vertex_ai'): Promise<any>;
}
//# sourceMappingURL=VisionService.d.ts.map
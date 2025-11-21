import type { VisionProvider, FileReference } from '../types/index.js';
export interface FileProcessingResult {
    buffer: Buffer;
    mimeType: string;
    filename?: string;
    source: 'url' | 'local' | 'base64';
}
export interface FileAnalysisResult {
    reference: FileReference;
    processingInfo: {
        size: number;
        method: 'inline_data' | 'file_uri';
        threshold: number;
    };
}
export declare class FileService {
    private provider;
    private filesThreshold;
    constructor(provider: VisionProvider, filesThreshold?: number);
    handleImageSource(imageSource: string): Promise<FileAnalysisResult>;
    handleMultipleImages(imageSources: string[]): Promise<FileAnalysisResult[]>;
    readFile(filePath: string): Promise<Buffer>;
    private getImageData;
    private handleBase64Image;
    private handleUrlImage;
    private handleLocalFile;
    private isPublicUrl;
    private isLocalFilePath;
    private getMimeType;
    private getMimeTypeFromBuffer;
    private isSupportedFileType;
    private getSupportedFileTypes;
    private getMaxFileSize;
    private getFileExtension;
}
//# sourceMappingURL=FileService.d.ts.map
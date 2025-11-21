export type TaskType = 'image';
export type FunctionName = 'analyze_image' | 'compare_images' | 'detect_objects_in_image';
export interface AnalysisOptions {
    temperature?: number;
    topP?: number;
    topK?: number;
    maxTokens?: number;
    maxTokensForImage?: number;
    stopSequences?: string[];
    taskType?: TaskType;
    functionName?: FunctionName;
    responseSchema?: any;
    systemInstruction?: string;
    enableFileUpload?: boolean;
    filesThreshold?: number;
    includeMetadata?: boolean;
    debugMode?: boolean;
}
export interface AnalysisResult {
    text: string;
    metadata: AnalysisMetadata;
}
export interface AnalysisMetadata {
    model: string;
    provider: string;
    usage?: UsageMetadata;
    processingTime?: number;
    fileType?: string;
    fileSize?: number;
    modelVersion?: string;
    responseId?: string;
}
export interface UsageMetadata {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
}
export interface UploadedFile {
    id: string;
    filename: string;
    mimeType: string;
    size: number;
    url?: string;
    uri?: string;
    displayName?: string;
    state?: 'PROCESSING' | 'ACTIVE' | 'FAILED';
    createTime?: string;
    updateTime?: string;
    expirationTime?: string;
    sha256Hash?: string;
}
export interface FileReference {
    type: 'file_uri' | 'public_url' | 'base64' | 'inline_data';
    uri?: string;
    url?: string;
    data?: string;
    mimeType: string;
}
export interface HealthStatus {
    status: 'healthy' | 'unhealthy' | 'degraded';
    message?: string;
    lastCheck: string;
    responseTime?: number;
}
export interface RateLimitInfo {
    requestsPerMinute?: number;
    requestsPerDay?: number;
    currentUsage?: {
        requestsPerMinute: number;
        requestsPerDay: number;
    };
    resetTime?: string;
}
export interface ProviderCapabilities {
    supportedImageFormats: string[];
    maxImageSize: number;
    supportsFileUpload: boolean;
}
export interface ModelCapabilities {
    imageAnalysis: boolean;
    maxTokensForImage: number;
    supportedFormats: string[];
}
export interface ProviderInfo {
    name: string;
    version: string;
    description: string;
    capabilities: ProviderCapabilities;
    modelCapabilities: ModelCapabilities;
    rateLimit?: RateLimitInfo;
}
export interface CLIAnalysisResult {
    success: boolean;
    result: any;
    metadata: {
        executionTime: number;
        timestamp: string;
        provider?: string;
        model?: string;
    };
}
export interface BatchAnalysisResult {
    results: CLIAnalysisResult[];
    summary: BatchSummary;
    errors: Array<{
        file: string;
        error: string;
    }>;
}
export interface BatchSummary {
    total: number;
    successful: number;
    failed: number;
    totalExecutionTime: number;
    averageExecutionTime: number;
}
export interface ComparisonResult {
    similarities: string[];
    differences: string[];
    overallScore: number;
    detailedAnalysis: string;
}
export interface ObjectDetectionResult {
    objects: DetectedObject[];
    annotations: AnnotationResult[];
    imageInfo: ImageInfo;
    metadata: AnalysisMetadata;
}
export interface DetectedObject {
    name: string;
    confidence: number;
    boundingBox: BoundingBox;
    attributes?: Record<string, unknown>;
}
export interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface AnnotationResult {
    imagePath: string;
    mimeType: string;
    size: number;
    annotations: DetectedObject[];
}
export interface ImageInfo {
    width: number;
    height: number;
    format: string;
    colorSpace: string;
    hasAlpha: boolean;
}
export interface ProgressInfo {
    current: number;
    total: number;
    message: string;
    percentage: number;
    eta?: number;
}
export interface ProgressCallback {
    (progress: ProgressInfo): void;
}
//# sourceMappingURL=Analysis.d.ts.map
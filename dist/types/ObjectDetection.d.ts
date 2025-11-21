import type { AnalysisOptions } from './Analysis';
export interface DetectedObject {
    object: string;
    label: string;
    normalized_box_2d: [number, number, number, number];
    confidence?: number;
    attributes?: Record<string, unknown>;
}
export interface ObjectDetectionResult {
    detections: DetectedObject[];
    image_metadata: {
        width: number;
        height: number;
        size_bytes: number;
        format: string;
    };
    processing_time?: number;
    model: string;
    provider: string;
}
export interface ObjectDetectionArgs {
    imageSource: string;
    prompt?: string;
    outputFilePath?: string;
    options?: AnalysisOptions;
}
export interface ObjectDetectionMetadata {
    model: string;
    provider: string;
    usage?: {
        promptTokenCount: number;
        candidatesTokenCount: number;
        totalTokenCount: number;
    };
    processingTime: number;
    fileType?: string;
    fileSize?: number;
    modelVersion?: string;
    responseId?: string;
    fileSaveStatus?: 'saved' | 'skipped_due_to_permissions';
}
export interface CLIDetectionWithFile {
    detections: DetectedObject[];
    file: {
        path: string;
        size_bytes: number;
        format: string;
    };
    image_metadata: {
        width: number;
        height: number;
        original_size: number;
    };
    summary: string;
    metadata: ObjectDetectionMetadata;
    cliMetadata: {
        command: string;
        timestamp: string;
        executionTime: number;
        outputPath?: string;
    };
}
export interface CLIDetectionWithTempFile {
    detections: DetectedObject[];
    tempFile: {
        path: string;
        size_bytes: number;
        format: string;
    };
    image_metadata: {
        width: number;
        height: number;
        original_size: number;
    };
    summary: string;
    metadata: ObjectDetectionMetadata;
    cliMetadata: {
        command: string;
        timestamp: string;
        executionTime: number;
        outputPath?: string;
    };
}
export interface CLIDetectionOnly {
    detections: DetectedObject[];
    image_metadata: {
        width: number;
        height: number;
        original_size: number;
    };
    summary: string;
    metadata: ObjectDetectionMetadata;
    cliMetadata: {
        command: string;
        timestamp: string;
        executionTime: number;
    };
}
export type ObjectDetectionResponse = CLIDetectionWithFile | CLIDetectionWithTempFile | CLIDetectionOnly;
export interface BatchObjectDetectionResult {
    results: ObjectDetectionResponse[];
    summary: {
        total: number;
        successful: number;
        failed: number;
        totalObjects: number;
        totalExecutionTime: number;
        averageExecutionTime: number;
    };
    errors: Array<{
        file: string;
        error: string;
    }>;
}
export interface DetectionFilterOptions {
    minConfidence?: number;
    objectTypes?: string[];
    excludeTypes?: string[];
    maxResults?: number;
}
export interface DetectionOutputOptions {
    format: 'json' | 'csv' | 'coco' | 'yolo';
    includeMetadata: boolean;
    includeSummary: boolean;
    generateAnnotations: boolean;
    annotationStyle: 'bbox' | 'label' | 'confidence';
}
export interface WebElementDetection {
    element: DetectedObject;
    cssSelector: string;
    xpath: string;
    webElementType: string;
    accessibilityLabel?: string;
}
export interface WebPageDetectionResult {
    elements: WebElementDetection[];
    layout: {
        sections: Array<{
            type: string;
            bounds: [number, number, number, number];
            elements: string[];
        }>;
    };
    summary: string;
    metadata: ObjectDetectionMetadata;
}
//# sourceMappingURL=ObjectDetection.d.ts.map
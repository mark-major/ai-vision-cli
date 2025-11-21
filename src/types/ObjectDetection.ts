/**
 * Object detection types for AI Vision CLI
 */

import type { AnalysisOptions } from './Analysis';

export interface DetectedObject {
  object: string; // Generic category for detected object
  label: string; // Descriptive label or instance-specific detail
  normalized_box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax] normalized to 0-1000
  confidence?: number; // Confidence score 0-1
  attributes?: Record<string, unknown>; // Additional object attributes
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
  imageSource: string; // URL, base64, or local file path
  prompt?: string; // Optional custom detection prompt
  outputFilePath?: string; // Optional explicit output path
  options?: AnalysisOptions; // Optional API configuration parameters
}

// Enhanced metadata interface for object detection responses
export interface ObjectDetectionMetadata {
  model: string; // "gemini-2.5-flash-lite"
  provider: string; // "google" | "vertex_ai"
  usage?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
  processingTime: number; // milliseconds
  fileType?: string; // "image/png"
  fileSize?: number; // bytes
  modelVersion?: string; // "gemini-2.5-flash-lite"
  responseId?: string; // "abc123..."
  fileSaveStatus?: 'saved' | 'skipped_due_to_permissions'; // File save status
}

// CLI-specific object detection response types
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
  summary: string; // Human-readable summary with percentage coordinates
  metadata: ObjectDetectionMetadata; // Enhanced metadata
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
  summary: string; // Human-readable summary with percentage coordinates
  metadata: ObjectDetectionMetadata; // Enhanced metadata
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
  summary: string; // Human-readable summary with percentage coordinates
  metadata: ObjectDetectionMetadata; // Enhanced metadata
  cliMetadata: {
    command: string;
    timestamp: string;
    executionTime: number;
  };
}

// Union type for all possible response types
export type ObjectDetectionResponse = CLIDetectionWithFile | CLIDetectionWithTempFile | CLIDetectionOnly;

// Batch object detection types
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

// Object detection filtering options
export interface DetectionFilterOptions {
  minConfidence?: number; // Minimum confidence threshold (0-1)
  objectTypes?: string[]; // Filter to specific object types
  excludeTypes?: string[]; // Exclude specific object types
  maxResults?: number; // Maximum number of detections to return
}

// Output formatting options
export interface DetectionOutputOptions {
  format: 'json' | 'csv' | 'coco' | 'yolo'; // Output format
  includeMetadata: boolean; // Include detailed metadata
  includeSummary: boolean; // Include human-readable summary
  generateAnnotations: boolean; // Generate annotated image files
  annotationStyle: 'bbox' | 'label' | 'confidence'; // Annotation style
}

// CSS selector generation for web elements
export interface WebElementDetection {
  element: DetectedObject;
  cssSelector: string;
  xpath: string;
  webElementType: string; // button, link, input, etc.
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
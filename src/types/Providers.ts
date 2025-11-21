/**
 * Provider interface and types for AI Vision CLI
 */

import type {
  AnalysisOptions,
  AnalysisResult,
  UploadedFile,
  FileReference,
  HealthStatus,
  ProviderCapabilities,
  ModelCapabilities,
  ProviderInfo,
} from './Analysis';

export type {
  AnalysisOptions,
  AnalysisResult,
  UploadedFile,
  FileReference,
  HealthStatus,
  ProviderCapabilities,
  ModelCapabilities,
  ProviderInfo,
} from './Analysis';

export interface VisionProvider {
  // Core capabilities
  analyzeImage(
    imageSource: string,
    prompt: string,
    options?: AnalysisOptions
  ): Promise<AnalysisResult>;
  compareImages(
    imageSources: string[],
    prompt: string,
    options?: AnalysisOptions
  ): Promise<AnalysisResult>;

  // File operations
  uploadFile(
    buffer: Buffer,
    filename: string,
    mimeType: string
  ): Promise<UploadedFile>;
  downloadFile(fileId: string): Promise<Buffer>;
  deleteFile(fileId: string): Promise<void>;

  // Model configuration
  setModel(imageModel: string): void;
  getImageModel(): string;

  // Provider information
  getSupportedFormats(): ProviderCapabilities;
  getModelCapabilities(): ModelCapabilities;
  getProviderInfo(): ProviderInfo;

  // Health and status
  healthCheck(): Promise<HealthStatus>;
}

export interface FileUploadStrategy {
  uploadFile(
    buffer: Buffer,
    filename: string,
    mimeType: string
  ): Promise<UploadedFile>;
  getFileForAnalysis(uploadedFile: UploadedFile): Promise<FileReference>;
  cleanup?(fileId: string): Promise<void>;
}

export interface ProviderConfig {
  name: string;
  type: 'image';
  models: {
    image: string;
  };
  credentials: Record<string, string>;
  options: Record<string, unknown>;
}

export interface ProviderFactory {
  createProvider(config: ProviderConfig): VisionProvider;
  getSupportedProviders(): string[];
  registerProvider(name: string, factory: () => VisionProvider): void;
}

// CLI-specific provider interfaces
export interface CLIVisionProvider extends VisionProvider {
  // CLI-specific methods
  analyzeImageWithProgress(
    imageSource: string,
    prompt: string,
    options?: AnalysisOptions,
    progressCallback?: (progress: { message: string; percentage?: number }) => void
  ): Promise<AnalysisResult>;

  
  compareImagesWithProgress(
    imageSources: string[],
    prompt: string,
    options?: AnalysisOptions,
    progressCallback?: (progress: { message: string; percentage?: number }) => void
  ): Promise<AnalysisResult>;

  // Batch operations
  batchAnalyzeImages(
    imageSources: string[],
    prompts: string[],
    options?: AnalysisOptions,
    progressCallback?: (progress: { current: number; total: number; file: string }) => void
  ): Promise<AnalysisResult[]>;
}

// Provider selection and configuration
export interface ProviderSelection {
  image: 'google' | 'vertex_ai';
  video: 'google' | 'vertex_ai';
}

export interface ProviderCredentials {
  gemini?: {
    apiKey: string;
    baseUrl?: string;
  };
  vertexAI?: {
    projectId: string;
    location: string;
    credentials?: string;
    endpoint?: string;
  };
  storage?: {
    bucketName?: string;
    projectId?: string;
    credentials?: string;
    region?: string;
  };
}

// Gemini-specific types
export interface GeminiConfig {
  apiKey: string;
  baseUrl: string;
  imageModel: string;
  videoModel: string;
}

export interface GeminiFileMetadata {
  name: string;
  displayName: string;
  mimeType: string;
  sizeBytes: string;
  createTime: string;
  updateTime: string;
  expirationTime: string;
  sha256Hash: string;
  uri: string;
  state: 'PROCESSING' | 'ACTIVE' | 'FAILED';
}

export interface GeminiGenerateContentRequest {
  contents: GeminiContent[];
  generationConfig?: GeminiGenerationConfig;
  safetySettings?: GeminiSafetySetting[];
}

export interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

export type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }
  | { fileData: { mimeType: string; fileUri: string } };

export interface GeminiGenerationConfig {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  candidateCount?: number;
  stopSequences?: string[];
  responseMimeType?: string;
  responseSchema?: any;
}

export interface GeminiSafetySetting {
  category: string;
  threshold: string;
}

export interface GeminiGenerateContentResponse {
  candidates: GeminiCandidate[];
  usageMetadata: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
  modelVersion?: string;
}

export interface GeminiCandidate {
  content: GeminiContent;
  finishReason: string;
  index: number;
  safetyRatings?: GeminiSafetyRating[];
}

export interface GeminiSafetyRating {
  category: string;
  probability: string;
  blocked: boolean;
}

// Vertex AI-specific types
export interface VertexAIConfig {
  projectId: string;
  location: string;
  endpoint: string;
  credentials?: string;
  imageModel: string;
  videoModel: string;
}

export interface VertexAIGenerateContentRequest {
  contents: VertexAIContent[];
  generationConfig?: VertexAIGenerationConfig;
  safetySettings?: VertexAISafetySetting[];
}

export interface VertexAIContent {
  role: 'user' | 'model';
  parts: VertexAIPart[];
}

export type VertexAIPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }
  | { fileData: { mimeType: string; fileUri: string } };

export interface VertexAIGenerationConfig {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  candidateCount?: number;
  stopSequences?: string[];
  responseMimeType?: string;
  responseSchema?: any;
}

export interface VertexAISafetySetting {
  category: string;
  threshold: string;
}

export interface VertexAIGenerateContentResponse {
  candidates: VertexAICandidate[];
  usageMetadata: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
  modelVersion?: string;
}

export interface VertexAICandidate {
  content: VertexAIContent;
  finishReason: string;
  index: number;
  safetyRatings?: VertexAISafetyRating[];
}

export interface VertexAISafetyRating {
  category: string;
  probability: string;
  blocked: boolean;
}

// Provider management types
export interface ProviderRegistration {
  name: string;
  factory: (config: ProviderConfig) => VisionProvider;
  description: string;
  capabilities: ProviderCapabilities;
}

export interface ProviderStatus {
  name: string;
  available: boolean;
  lastCheck: string;
  error?: string;
  responseTime?: number;
}
import { GoogleGenerativeAI } from '@google/generative-ai';
import type {
  AnalysisOptions,
  AnalysisResult,
  HealthStatus,
  FileReference,
  UploadedFile,
} from '../../types/index.js';
import { BaseVisionProvider } from '../base/VisionProvider.js';
import { FileService } from '../../services/FileService.js';
import {
  VisionError,
  ProviderError,
  AuthenticationError,
  FileNotFoundError,
  NetworkError,
  RateLimitExceededError,
} from '../../types/index.js';

export class GeminiProvider extends BaseVisionProvider {
  private client: GoogleGenerativeAI;
  private fileService: FileService;

  constructor(apiKey: string, imageModel: string) {
    super(
      {
        apiKey,
        baseUrl: 'https://generativelanguage.googleapis.com',
        imageModel,
      },
      'google'
    );
    this.client = new GoogleGenerativeAI(apiKey);
    this.fileService = new FileService(this);
  }

  async analyzeImage(
    imageSource: string,
    prompt: string,
    options?: AnalysisOptions
  ): Promise<AnalysisResult> {
    const startTime = Date.now();

    try {
      // Use FileService to handle image processing
      const fileResult = await this.fileService.handleImageSource(imageSource);

      if (options?.debugMode) {
        console.log(`[GeminiProvider] File processing result:`, {
          method: fileResult.processingInfo.method,
          size: fileResult.processingInfo.size,
          threshold: fileResult.processingInfo.threshold,
          mimeType: fileResult.reference.mimeType,
        });
      }

      // Build content based on file reference type
      const content = this.buildContentFromReference(fileResult.reference, prompt);

      // Get model and generate content
      const model = this.client.getGenerativeModel({ model: this.imageModel });
      const config = this.buildConfigWithOptions('image', options?.functionName, options);

      if (options?.debugMode) {
        console.log(`[GeminiProvider] Generation config:`, config);
      }

      const response = await model.generateContent({
        contents: [content],
        generationConfig: config,
      });

      const processingTime = Date.now() - startTime;
      const responseText = response.response.text();

      return this.createAnalysisResult(
        responseText,
        this.imageModel,
        undefined, // Usage metadata not available in current API response
        processingTime,
        response.response.candidates?.[0]?.finishReason
      );

    } catch (error) {
      throw this.handleError(error, 'analyzeImage');
    }
  }

  
  async compareImages(
    imageSources: string[],
    prompt: string,
    options?: AnalysisOptions
  ): Promise<AnalysisResult> {
    const startTime = Date.now();

    try {
      // Validate image sources
      if (!imageSources || imageSources.length < 2) {
        throw new VisionError(
          'At least 2 images are required for comparison',
          'INVALID_INPUT'
        );
      }

      if (imageSources.length > 4) {
        throw new VisionError(
          'Maximum 4 images can be compared at once',
          'INVALID_INPUT'
        );
      }

      // Initialize file service
      const fileService = new FileService(
        this,
        options?.filesThreshold || 10485760 // 10MB default
      );

      // Process all images in parallel
      const imageProcessingResults = await fileService.handleMultipleImages(imageSources);

      // Build content parts for Gemini API
      const contents: any[] = [];

      // Add all images to content
      for (const result of imageProcessingResults) {
        if (result.reference.type === 'inline_data') {
          contents.push({
            inlineData: {
              mimeType: result.reference.mimeType,
              data: result.reference.data
            }
          });
        } else if (result.reference.type === 'file_uri') {
          contents.push({
            fileData: {
              fileUri: result.reference.uri,
              mimeType: result.reference.mimeType
            }
          });
        }
      }

      // Add the prompt as the final content part
      contents.push({ text: prompt });

      // Build configuration
      const config = this.buildConfigWithOptions('image', 'compare_images', options);

      if (options?.debugMode) {
        console.log('Gemini: Processing images for comparison...');
        console.log(`Images: ${imageSources.length}`);
        console.log(`Content parts: ${contents.length}`);
        imageProcessingResults.forEach((result, idx) => {
          console.log(`  Image ${idx + 1}: ${result.reference.type} (${result.processingInfo.size} bytes)`);
        });
      }

      // Get model and generate content
      const model = this.client.getGenerativeModel({ model: this.imageModel });

      // Generate content with Gemini
      const response = await model.generateContent({
        contents: contents,
        generationConfig: config,
      });

      const processingTime = Date.now() - startTime;
      const responseText = response.response?.text() || '';

      return this.createAnalysisResult(
        responseText,
        this.imageModel,
        {
          promptTokenCount: response.response?.usageMetadata?.promptTokenCount || 0,
          candidatesTokenCount: response.response?.usageMetadata?.candidatesTokenCount || 0,
          totalTokenCount: response.response?.usageMetadata?.totalTokenCount || 0,
        },
        processingTime
      );

    } catch (error) {

      if (error instanceof VisionError) {
        throw error;
      }

      // Handle specific Gemini errors
      if (error instanceof Error) {
        if (error.message.includes('quota')) {
          throw new VisionError(
            'API quota exceeded. Please try again later.',
            'QUOTA_EXCEEDED',
            'google',
            error
          );
        }

        if (error.message.includes('invalid')) {
          throw new VisionError(
            `Invalid request: ${error.message}`,
            'INVALID_REQUEST',
            'google'
          );
        }
      }

      throw new VisionError(
        `Failed to compare images: ${error instanceof Error ? error.message : String(error)}`,
        'COMPARISON_FAILED',
        'google',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async uploadFile(
    buffer: Buffer,
    filename: string,
    mimeType: string
  ): Promise<UploadedFile> {
    // For now, return a placeholder implementation
    return {
      id: filename,
      filename,
      mimeType,
      size: buffer.length,
      uri: `file://${filename}`,
    };
  }

  async downloadFile(_fileId: string): Promise<Buffer> {
    // Placeholder implementation
    return Buffer.from('placeholder');
  }

  async deleteFile(_fileId: string): Promise<void> {
    // Placeholder implementation
  }

  setModel(imageModel: string): void {
    this.imageModel = imageModel;
  }

  getImageModel(): string {
    return this.imageModel;
  }

  getSupportedFormats() {
    return {
      supportedImageFormats: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff'],
      maxImageSize: 20971520, // 20MB
      supportsFileUpload: true,
    };
  }

  getModelCapabilities() {
    return {
      imageAnalysis: true,
      maxTokensForImage: 4096,
      supportedFormats: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff'],
    };
  }

  getProviderInfo() {
    return {
      name: this.providerName,
      version: '1.0.0',
      description: 'Google Gemini API provider for AI vision analysis',
      capabilities: this.getSupportedFormats(),
      modelCapabilities: this.getModelCapabilities(),
    };
  }

  async healthCheck(): Promise<HealthStatus> {
    const startTime = Date.now();
    try {
      // Simple test with a minimal text request using a valid model
      const model = this.client.getGenerativeModel({ model: 'gemini-1.5-pro' });
      await model.generateContent('Hello');

      const responseTime = Date.now() - startTime;

      return {
        status: 'healthy',
        lastCheck: new Date().toISOString(),
        responseTime,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : String(error),
        lastCheck: new Date().toISOString(),
      };
    }
  }

  supportsVideo(): boolean {
    return true;
  }

  // Helper methods

  /**
   * Build content structure from file reference for Gemini API
   */
  private buildContentFromReference(fileReference: FileReference, prompt: string): any {
    const parts: any[] = [{ text: prompt }];

    switch (fileReference.type) {
      case 'inline_data':
        parts.push({
          inlineData: {
            mimeType: fileReference.mimeType,
            data: fileReference.data,
          },
        });
        break;

      case 'file_uri':
        parts.push({
          fileData: {
            mimeType: fileReference.mimeType,
            fileUri: fileReference.uri,
          },
        });
        break;

      case 'base64':
        parts.push({
          inlineData: {
            mimeType: fileReference.mimeType,
            data: fileReference.data,
          },
        });
        break;

      default:
        throw new VisionError(
          `Unsupported file reference type: ${fileReference.type}`,
          'UNSUPPORTED_FILE_TYPE'
        );
    }

    return {
      role: 'user',
      parts,
    };
  }

  private handleError(error: unknown, operation: string): Error {
    if (error instanceof Error) {
      // Handle specific error types based on error messages
      if (error.message.includes('401') || error.message.includes('UNAUTHENTICATED')) {
        return new AuthenticationError(
          `Authentication failed for ${operation}: ${error.message}`,
          this.providerName
        );
      }

      if (error.message.includes('403') || error.message.includes('PERMISSION_DENIED')) {
        return new AuthenticationError(
          `Permission denied for ${operation}: ${error.message}`,
          this.providerName
        );
      }

      if (error.message.includes('404') || error.message.includes('NOT_FOUND')) {
        return new FileNotFoundError(
          `Resource not found for ${operation}: ${error.message}`,
          this.providerName
        );
      }

      if (error.message.includes('429') || error.message.includes('RATE_LIMIT')) {
        return new RateLimitExceededError(
          `Rate limit exceeded for ${operation}: ${error.message}`,
          this.providerName
        );
      }

      if (error.message.includes('ENOTFOUND') || error.message.includes('NETWORK')) {
        return new NetworkError(
          `Network error for ${operation}: ${error.message}`
        );
      }

      return new ProviderError(
        `Provider error during ${operation}: ${error.message}`,
        this.providerName,
        error
      );
    }

    return new VisionError(
      `Unknown error during ${operation}: ${String(error)}`,
      'PROVIDER_ERROR',
      this.providerName
    );
  }
}
/**
 * File service for handling image sources with comprehensive support
 * for URLs, local files, and base64 data - ported from MCP with CLI enhancements
 */

import fs from 'fs/promises';
import path from 'path';
import type {
  VisionProvider,
  FileReference,
} from '../types/index.js';
import {
  FileUploadError,
  UnsupportedFileTypeError,
  FileSizeExceededError,
  FileNotFoundError,
  NetworkError,
} from '../types/index.js';

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

export class FileService {
  private provider: VisionProvider;
  private filesThreshold: number;

  constructor(provider: VisionProvider, filesThreshold = 10485760) {
    this.provider = provider;
    this.filesThreshold = filesThreshold;
  }

  /**
   * Main entry point for handling image sources
   * Detects input type and processes accordingly
   */
  async handleImageSource(imageSource: string): Promise<FileAnalysisResult> {
    const { buffer, mimeType, filename } = await this.getImageData(imageSource);

    // Validate file size
    const maxSize = this.getMaxFileSize();
    if (buffer.length > maxSize) {
      throw new FileSizeExceededError(buffer.length, maxSize);
    }

    // Validate file type
    if (!this.isSupportedFileType(mimeType)) {
      throw new UnsupportedFileTypeError(
        mimeType,
        this.getSupportedFileTypes()
      );
    }

    // Choose processing method based on size threshold
    const shouldUpload = buffer.length > this.filesThreshold;

    if (shouldUpload) {
      // Upload to Files API for large images
      const uploadedFile = await this.provider.uploadFile(buffer, filename || `image.${this.getFileExtension(mimeType)}`, mimeType);
      const reference: FileReference = {
        type: 'file_uri',
        uri: uploadedFile.uri,
        mimeType,
      };

      return {
        reference,
        processingInfo: {
          size: buffer.length,
          method: 'file_uri',
          threshold: this.filesThreshold,
        },
      };
    } else {
      // Use inline data for small images
      const reference: FileReference = {
        type: 'inline_data',
        data: buffer.toString('base64'),
        mimeType,
      };

      return {
        reference,
        processingInfo: {
          size: buffer.length,
          method: 'inline_data',
          threshold: this.filesThreshold,
        },
      };
    }
  }

  
  /**
   * Process multiple images for comparison
   */
  async handleMultipleImages(imageSources: string[]): Promise<FileAnalysisResult[]> {
    const results: FileAnalysisResult[] = [];

    for (const source of imageSources) {
      try {
        const result = await this.handleImageSource(source);
        results.push(result);
      } catch (error) {
        throw new FileUploadError(
          `Failed to process image ${source}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return results;
  }

  /**
   * Direct file reading (used for object detection with temp files)
   */
  async readFile(filePath: string): Promise<Buffer> {
    const normalizedPath = path.normalize(filePath);
    try {
      await fs.access(normalizedPath);
      return await fs.readFile(normalizedPath);
    } catch (error) {
      throw new FileNotFoundError(normalizedPath, 'FileService');
    }
  }

  /**
   * Get comprehensive image data from various sources
   */
  private async getImageData(imageSource: string): Promise<FileProcessingResult> {
    // Handle base64 data URLs
    if (imageSource.startsWith('data:image/')) {
      return this.handleBase64Image(imageSource);
    }

    // Handle existing file references (check before URL handling)
    if (imageSource.startsWith('files/') || imageSource.includes('generativelanguage.googleapis.com')) {
      throw new FileUploadError(`File reference already exists: ${imageSource}`);
    }

    // Handle URLs
    if (this.isPublicUrl(imageSource)) {
      return this.handleUrlImage(imageSource);
    }

    // Handle local files
    if (this.isLocalFilePath(imageSource)) {
      return this.handleLocalFile(imageSource);
    }

    throw new FileUploadError(`Invalid image source format: ${imageSource}`);
  }

  /**
   * Handle base64 image data
   */
  private async handleBase64Image(base64Data: string): Promise<FileProcessingResult> {
    const matches = base64Data.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (!matches) {
      throw new FileUploadError('Invalid base64 image format');
    }

    const mimeType = `image/${matches[1]}`;
    const base64Content = matches[2];

    // Validate base64 content - it should only contain valid base64 characters
    // and have a length that's divisible by 4 (proper padding)
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Content) || base64Content.length % 4 !== 0) {
      throw new FileUploadError('Invalid base64 content: contains invalid characters or improper padding');
    }

    try {
      const buffer = Buffer.from(base64Content, 'base64');

      return {
        buffer,
        mimeType,
        filename: `image.${matches[1]}`,
        source: 'base64',
      };
    } catch (error) {
      throw new FileUploadError('Failed to decode base64 content: invalid base64 data');
    }
  }

  /**
   * Handle URL image downloading
   */
  private async handleUrlImage(url: string): Promise<FileProcessingResult> {
    try {
      // Decode URL-encoded characters to handle escaped sequences
      const decodedUrl = url.replace(/\\&/g, '&');

      const response = await fetch(decodedUrl);
      if (!response.ok) {
        throw new NetworkError(
          `Failed to fetch image from URL: ${decodedUrl} (Status: ${response.status})`
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Extract filename from URL or use default
      const urlPath = new URL(decodedUrl).pathname;
      const filename = path.basename(urlPath) || 'image.jpg';

      // Determine MIME type from response headers or filename
      const contentType = response.headers.get('content-type');
      const mimeType = contentType && contentType.startsWith('image/')
        ? contentType
        : this.getMimeType(filename, buffer);

      return {
        buffer,
        mimeType,
        filename,
        source: 'url',
      };
    } catch (error) {
      if (error instanceof NetworkError) {
        throw error;
      }
      throw new NetworkError(
        `Failed to download image from URL: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Handle local file reading
   */
  private async handleLocalFile(filePath: string): Promise<FileProcessingResult> {
    const normalizedPath = path.normalize(filePath);
    try {
      await fs.access(normalizedPath);

      const buffer = await fs.readFile(normalizedPath);
      const filename = path.basename(normalizedPath);
      const mimeType = this.getMimeType(filename, buffer);

      return {
        buffer,
        mimeType,
        filename,
        source: 'local',
      };
    } catch (error) {
      // Check for ENOENT error (file not found)
      if (error instanceof Error && ('code' in error ? error.code === 'ENOENT' : error.message.includes('ENOENT'))) {
        throw new FileNotFoundError(normalizedPath, 'FileService');
      }
      if (error instanceof FileNotFoundError) {
        throw error;
      }
      throw new FileUploadError(
        `Failed to read local file ${filePath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Detection helpers
   */
  private isPublicUrl(url: string): boolean {
    return url.startsWith('http://') || url.startsWith('https://');
  }

  private isLocalFilePath(filePath: string): boolean {
    // Unix/Linux paths
    if (
      filePath.startsWith('/') ||
      filePath.startsWith('./') ||
      filePath.startsWith('../')
    ) {
      return true;
    }

    // Windows paths with drive letters
    if (/^[a-zA-Z]:[\\/]/.test(filePath)) {
      return true;
    }

    // UNC paths
    if (filePath.startsWith('\\\\')) {
      return true;
    }

    // Windows relative paths
    if (
      filePath.includes('\\') &&
      (filePath.startsWith('.\\') || filePath.startsWith('..\\'))
    ) {
      return true;
    }

    return false;
  }

  /**
   * MIME type detection with file signatures
   */
  private getMimeType(filename: string, buffer?: Buffer): string {
    // Try to determine MIME type from file extension first
    const extension = path.extname(filename).toLowerCase().substring(1);

    const mimeTypes: Record<string, string> = {
      // Images
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      bmp: 'image/bmp',
      tiff: 'image/tiff',
      heic: 'image/heic',
      heif: 'image/heif',
    };

    const mimeType = mimeTypes[extension];
    if (mimeType) {
      return mimeType;
    }

    // If buffer is available, try to determine from file signature
    if (buffer) {
      return this.getMimeTypeFromBuffer(buffer);
    }

    // Default fallback
    return extension.includes('jpg') || extension.includes('jpeg')
      ? 'image/jpeg'
      : 'application/octet-stream';
  }

  private getMimeTypeFromBuffer(buffer: Buffer): string {
    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return 'image/png';
    }

    // JPEG signature: FF D8 FF
    if (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    ) {
      return 'image/jpeg';
    }

    // GIF signature: GIF87a or GIF89a
    if (
      buffer.length >= 6 &&
      buffer[0] === 0x47 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x38 &&
      ((buffer[4] === 0x37 && buffer[5] === 0x61) ||
       (buffer[4] === 0x38 && buffer[5] === 0x61))
    ) {
      return 'image/gif';
    }

    // WebP signature: RIFF...WEBP
    if (
      buffer.length >= 12 &&
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    ) {
      return 'image/webp';
    }

    
    return 'application/octet-stream';
  }

  /**
   * File validation helpers
   */
  private isSupportedFileType(mimeType: string): boolean {
    const supportedTypes = this.getSupportedFileTypes();
    return mimeType.startsWith('image/') && supportedTypes.includes(mimeType);
  }

  private getSupportedFileTypes(): string[] {
    return [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/bmp',
      'image/tiff',
      'image/heic',
      'image/heif'
    ];
  }

  private getMaxFileSize(): number {
    return 20 * 1024 * 1024; // 20MB
  }

  private getFileExtension(mimeType: string): string {
    const extensionMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/bmp': 'bmp',
      'image/tiff': 'tiff',
      'image/heic': 'heic',
      'image/heif': 'heif',
    };

    return extensionMap[mimeType] || 'bin';
  }
}
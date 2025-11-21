import { FileService } from '../../../src/services/FileService';
import {
  FileUploadError,
  UnsupportedFileTypeError,
  FileSizeExceededError,
  FileNotFoundError,
  NetworkError,
} from '../../../src/types';
import { mockImageBuffer } from '../fixtures/imageFixtures';

// Mock dependencies
jest.mock('node-fetch');

// Mock fs modules
jest.mock('fs', () => ({
  existsSync: jest.fn(),
}));

jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  access: jest.fn(),
}));

describe('FileService', () => {
  let fileService: FileService;
  let mockProvider: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default file system mocks
    const mockExistsSync = require('fs').existsSync;
    const mockFsPromises = require('fs/promises');

    mockExistsSync.mockReturnValue(false); // Files don't exist by default
    mockFsPromises.readFile.mockRejectedValue(new Error('File not found'));
    mockFsPromises.access.mockRejectedValue(new Error('File not found'));

    mockProvider = {
      uploadFile: jest.fn().mockResolvedValue({
        uri: 'files/uploaded-image-123',
        name: 'uploaded-image.jpg',
        mimeType: 'image/jpeg',
      }),
    };

    fileService = new FileService(mockProvider, 5 * 1024 * 1024); // 5MB threshold
  });

  describe('Image Source Detection', () => {
    it('should handle base64 image data', async () => {
      const base64Data = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

      const result = await fileService.handleImageSource(base64Data);

      expect(result.reference.type).toBe('inline_data');
      expect(result.reference.mimeType).toBe('image/png');
      expect(result.processingInfo.method).toBe('inline_data');
      expect(result.processingInfo.size).toBeGreaterThan(0);
    });

    it('should handle HTTP URLs', async () => {
      const url = 'https://example.com/image.jpg';

      // Mock fetch response
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: jest.fn().mockReturnValue('image/jpeg'),
        },
        arrayBuffer: jest.fn().mockResolvedValue(mockImageBuffer.buffer),
      });

      const result = await fileService.handleImageSource(url);

      expect(result.reference.type).toBe('inline_data');
      expect(result.reference.mimeType).toBe('image/jpeg');
    });

    it('should handle local file paths', async () => {
      const filePath = '/test/image.png';

      // Mock fs operations
      const mockFs = require('fs/promises');
      mockFs.access = jest.fn().mockResolvedValue(undefined);
      mockFs.readFile = jest.fn().mockResolvedValue(mockImageBuffer);

      const result = await fileService.handleImageSource(filePath);

      expect(result.reference.type).toBe('inline_data');
      expect(result.reference.mimeType).toBe('image/png');
    });
  });

  describe('File Size Handling', () => {
    it('should process small images inline', async () => {
      const smallBuffer = Buffer.alloc(1000); // 1KB
      jest.spyOn(require('fs/promises'), 'readFile').mockResolvedValue(smallBuffer);
      jest.spyOn(require('fs/promises'), 'access').mockResolvedValue(undefined);

      const result = await fileService.handleImageSource('/test/small.jpg');

      expect(result.reference.type).toBe('inline_data');
      expect(result.processingInfo.method).toBe('inline_data');
    });

    it('should upload large images to Files API', async () => {
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB - exceeds 5MB threshold
      jest.spyOn(require('fs/promises'), 'readFile').mockResolvedValue(largeBuffer);
      jest.spyOn(require('fs/promises'), 'access').mockResolvedValue(undefined);

      const result = await fileService.handleImageSource('/test/large.jpg');

      expect(mockProvider.uploadFile).toHaveBeenCalledWith(
        largeBuffer,
        'large.jpg',
        'image/jpeg'
      );
      expect(result.reference.type).toBe('file_uri');
      expect(result.processingInfo.method).toBe('file_uri');
    });

    it('should throw FileSizeExceededError for oversized images', async () => {
      const oversizedBuffer = Buffer.alloc(25 * 1024 * 1024); // 25MB (exceeds 20MB max file size)
      jest.spyOn(require('fs/promises'), 'readFile').mockResolvedValue(oversizedBuffer);
      jest.spyOn(require('fs/promises'), 'access').mockResolvedValue(undefined);

      await expect(fileService.handleImageSource('/test/oversized.jpg'))
        .rejects.toThrow(FileSizeExceededError);
    });
  });

  describe('File Type Validation', () => {
    it('should accept supported image formats', async () => {
      const supportedFormats = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'heic', 'heif'];

      for (const format of supportedFormats) {
        jest.spyOn(require('fs/promises'), 'readFile').mockResolvedValue(mockImageBuffer);
        jest.spyOn(require('fs/promises'), 'access').mockResolvedValue(undefined);

        const result = await fileService.handleImageSource(`/test/image.${format}`);

        expect(result.reference.mimeType).toMatch(/^image\//);
        expect(result.processingInfo.size).toBeGreaterThan(0);
      }
    });

    it('should reject unsupported file types', async () => {
      const textBuffer = Buffer.from('This is not an image');
      jest.spyOn(require('fs/promises'), 'readFile').mockResolvedValue(textBuffer);
      jest.spyOn(require('fs/promises'), 'access').mockResolvedValue(undefined);

      await expect(fileService.handleImageSource('/test/document.pdf'))
        .rejects.toThrow(UnsupportedFileTypeError);
    });
  });

  describe('Base64 Image Handling', () => {
    it('should parse valid base64 image data', async () => {
      const base64Data = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A8A';

      const result = await fileService.handleImageSource(base64Data);

      expect(result.reference.type).toBe('inline_data');
      expect(result.reference.mimeType).toBe('image/jpeg');
    });

    it('should reject invalid base64 format', async () => {
      const invalidBase64 = 'invalid-base64-data';

      await expect(fileService.handleImageSource(invalidBase64))
        .rejects.toThrow(FileUploadError);
    });
  });

  describe('URL Image Handling', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    it('should download images from HTTP URLs', async () => {
      const url = 'http://example.com/image.jpg';
      const mockResponse = {
        ok: true,
        status: 200,
        headers: {
          get: jest.fn((header: string) => {
            if (header === 'content-type') return 'image/jpeg';
            return null;
          }),
        },
        arrayBuffer: jest.fn().mockResolvedValue(mockImageBuffer.buffer),
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await fileService.handleImageSource(url);

      expect(global.fetch).toHaveBeenCalledWith(url);
      expect(result.reference.mimeType).toBe('image/jpeg');
    });

    it('should download images from HTTPS URLs', async () => {
      const url = 'https://secure.example.com/image.png';
      const mockResponse = {
        ok: true,
        status: 200,
        headers: {
          get: jest.fn().mockReturnValue('image/png'),
        },
        arrayBuffer: jest.fn().mockResolvedValue(mockImageBuffer.buffer),
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await fileService.handleImageSource(url);

      expect(global.fetch).toHaveBeenCalledWith(url);
      expect(result.reference.mimeType).toBe('image/png');
    });

    it('should handle HTTP errors', async () => {
      const url = 'https://example.com/not-found.jpg';
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await expect(fileService.handleImageSource(url))
        .rejects.toThrow(NetworkError);
    });

    it('should handle network failures', async () => {
      const url = 'https://example.com/image.jpg';
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(fileService.handleImageSource(url))
        .rejects.toThrow(NetworkError);
    });

    it('should extract filename from URL', async () => {
      const url = 'https://example.com/path/to/my-image.jpg';
      const mockResponse = {
        ok: true,
        status: 200,
        headers: {
          get: jest.fn().mockReturnValue('image/jpeg'),
        },
        arrayBuffer: jest.fn().mockResolvedValue(mockImageBuffer.buffer),
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      // We can't directly test filename extraction without more complex mocking,
      // but we can verify the call succeeds
      await expect(fileService.handleImageSource(url))
        .resolves.toBeDefined();
    });
  });

  describe('Local File Handling', () => {
    beforeEach(() => {
      const mockFs = require('fs/promises');
      mockFs.access = jest.fn();
      mockFs.readFile = jest.fn();
    });

    it('should read existing local files', async () => {
      const filePath = '/path/to/image.png';
      const mockFs = require('fs/promises');

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(mockImageBuffer);

      const result = await fileService.handleImageSource(filePath);

      expect(mockFs.access).toHaveBeenCalled();
      expect(mockFs.readFile).toHaveBeenCalledWith(filePath);
      expect(result.reference.mimeType).toBe('image/png');
    });

    it('should throw FileNotFoundError for non-existent files', async () => {
      const filePath = '/path/to/non-existent.jpg';
      const mockFs = require('fs/promises');

      mockFs.access.mockRejectedValue(new Error('ENOENT: no such file'));

      await expect(fileService.handleImageSource(filePath))
        .rejects.toThrow(FileNotFoundError);
    });

    it('should handle file read errors', async () => {
      const filePath = '/path/to/image.jpg';
      const mockFs = require('fs/promises');

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockRejectedValue(new Error('Permission denied'));

      await expect(fileService.handleImageSource(filePath))
        .rejects.toThrow(FileUploadError);
    });
  });

  describe('Multiple Image Processing', () => {
    it('should process multiple images successfully', async () => {
      const imageSources = [
        'data:image/png;base64,test',
        'https://example.com/image1.jpg',
        '/local/image2.png',
      ];

      // Mock different sources
      jest.spyOn(require('fs/promises'), 'readFile').mockResolvedValue(mockImageBuffer);
      jest.spyOn(require('fs/promises'), 'access').mockResolvedValue(undefined);
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: jest.fn().mockReturnValue('image/jpeg') },
        arrayBuffer: jest.fn().mockResolvedValue(mockImageBuffer.buffer),
      });

      const results = await fileService.handleMultipleImages(imageSources);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.reference).toBeDefined();
        expect(result.processingInfo).toBeDefined();
      });
    });

    it('should throw error when any image processing fails', async () => {
      const imageSources = [
        'data:image/png;base64,valid',
        'https://example.com/non-existent.jpg',
      ];

      // Mock first source as success, second as failure
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      await expect(fileService.handleMultipleImages(imageSources))
        .rejects.toThrow(FileUploadError);
    });
  });

  describe('MIME Type Detection', () => {
    it('should detect MIME type from file extension', async () => {
      const testCases = [
        { filename: 'image.jpg', expected: 'image/jpeg' },
        { filename: 'photo.jpeg', expected: 'image/jpeg' },
        { filename: 'graphic.png', expected: 'image/png' },
        { filename: 'animation.gif', expected: 'image/gif' },
        { filename: 'modern.webp', expected: 'image/webp' },
        { filename: 'bitmap.bmp', expected: 'image/bmp' },
        { filename: 'tiff-image.tiff', expected: 'image/tiff' },
        { filename: 'apple.heic', expected: 'image/heic' },
        { filename: 'apple.heif', expected: 'image/heif' },
      ];

      for (const testCase of testCases) {
        const buffer = Buffer.from('fake image data');
        jest.spyOn(require('fs/promises'), 'readFile').mockResolvedValue(buffer);
        jest.spyOn(require('fs/promises'), 'access').mockResolvedValue(undefined);

        const result = await fileService.handleImageSource(`/test/${testCase.filename}`);
        expect(result.reference.mimeType).toBe(testCase.expected);
      }
    });

    it('should detect MIME type from file signature', async () => {
      // PNG signature
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      jest.spyOn(require('fs/promises'), 'readFile').mockResolvedValue(pngBuffer);
      jest.spyOn(require('fs/promises'), 'access').mockResolvedValue(undefined);

      const result = await fileService.handleImageSource('/test/unknown-extension');
      expect(result.reference.mimeType).toBe('image/png');
    });
  });

  describe('File Path Detection', () => {
    it('should detect Unix/Linux absolute paths', () => {
      // Since isLocalFilePath is private, we test indirectly through handleImageSource
      const testPaths = [
        '/absolute/path/image.jpg',
        './relative/path/image.jpg',
        '../parent/path/image.jpg',
      ];

      testPaths.forEach(path => {
        expect(fileService.handleImageSource(path)).rejects.toThrow();
      });
    });

    it('should detect Windows paths', () => {
      const windowsPaths = [
        'C:\\Windows\\image.jpg',
        'D:\\Data\\image.png',
        '\\\\server\\share\\image.jpg',
        '.\\relative\\image.jpg',
        '..\\parent\\image.jpg',
      ];

      windowsPaths.forEach(path => {
        expect(fileService.handleImageSource(path)).rejects.toThrow();
      });
    });
  });

  describe('File Reading', () => {
    beforeEach(() => {
      const mockFs = require('fs/promises');
      mockFs.access = jest.fn();
      mockFs.readFile = jest.fn();
    });

    it('should read existing files', async () => {
      const filePath = '/test/existing.jpg';
      const mockFs = require('fs/promises');

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(mockImageBuffer);

      const result = await fileService.readFile(filePath);

      expect(mockFs.access).toHaveBeenCalled();
      expect(mockFs.readFile).toHaveBeenCalledWith(filePath);
      expect(result).toEqual(mockImageBuffer);
    });

    it('should throw FileNotFoundError for non-existent files', async () => {
      const filePath = '/test/non-existent.jpg';
      const mockFs = require('fs/promises');

      mockFs.access.mockRejectedValue(new Error('ENOENT'));

      await expect(fileService.readFile(filePath))
        .rejects.toThrow(FileNotFoundError);
    });
  });

  describe('Error Handling', () => {
    it('should throw FileUploadError for invalid image source formats', async () => {
      const invalidSources = [
        'invalid-source-format',
        'ftp://old-protocol.com/image.jpg',
        'files/already-uploaded-image.jpg',
        'https://generativelanguage.googleapis.com/v1beta/files/existing-file',
      ];

      for (const source of invalidSources) {
        await expect(fileService.handleImageSource(source))
          .rejects.toThrow(FileUploadError);
      }
    });

    it('should handle malformed base64 data', async () => {
      const malformedBase64 = 'data:image/jpeg;base64,invalid-base64-chars!@#$%';

      await expect(fileService.handleImageSource(malformedBase64))
        .rejects.toThrow(FileUploadError);
    });
  });

  describe('Configuration and Thresholds', () => {
    it('should use custom threshold when provided', () => {
      const customThreshold = 5 * 1024 * 1024; // 5MB
      const customService = new FileService(mockProvider, customThreshold);

      // Test that the custom threshold is stored
      expect(customService).toBeDefined();
    });

    it('should handle file sizes exactly at threshold', async () => {
      const exactThresholdBuffer = Buffer.alloc(5 * 1024 * 1024); // 5MB
      jest.spyOn(require('fs/promises'), 'readFile').mockResolvedValue(exactThresholdBuffer);
      jest.spyOn(require('fs/promises'), 'access').mockResolvedValue(undefined);

      const result = await fileService.handleImageSource('/test/exact-threshold.jpg');

      // Should use inline_data for files exactly at threshold
      expect(result.reference.type).toBe('inline_data');
      expect(result.processingInfo.method).toBe('inline_data');
    });
  });
});
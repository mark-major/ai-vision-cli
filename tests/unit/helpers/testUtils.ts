import { Readable } from 'stream';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from 'fs';
import { mockImageBuffer, mockBase64Image, mockImageUrl } from '../fixtures/imageFixtures';

export class TestUtils {
  static createTempFile(content: Buffer | string, extension: string = '.txt'): string {
    const tempDir = mkdtempSync(join(tmpdir(), 'ai-vision-test-'));
    const filePath = join(tempDir, `test${extension}`);
    writeFileSync(filePath, content);
    return filePath;
  }

  static createTempDir(): string {
    return mkdtempSync(join(tmpdir(), 'ai-vision-test-'));
  }

  static cleanupFile(filePath: string): void {
    try {
      unlinkSync(filePath);
    } catch {
      // Ignore cleanup errors
    }
  }

  static cleanupDir(dirPath: string): void {
    try {
      rmdirSync(dirPath);
    } catch {
      // Ignore cleanup errors
    }
  }

  static createMockReadableStream(content: Buffer | string): Readable {
    const stream = new Readable();
    stream.push(content);
    stream.push(null);
    return stream;
  }

  static createMockImageInput() {
    return {
      type: 'buffer' as const,
      data: mockImageBuffer,
    };
  }

  static createMockUrlInput() {
    return {
      type: 'url' as const,
      data: mockImageUrl,
    };
  }

  static createMockBase64Input() {
    return {
      type: 'base64' as const,
      data: mockBase64Image,
    };
  }

  static async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static createMockConsole() {
    const logs: string[] = [];
    const errors: string[] = [];
    const warns: string[] = [];

    return {
      log: jest.fn((message: string) => logs.push(message)),
      error: jest.fn((message: string) => errors.push(message)),
      warn: jest.fn((message: string) => warns.push(message)),
      getLogs: () => logs,
      getErrors: () => errors,
      getWarns: () => warns,
      clear: () => {
        logs.length = 0;
        errors.length = 0;
        warns.length = 0;
      },
    };
  }

  static createMockProgress() {
    return {
      start: jest.fn(),
      update: jest.fn(),
      succeed: jest.fn(),
      fail: jest.fn(),
      stop: jest.fn(),
    };
  }

  static createMockInquirer() {
    return {
      prompt: jest.fn().mockResolvedValue({}),
    };
  }

  static mockEnvironmentVariables(envVars: Record<string, string>): void {
    Object.entries(envVars).forEach(([key, value]) => {
      process.env[key] = value;
    });
  }

  static clearEnvironmentVariables(envVars: string[]): void {
    envVars.forEach(key => {
      delete process.env[key];
    });
  }
}
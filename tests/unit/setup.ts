import { jest } from '@jest/globals';

// Mock console methods to avoid noise in test output
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Mock process.exit to prevent actual process termination
const mockExit = jest.fn();
process.exit = mockExit as any;

// Set default timeout for async operations
jest.setTimeout(10000);

// Mock external modules that might not be available in test environment
jest.mock('sharp', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    metadata: jest.fn().mockResolvedValue({
      format: 'png',
      width: 100,
      height: 100,
      size: 1000,
      hasAlpha: true,
      channels: 4,
    }),
    resize: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-image-data')),
  })),
}));

// Mock ora progress spinner
jest.mock('ora', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    start: jest.fn(),
    update: jest.fn(),
    succeed: jest.fn(),
    fail: jest.fn(),
    stop: jest.fn(),
  })),
}));

// Mock inquirer for CLI prompts
jest.mock('inquirer', () => ({
  __esModule: true,
  default: {
    prompt: jest.fn().mockResolvedValue({}),
  },
}));

// Global test utilities
global.afterEach(() => {
  jest.clearAllMocks();
});

export const mockProcessExit = mockExit;
import type { Config } from '../../src/types';

export const createMockConfig = (overrides: Partial<Config> = {}): Config => ({
  provider: 'gemini',
  gemini: {
    apiKey: 'test-api-key',
    model: 'gemini-pro-vision',
  },
  vertex: {
    projectId: 'test-project',
    location: 'us-central1',
    apiKey: 'test-api-key',
    model: 'gemini-1.0-pro-vision',
  },
  output: {
    format: 'text',
    save: false,
  },
  reliability: {
    enableCircuitBreaker: true,
    enableRetry: true,
    maxRetries: 3,
    retryDelay: 1000,
    timeout: 30000,
  },
  rateLimiting: {
    enabled: true,
    requestsPerMinute: 60,
    burstLimit: 10,
  },
  ...overrides,
});

export const validConfigFile = `
provider: gemini
gemini:
  apiKey: test-key
  model: gemini-pro-vision
vertex:
  projectId: test-project
  location: us-central1
  apiKey: test-key
  model: gemini-1.0-pro-vision
output:
  format: json
  save: true
  directory: ./output
reliability:
  enableCircuitBreaker: true
  enableRetry: true
  maxRetries: 3
  retryDelay: 1000
  timeout: 30000
rateLimiting:
  enabled: true
  requestsPerMinute: 60
  burstLimit: 10
`;

export const invalidConfigFile = `
provider: invalid-provider
gemini:
  apiKey: ''
vertex:
  projectId: ''
output:
  format: invalid-format
reliability:
  maxRetries: -1
  retryDelay: -1
  timeout: -1
`;
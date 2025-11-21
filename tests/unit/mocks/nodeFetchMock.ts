import jest from 'jest';
import { mockImageBuffer, mockGeminiErrorResponse } from '../fixtures/imageFixtures';

export const createFetchMock = () => {
  const mockFetch = jest.fn();

  // Success response for image download
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    headers: {
      get: (name: string) => {
        if (name === 'content-type') return 'image/jpeg';
        if (name === 'content-length') return '1024';
        return null;
      },
    },
    buffer: jest.fn().mockResolvedValue(mockImageBuffer),
    text: jest.fn().mockResolvedValue('image data'),
  });

  return mockFetch;
};

export const createFetchErrorMock = (error: any = new Error('Network error')) => {
  return jest.fn().mockRejectedValue(error);
};

export const createFetchRateLimitMock = () => {
  return jest.fn().mockResolvedValue({
    ok: false,
    status: 429,
    statusText: 'Too Many Requests',
    headers: {
      get: jest.fn(),
    },
    text: jest.fn().mockResolvedValue(JSON.stringify(mockGeminiErrorResponse)),
  });
};
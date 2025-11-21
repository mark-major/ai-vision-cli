import jest from 'jest';
import { mockGeminiResponse, mockGeminiErrorResponse } from '../fixtures/providerFixtures';

export const createGeminiModelMock = () => ({
  generateContent: jest.fn().mockResolvedValue({
    response: mockGeminiResponse,
  }),
});

export const createGeminiModelErrorMock = (error: any = mockGeminiErrorResponse) => ({
  generateContent: jest.fn().mockRejectedValue(error),
});

export const createGenerativeAIMock = () => ({
  getGenerativeModel: jest.fn().mockReturnValue(createGeminiModelMock()),
});

export const createVertexAIMock = () => ({
  getGenerativeModel: jest.fn().mockReturnValue(createGeminiModelMock()),
});
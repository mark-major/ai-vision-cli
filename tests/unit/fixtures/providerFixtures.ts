import type { AnalysisResult, DetectionResult } from '../../src/types';

export const mockGeminiResponse = {
  candidates: [
    {
      content: {
        parts: [
          {
            text: 'This is a beautiful image showing a mountain landscape with a lake.',
          },
        ],
      },
    },
  ],
};

export const mockGeminiErrorResponse = {
  error: {
    code: 429,
    message: 'Rate limit exceeded',
    status: 'RESOURCE_EXHAUSTED',
  },
};

export const mockAnalysisResult: AnalysisResult = {
  provider: 'gemini',
  model: 'gemini-pro-vision',
  analysis: 'This is a beautiful image showing a mountain landscape with a lake.',
  metadata: {
    processingTime: 1500,
    tokens: 150,
    cost: 0.002,
  },
};

export const mockDetectionResult: DetectionResult = {
  provider: 'gemini',
  model: 'gemini-pro-vision',
  objects: [
    {
      name: 'mountain',
      confidence: 0.95,
      boundingBox: {
        x: 100,
        y: 50,
        width: 800,
        height: 400,
      },
    },
    {
      name: 'lake',
      confidence: 0.88,
      boundingBox: {
        x: 200,
        y: 500,
        width: 600,
        height: 300,
      },
    },
  ],
  metadata: {
    processingTime: 2000,
    tokens: 200,
    cost: 0.003,
  },
};

export const mockComparisonResult = {
  provider: 'gemini',
  model: 'gemini-pro-vision',
  comparison: {
    similarities: ['Both images contain outdoor scenes', 'Similar color palette'],
    differences: ['Different lighting conditions', 'Varying compositions'],
    score: 0.75,
  },
  metadata: {
    processingTime: 2500,
    tokens: 300,
    cost: 0.004,
  },
};
// Use lazy loading for the test image to avoid memory issues during test import
let testImageData: Buffer | null = null;
const getTestImageData = () => {
  if (!testImageData) {
    try {
      const { readFileSync } = require('fs');
      const { join } = require('path');
      testImageData = readFileSync(
        join(__dirname, '../../../test-image.png')
      );
    } catch (error) {
      // Fallback to a small buffer if file doesn't exist
      testImageData = Buffer.from('fake-image-data');
    }
  }
  return testImageData;
};

export { getTestImageData as testImageData };

export const mockImageBuffer = Buffer.from('fake-image-data');
export const mockImageUrl = 'https://example.com/test-image.jpg';
export const mockBase64Image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

export const supportedImageFormats = [
  { format: 'jpeg', extension: '.jpg', mimeType: 'image/jpeg' },
  { format: 'png', extension: '.png', mimeType: 'image/png' },
  { format: 'webp', extension: '.webp', mimeType: 'image/webp' },
  { format: 'gif', extension: '.gif', mimeType: 'image/gif' },
  { format: 'bmp', extension: '.bmp', mimeType: 'image/bmp' },
  { format: 'tiff', extension: '.tiff', mimeType: 'image/tiff' },
];

// Create a smaller buffer for testing to avoid memory issues
export const largeImageBuffer = Buffer.alloc(1 * 1024 * 1024); // 1MB instead of 10MB

export const mockImageMetadata = {
  width: 1920,
  height: 1080,
  format: 'png',
  size: 1024000,
  hasAlpha: true,
  channels: 4,
};
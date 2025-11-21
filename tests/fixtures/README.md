# Test Fixtures

This directory contains test data and fixtures used in the test suite.

## Structure

- `images/` - Test images in various formats
- `configs/` - Sample configuration files
- `mocks/` - Mock data and responses

## Test Images

The test images include:

- `small.png` - Small PNG image (1KB)
- `medium.jpg` - Medium JPEG image (50KB)
- `large.png` - Large PNG image (5MB)
- `transparent.png` - PNG with transparency
- `animated.gif` - Animated GIF
- `corrupt.jpg` - Corrupted image for error testing

## Configuration Files

- `valid.yaml` - Valid configuration
- `invalid.yaml` - Invalid configuration for error testing
- `minimal.yaml` - Minimal valid configuration
- `full.yaml` - Configuration with all options

## Usage

Test fixtures are loaded using helper functions from the test utilities:

```typescript
import { getTestImage, getTestConfig } from '../utils/testHelpers';

const imageData = getTestImage('small.png');
const configData = getTestConfig('valid.yaml');
```
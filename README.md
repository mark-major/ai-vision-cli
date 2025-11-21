# AI Vision CLI

An enterprise-grade command-line interface for AI-powered image analysis using Google's Gemini and Vertex AI models with advanced reliability features.

## Acknowledgements

This tool was created based on the [ai-vision-mcp](https://github.com/tan-yong-sheng/ai-vision-mcp) repository. Special thanks to [Tan Yong Sheng](https://github.com/tan-yong-sheng) for the original implementation and inspiration.

## Features

- **Image Analysis**: Analyze single images with custom prompts
- **Image Comparison**: Compare multiple images and identify differences
- **Object Detection**: Detect and identify objects in images with bounding box annotations
- **Multiple AI Providers**: Support for Google Gemini and Vertex AI
- **Flexible Output**: JSON, text, and table output formats
- **Configuration Management**: Easy setup and configuration management
- **Progress Tracking**: Visual progress indicators for long-running operations
- **Advanced Error Handling**: Intelligent retry logic and circuit breaker patterns
- **Rate Limiting**: Built-in quota management and rate limiting
- **Health Monitoring**: Provider connectivity and health checks

## Installation

### From npm (when published)
```bash
npm install -g ai-vision-cli
```

### From source
```bash
git clone https://github.com/majormark/ai-vision-cli.git
cd ai-vision-cli
npm install
npm run build
npm link
```

## Prerequisites

- Node.js 18.0.0 or higher
- Google Cloud Vertex AI credentials (for Vertex AI provider) or Google AI Studio API key (for Gemini provider)

## Quick Start

1. **Initialize the CLI**:
   ```bash
   ai-vision init
   ```

2. **Analyze an image**:
   ```bash
   ai-vision analyze image ./path/to/image.jpg
   ```

3. **Compare two images**:
   ```bash
   ai-vision compare images image1.jpg image2.jpg
   ```

4. **Detect objects**:
   ```bash
   ai-vision detect objects ./path/to/image.jpg --prompt "Find all cars and people"
   ```

## Commands

### `init`
Initialize AI Vision CLI configuration.

```bash
ai-vision init [options]
```

**Options:**
- `-p, --provider <provider>`: AI provider to use (google|vertex_ai)
- `-i, --interactive`: Run interactive setup (default: true)
- `-c, --config <path>`: Custom config file path
- `--defaults`: Use default configuration without prompts

### `analyze`
Analyze images.

#### Image Analysis
```bash
ai-vision analyze image <image> [options]
```

**Arguments:**
- `<image>`: Image file path or URL

**Options:**
- `-p, --prompt <prompt>`: Analysis prompt (default: "Analyze this image")
- `-o, --output <format>`: Output format - json|text|table (default: "json")
- `-s, --save <path>`: Save output to file
- `-t, --temperature <temp>`: AI temperature (0-1)
- `--max-tokens <tokens>`: Maximum output tokens
- `--top-p <value>`: Top P value (0-1)
- `--top-k <value>`: Top K value (1-100)
- `--system-instruction <instruction>`: System instruction to guide model behavior
- `--provider <provider>`: AI provider (google|vertex_ai)
- `--no-progress`: Disable progress indicators
- `--verbose`: Enable detailed debug output

### `compare`
Compare multiple images.

```bash
ai-vision compare images <images...> [options]
```

**Arguments:**
- `<images...>`: Image file paths or URLs (2-4 images)

**Options:**
- `-p, --prompt <prompt>`: Comparison prompt
- `-o, --output <format>`: Output format (json|text|table)
- `-s, --save <path>`: Save output to file
- `--provider <provider>`: AI provider (google|vertex_ai)

### `detect`
Detect objects in images.

```bash
ai-vision detect objects <image> [options]
```

**Arguments:**
- `<image>`: Image file path or URL

**Options:**
- `-p, --prompt <prompt>`: Detection prompt describing what to detect
- `-o, --output <path>`: Output path for annotated image
- `--format <format>`: Output format (json|image)
- `--confidence <threshold>`: Confidence threshold (0-1)
- `--save-detections <path>`: Save detection results to file

### `config`
Manage configuration.

```bash
ai-vision config <subcommand> [options]
```

**Subcommands:**
- `show`: Show current configuration
- `set <key> <value>`: Set configuration value
- `get <key>`: Get configuration value
- `reset`: Reset configuration to defaults

## Configuration

The CLI uses a YAML configuration file stored at `~/.ai-vision/config.yaml` by default.

### Environment Variables

You can set these environment variables instead of using the config file:

- `GOOGLE_AI_API_KEY`: Google AI Studio API key
- `VERTEX_AI_PROJECT_ID`: Vertex AI project ID
- `VERTEX_AI_LOCATION`: Vertex AI location (default: "us-central1")
- `VERTEX_AI_CREDENTIALS`: Path to Vertex AI credentials JSON file

### Example Configuration

```yaml
provider: "google"  # or "vertex_ai"
google:
  api_key: "your-google-ai-api-key"
vertex_ai:
  project_id: "your-project-id"
  location: "us-central1"
  credentials: "/path/to/credentials.json"
output:
  format: "json"
  save_directory: "./output"
  file_prefix: "ai-vision-"
performance:
  max_file_size: 10485760  # 10MB
  timeout: 30000  # 30 seconds
  upload_threshold: 4194304  # 4MB
logging:
  level: "info"
  file: "~/.ai-vision/logs/ai-vision.log"
```

## Usage Examples

### Basic Image Analysis
```bash
ai-vision analyze image ./photo.jpg --prompt "Describe the main objects in this image"
```

### Advanced Analysis with Custom Parameters
```bash
ai-vision analyze image ./photo.jpg \
  --prompt "Analyze the composition and lighting" \
  --temperature 0.7 \
  --max-tokens 500 \
  --output table \
  --save analysis.txt
```

### Object Detection
```bash
ai-vision detect objects ./street.jpg \
  --prompt "Find all vehicles, pedestrians, and traffic signs" \
  --save-detections detections.json
```

### Image Comparison
```bash
ai-vision compare images ./before.jpg ./after.jpg \
  --prompt "Compare the differences between these two images"
```

### Batch Analysis
```bash
# Using glob patterns for multiple images
ai-vision analyze image "./images/*.jpg" \
  --prompt "Identify the main subject" \
  --save results.json
```

## Output Formats

### JSON
Structured JSON output with complete metadata:
```json
{
  "success": true,
  "data": {
    "analysis": "The image shows...",
    "confidence": 0.95,
    "model": "gemini-1.0-pro-vision",
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

### Text
Human-readable text output:
```
Analysis Result:
The image shows a beautiful sunset over mountains with vibrant colors.
Confidence: 95%
Model: gemini-1.0-pro-vision
```

### Table
Formatted table output for quick viewing:
```
┌─────────────────────┬──────────────────────┐
│ Analysis            │ The image shows...   │
│ Confidence          │ 95%                  │
│ Model               │ gemini-1.0-pro-vision│
└─────────────────────┴──────────────────────┘
```

## File Support

### Supported Image Formats
- JPEG (.jpg, .jpeg)
- PNG (.png)
- WebP (.webp)
- GIF (.gif)
- BMP (.bmp)
- TIFF (.tiff)
- HEIC (.heic, .heif)


### File Size Limits
- Default maximum file size: 10MB
- Files larger than 4MB are uploaded instead of sent inline
- Configurable via `performance.max_file_size` setting

## Troubleshooting

### Common Issues

1. **Authentication Errors**:
   ```bash
   ai-vision config set provider google
   ai-vision config set google.api_key YOUR_API_KEY
   ```

2. **File Size Errors**:
   ```bash
   ai-vision config set performance.max_file_size 20971520  # 20MB
   ```

3. **Timeout Issues**:
   ```bash
   ai-vision config set performance.timeout 60000  # 60 seconds
   ```

### Debug Mode

Enable verbose logging:
```bash
ai-vision analyze image ./photo.jpg --verbose
```

### View Configuration
```bash
ai-vision config show
```

## Development

### Building from Source
```bash
git clone https://github.com/majormark/ai-vision-cli.git
cd ai-vision-cli
npm install
npm run build
```

### Running Tests
```bash
npm test
```

### Linting
```bash
npm run lint
npm run lint:fix
```

### Development Mode
```bash
npm run dev
```

## API Integration

The CLI can be integrated into other tools and scripts:

### JavaScript/Node.js
```javascript
const { execSync } = require('child_process');

const result = execSync(
  'ai-vision analyze image ./photo.jpg --output json',
  { encoding: 'utf8' }
);

const analysis = JSON.parse(result);
console.log(analysis.data.analysis);
```

### Shell Script
```bash
#!/bin/bash

for image in ./images/*.jpg; do
  echo "Analyzing $image..."
  ai-vision analyze image "$image" \
    --prompt "Describe this image" \
    --save "./results/$(basename "$image" .jpg).json"
done
```

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

- GitHub Issues: [https://github.com/majormark/ai-vision-cli/issues](https://github.com/majormark/ai-vision-cli/issues)
- Documentation: [https://github.com/majormark/ai-vision-cli](https://github.com/majormark/ai-vision-cli)

## Changelog

### v1.0.0
- Initial release
- Image analysis with customizable prompts
- Object detection with bounding box annotations
- Image comparison (up to 4 images simultaneously)
- Multiple AI providers support (Google Gemini, Vertex AI)
- Configuration management with YAML support
- Advanced error handling with intelligent retry logic
- Rate limiting and quota management
- Health monitoring and provider connectivity checks
- Multiple output formats (JSON, text, table)
- Progress indicators for long-running operations

## Architecture Overview

The AI Vision CLI is built with enterprise-grade reliability features:

- **Circuit Breaker Pattern**: Automatic provider switching during failures
- **Exponential Backoff**: Intelligent retry with jitter for network issues
- **Structured Logging**: Comprehensive debugging with correlation IDs
- **Health Checks**: Proactive provider monitoring and validation
- **Rate Limiting**: Token bucket algorithm to prevent quota exhaustion
- **Metrics Collection**: Performance tracking and success/failure rates
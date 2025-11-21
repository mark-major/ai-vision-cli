# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Building and Development
- `npm run build` - Compile TypeScript to JavaScript in the `dist/` directory
- `npm run dev` - Run TypeScript compiler in watch mode for development
- `npm start` - Run the compiled application with tsconfig path resolution
- `npm run prepare` - Build the project (runs automatically on install)

### Testing
- `npm test` - Run Jest tests with TypeScript support
- `npm test -- --watch` - Run tests in watch mode
- `npm test -- --coverage` - Run tests with coverage report
- Individual test files can be run with: `npm test -- path/to/test.test.ts`

### Code Quality
- `npm run lint` - Run ESLint on TypeScript files
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run format` - Format code with Prettier

### Installation and Distribution
- `npm link` - Link the CLI for local development (after building)
- `npm run prepublishOnly` - Run linting and build before publishing

## Architecture Overview

This is an enterprise-grade CLI tool for AI-powered image analysis with advanced reliability features. The architecture follows a modular, provider-agnostic design with enterprise patterns.

### Core Architecture Patterns

**Provider Pattern**: The system uses a factory pattern (`ProviderFactory`) to create different AI providers (Google Gemini, Vertex AI). All providers implement a common `VisionProvider` interface defined in `src/providers/base/VisionProvider.ts`.

**Service Layer**: `VisionService` acts as the main orchestrator and singleton that manages provider instances, handles provider selection, and provides a unified interface for CLI commands.

**Configuration Management**: `ConfigService` is a singleton that handles YAML-based configuration with environment variable overrides. It supports validation via Zod schemas and includes Phase 5 advanced features.

**Enterprise Reliability Features**:
- Circuit breaker pattern for automatic provider switching during failures
- Exponential backoff with jitter for intelligent retry logic
- Rate limiting with token bucket algorithm
- Health monitoring with periodic connectivity checks
- Metrics collection and performance tracking

### Directory Structure

- `src/commands/` - CLI command implementations (init, analyze, compare, detect, config)
- `src/providers/` - AI provider implementations and factory
- `src/services/` - Core business logic services (VisionService, FileService)
- `src/config/` - Configuration management and validation
- `src/utils/` - Utility functions (error handling, logging, retry, circuit breaker)
- `src/types/` - TypeScript type definitions and interfaces
- `tests/` - Unit tests with fixtures and mocks

### Key Components

**BaseVisionProvider**: Abstract class that all AI providers inherit from. Handles common functionality like:
- AI parameter resolution with environment variable hierarchy
- Configuration building for different analysis types
- Result formatting with metadata

**VisionProviderFactory**: Creates and initializes provider instances based on configuration. Handles provider switching and fallback logic.

**ConfigService**: Manages complex configuration with:
- YAML file parsing and validation
- Environment variable override hierarchy
- Phase 5 advanced features configuration
- File size parsing and formatting utilities

**CLI Commands**: Each command in `src/commands/` follows a consistent pattern:
- Input validation using Zod schemas
- Progress tracking for long operations
- Multiple output formats (JSON, text, table)
- Error handling with user-friendly messages

### Configuration System

The CLI uses a hierarchical configuration system:
1. Default values in code
2. YAML configuration file (`~/.ai-vision/config.yaml`)
3. Environment variables (highest priority)

Special environment variable patterns:
- Function-specific: `TEMPERATURE_FOR_ANALYZE_IMAGE_TEMPERATURE`
- Task-specific: `TEMPERATURE_FOR_IMAGE_TEMPERATURE`
- Universal: `TEMPERATURE_TEMPERATURE`

### Testing Strategy

- Unit tests for all core services and utilities
- Mock implementations for external providers
- Fixture data for consistent testing
- Jest with TypeScript support and path mapping
- Coverage reporting configured

### Build System

- TypeScript compilation with strict settings
- Path aliases for clean imports (`@/commands/*`, `@/utils/*`, etc.)
- Source maps and declaration generation
- ESLint with TypeScript-specific rules
- Prettier for consistent formatting

### Entry Points

- `bin/ai-vision` - CLI executable entry point
- `src/index.ts` - Main CLI application with Commander.js setup
- `dist/index.js` - Compiled JavaScript entry point

### Dependencies

**Core Dependencies**:
- `commander` - CLI framework
- `chalk` - Terminal colors
- `inquirer` - Interactive prompts
- `ora` - Progress spinners
- `yaml` - YAML parsing
- `zod` - Schema validation
- `sharp` - Image processing

**AI Provider Dependencies**:
- `@google/generative-ai` - Google Gemini API
- `@google-cloud/storage` - Google Cloud Storage for file uploads

## Development Notes

When working with this codebase:

1. **Configuration**: Always use `ConfigService.getInstance()` to access configuration. It handles validation, environment overrides, and caching.

2. **Error Handling**: Use the custom error types from `src/types/Errors.ts`. The `error-handler.ts` utility provides consistent error formatting.

3. **Provider Implementation**: When adding new providers, inherit from `BaseVisionProvider` and implement all abstract methods.

4. **Testing**: Use the provided test utilities and fixtures. Mock external services to ensure tests are reliable and fast.

5. **Logging**: Use the structured logging system. Verbosity can be controlled via `--verbose` flag or `LOG_LEVEL` environment variable.

6. **File Processing**: Use `FileService` for file operations. It handles format validation, size limits, and temporary file management.

7. **Progress Tracking**: Use the progress utilities for long-running operations. They provide consistent user feedback.

8. **Type Safety**: The codebase uses strict TypeScript settings. Ensure all new code is properly typed and handles edge cases.
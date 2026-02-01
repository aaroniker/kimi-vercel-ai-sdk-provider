# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-02-01

### Added

- **Temperature Locking for Thinking Models**: Thinking models now automatically enforce `temperature=1.0`
  - Added `temperatureLocked` and `defaultTemperature` to `KimiModelCapabilities`
  - Users receive a warning if attempting to override locked temperature
  - Ensures optimal reasoning performance for thinking models

- **Default max_tokens for Thinking Models**: Intelligent token defaults based on model type
  - Thinking models default to 32k tokens to prevent reasoning truncation
  - Standard models default to 4k tokens
  - Added `defaultMaxOutputTokens` to `KimiModelCapabilities`

- **File Content Caching**: LRU cache to avoid re-uploading identical files
  - New `FileCache` class with configurable size limits and TTL
  - Content-based hashing for deduplication
  - Enable via `processAttachments({ cache: true })`
  - Default: 100 entries, 1 hour TTL

- **Schema Sanitization for Tool Parameters**: Automatic cleanup of unsupported JSON Schema keywords
  - Removes `$schema`, `$id`, `$ref`, `$defs`, `allOf`, `anyOf`, `oneOf`, `not`, etc.
  - Improves compatibility with Kimi's tool calling API
  - Works automatically, no configuration needed

- **Multi-turn Reasoning Preservation Helpers**: Utilities for maintaining reasoning context
  - `analyzeReasoningPreservation()` - Detects if reasoning content is properly preserved
  - `recommendThinkingModel()` - Recommends thinking models based on task complexity
  - New `ReasoningAnalysis` type for structured analysis results

### Changed

- Tool preparation no longer passes `strict` mode to Kimi API for better compatibility
- Added constants: `THINKING_MODEL_TEMPERATURE`, `THINKING_MODEL_DEFAULT_MAX_TOKENS`, `STANDARD_MODEL_DEFAULT_MAX_TOKENS`

## [0.3.0] - 2026-01-28

### Added

- Internal improvements and bug fixes
- Enhanced model capability detection

## [0.2.0] - 2026-02-01

### Added

- **Kimi Code Provider**: New premium coding API support with extended thinking capabilities
  - `kimi.code()` method for accessing Kimi's specialized coding models
  - `createKimiCode()` standalone factory for code-focused applications
  - Extended thinking support with configurable budget tokens
  - Streaming support for thinking process and final output

- **Native File & PDF Support**: Zero-config file handling for Kimi's document understanding
  - `kimi.files` client for uploading and extracting content from files
  - Support for 30+ file types: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, MD, HTML, JSON, EPUB, CSV, and code files
  - `processAttachments()` utility for automatic `experimental_attachments` handling
  - File list and delete operations

- **Automated Context Caching**: Reduce latency and costs for repeated context
  - `caching` option in model settings with `enabled`, `cacheKey`, `ttl`, and `reset` options
  - Automatic HTTP header generation for Kimi's cache control API
  - Support for cache keys to ensure consistent cache hits

- **Tool Choice Polyfill**: Workaround for Kimi's limited `tool_choice` support
  - Automatic system message injection for `tool_choice: 'required'`
  - Support for specific tool targeting with `tool_choice: { type: 'tool', toolName: '...' }`
  - Configurable via `toolChoicePolyfill` setting (enabled by default)

- **Built-in Tool Helpers**: Easy access to Kimi's native capabilities
  - `kimi.tools.webSearch()` - Web search tool with configurable result count
  - `kimi.tools.codeInterpreter()` - Code interpreter tool for Python execution
  - `kimiTools.webSearch` and `kimiTools.codeInterpreter` standalone exports

- **Model Capability Inference**: Automatic feature detection based on model ID
  - Video input support detection for K2.5 models
  - Reasoning model detection (k1, k1.5 series)
  - JSON output mode support detection

- **Custom Error Classes**: Improved error handling and debugging
  - `KimiError` base class with response metadata
  - `KimiAuthenticationError` for API key issues
  - `KimiRateLimitError` with retry-after information
  - `KimiAPIError` for general API failures

### Changed

- Restructured codebase into logical modules: `chat/`, `code/`, `files/`, `tools/`, `core/`
- Moved tests to `src/__tests__/` for better organization
- Improved TypeScript types with comprehensive Zod schemas
- Enhanced streaming support with proper delta handling

### Fixed

- Tool preparation now correctly handles all tool choice modes
- Proper error propagation from API responses
- Correct MIME type detection for file uploads

## [0.1.0] - 2025-12-15

### Added

- Initial release of the Kimi provider for Vercel AI SDK
- Basic chat completion support with `kimi()` model factory
- Support for Kimi models: `moonshot-v1-8k`, `moonshot-v1-32k`, `moonshot-v1-128k`
- OpenAI-compatible API wrapper
- Regional endpoint support (global and China)
- Basic tool/function calling support
- Streaming response support
- System message handling

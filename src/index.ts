/**
 * Kimi (Moonshot AI) Provider for Vercel AI SDK
 *
 * A native implementation of the Kimi AI provider for the Vercel AI SDK,
 * supporting all Kimi-specific features including web search, code interpreter,
 * reasoning/thinking models, and Kimi Code premium coding service.
 *
 * @packageDocumentation
 * @module ai-sdk-provider-kimi
 */

// ============================================================================
// Kimi Provider (Standard API)
// ============================================================================

export type { KimiProvider, KimiProviderSettings } from './kimi-provider';
export { createKimi, kimi } from './kimi-provider';

// ============================================================================
// Kimi Code Provider (Premium Coding API)
// ============================================================================

export type {
  ExtendedThinkingConfig,
  KimiCodeCapabilities,
  KimiCodeModelId,
  KimiCodeProvider,
  KimiCodeProviderOptions,
  KimiCodeProviderSettings,
  KimiCodeSettings,
  ReasoningEffort
} from './code';
export {
  KIMI_CODE_BASE_URL,
  KIMI_CODE_DEFAULT_MODEL,
  KIMI_CODE_THINKING_MODEL,
  KimiCodeLanguageModel,
  createKimiCode,
  inferKimiCodeCapabilities,
  kimiCode,
  kimiCodeProviderOptionsSchema
} from './code';

// ============================================================================
// Chat Model
// ============================================================================

export type {
  KimiCachingConfig,
  KimiChatModelId,
  KimiChatSettings,
  KimiExtendedUsage,
  KimiModelCapabilities,
  KimiProviderOptions
} from './chat';
export {
  KimiChatLanguageModel,
  inferModelCapabilities,
  kimiCachingConfigSchema,
  kimiProviderOptionsSchema
} from './chat';

// ============================================================================
// File Handling
// ============================================================================

export type {
  Attachment,
  FileUploadOptions,
  FileUploadResult,
  KimiFile,
  KimiFileClientConfig,
  ProcessedAttachment
} from './files';
export {
  KimiFileClient,
  SUPPORTED_FILE_EXTENSIONS,
  SUPPORTED_MIME_TYPES,
  getMediaTypeFromExtension,
  getPurposeFromMediaType,
  isDocumentMediaType,
  isFileExtractMediaType,
  isImageMediaType,
  isVideoMediaType,
  processAttachments
} from './files';

// ============================================================================
// Built-in Tools
// ============================================================================

export type {
  KimiBuiltinTool,
  KimiCodeInterpreterConfig,
  KimiCodeInterpreterToolOptions,
  KimiWebSearchConfig,
  KimiWebSearchToolConfig,
  KimiWebSearchToolOptions
} from './tools';
export {
  KIMI_CODE_INTERPRETER_TOOL_NAME,
  KIMI_WEB_SEARCH_TOOL_NAME,
  createCodeInterpreterTool,
  createKimiWebSearchTool,
  createWebSearchTool,
  kimiTools
} from './tools';

// ============================================================================
// Errors
// ============================================================================

export {
  KimiAuthenticationError,
  KimiContentFilterError,
  KimiContextLengthError,
  KimiError,
  KimiModelNotFoundError,
  KimiRateLimitError,
  KimiValidationError
} from './core';

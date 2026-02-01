/**
 * Kimi (Moonshot AI) Provider for Vercel AI SDK
 *
 * A native implementation of the Kimi AI provider for the Vercel AI SDK,
 * supporting all Kimi-specific features including web search, code interpreter,
 * reasoning/thinking models, and Kimi Code premium coding service.
 *
 * @packageDocumentation
 * @module kimi-vercel-ai-sdk-provider

 */

// ============================================================================
// Kimi Provider (Standard API)
// ============================================================================

export type {
  EnsembleOptions,
  KimiProvider,
  KimiProviderSettings,
  MultiAgentOptions,
  ProviderGenerateFunction,
  ScaffoldProjectOptions,
  ValidateCodeOptions
} from './kimi-provider';
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
  AutoDetectConfig,
  AutoDetectToolsResult,
  KimiBuiltinTool,
  KimiCodeInterpreterConfig,
  KimiCodeInterpreterToolOptions,
  KimiWebSearchConfig,
  KimiWebSearchToolConfig,
  KimiWebSearchToolOptions,
  ToolGuidanceOptions
} from './tools';
export {
  KIMI_CODE_INTERPRETER_TOOL_NAME,
  KIMI_WEB_SEARCH_TOOL_NAME,
  createCodeInterpreterTool,
  createKimiWebSearchTool,
  createWebSearchTool,
  detectToolsFromPrompt,
  generateToolGuidanceMessage,
  hasToolOptOut,
  kimiTools,
  shouldAutoEnableTools
} from './tools';

// ============================================================================
// Ensemble / Multi-Sampling
// ============================================================================

export type {
  EnsembleConfig,
  EnsembleMetadata,
  EnsembleResponse,
  EnsembleResult,
  GenerateFunction,
  MultiSamplerOptions,
  ScoringHeuristic,
  SelectionStrategy
} from './ensemble';
export { MultiSampler, createSingletonEnsembleResult } from './ensemble';

// ============================================================================
// Code Validation
// ============================================================================

export type {
  CodeBlock,
  CodeExtractionResult,
  CodeValidationConfig,
  CodeValidatorOptions,
  FixAttempt,
  LanguageDetectionResult,
  SupportedLanguage,
  ValidationError,
  ValidationErrorType,
  ValidationResult,
  ValidationSeverity,
  ValidationStrictness
} from './code-validation';
export {
  CodeValidator,
  containsCode,
  createFailedValidationResult,
  createPassedValidationResult,
  detectLanguage,
  extractCodeBlocks,
  extractPrimaryCode,
  getFileExtension
} from './code-validation';

// ============================================================================
// Multi-Agent Collaboration
// ============================================================================

export type {
  AgentStep,
  GenerateResult,
  MultiAgentConfig,
  MultiAgentMetadata,
  MultiAgentResult,
  WorkflowContext,
  WorkflowType
} from './multi-agent';
export {
  DEFAULT_SYSTEM_PROMPTS,
  WorkflowRunner,
  createEmptyMultiAgentResult
} from './multi-agent';

// ============================================================================
// Project Scaffolding
// ============================================================================

export type {
  OutputFormat,
  ProjectFile,
  ProjectMetadata,
  ProjectTemplate,
  ProjectType,
  ScaffoldConfig,
  ScaffoldResult
} from './project-tools';
export { ProjectScaffolder, createEmptyScaffoldResult } from './project-tools';

// ============================================================================
// Errors
// ============================================================================

export {
  KimiAuthenticationError,
  KimiCodeValidationError,
  KimiContentFilterError,
  KimiContextLengthError,
  KimiEnsembleTimeoutError,
  KimiEnsembleValidationError,
  KimiError,
  KimiModelNotFoundError,
  KimiMultiAgentError,
  KimiRateLimitError,
  KimiScaffoldError,
  KimiValidationError
} from './core';

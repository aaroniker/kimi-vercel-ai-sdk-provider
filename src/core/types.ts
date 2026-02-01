/**
 * Core types for the Kimi provider.
 * @module
 */

import type { LanguageModelV3 } from '@ai-sdk/provider';

// ============================================================================
// Model IDs
// ============================================================================

/**
 * Available Kimi chat model IDs.
 *
 * @remarks
 * - `kimi-k2.5` - Latest flagship model with multimodal support
 * - `kimi-k2.5-thinking` - K2.5 with always-on deep reasoning
 * - `kimi-k2-turbo` - Fast, cost-effective model
 * - `kimi-k2-thinking` - K2 with always-on deep reasoning
 */
export type KimiChatModelId = 'kimi-k2.5' | 'kimi-k2.5-thinking' | 'kimi-k2-turbo' | 'kimi-k2-thinking' | (string & {});

// ============================================================================
// Model Capabilities
// ============================================================================

/**
 * Capabilities that can be detected from model ID patterns or explicitly set.
 */
export interface KimiModelCapabilities {
  /**
   * Whether the model supports thinking/reasoning mode.
   * Models with `-thinking` suffix have this enabled by default.
   */
  thinking?: boolean;

  /**
   * Whether the model always uses thinking mode (cannot be disabled).
   * Thinking models like `kimi-k2.5-thinking` have this set to true.
   */
  alwaysThinking?: boolean;

  /**
   * Whether the model supports image inputs.
   */
  imageInput?: boolean;

  /**
   * Whether the model supports video inputs.
   * Currently only kimi-k2.5 models support video.
   */
  videoInput?: boolean;

  /**
   * Maximum context window size in tokens.
   */
  maxContextSize?: number;

  /**
   * Whether the model supports tool/function calling.
   */
  toolCalling?: boolean;

  /**
   * Whether the model supports JSON mode.
   */
  jsonMode?: boolean;

  /**
   * Whether the model supports structured outputs.
   */
  structuredOutputs?: boolean;
}

/**
 * Infer model capabilities from the model ID.
 *
 * @param modelId - The model identifier
 * @returns Inferred capabilities based on model name patterns
 *
 * @example
 * ```ts
 * const caps = inferModelCapabilities('kimi-k2.5-thinking');
 * // { thinking: true, alwaysThinking: true, videoInput: true, ... }
 * ```
 */
export function inferModelCapabilities(modelId: string): KimiModelCapabilities {
  const isThinkingModel = modelId.includes('-thinking');
  const isK25Model = modelId.includes('k2.5') || modelId.includes('k2-5');

  return {
    thinking: isThinkingModel,
    alwaysThinking: isThinkingModel,
    imageInput: true, // All Kimi models support images
    videoInput: isK25Model, // Only K2.5 models support video
    maxContextSize: 256_000, // 256k context window
    toolCalling: true,
    jsonMode: true,
    structuredOutputs: true
  };
}

// ============================================================================
// Provider Configuration
// ============================================================================

/**
 * Configuration for the chat language model.
 * @internal
 */
export interface KimiChatConfig {
  provider: string;
  baseURL: string;
  headers: () => Record<string, string | undefined>;
  fetch?: typeof globalThis.fetch;
  generateId?: () => string;
  supportsStructuredOutputs?: boolean;
  includeUsageInStream?: boolean;
  supportedUrls?: LanguageModelV3['supportedUrls'];
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Token usage information from Kimi API.
 */
export interface KimiTokenUsage {
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  total_tokens?: number | null;
  prompt_tokens_details?: {
    cached_tokens?: number | null;
  } | null;
  completion_tokens_details?: {
    reasoning_tokens?: number | null;
  } | null;
}

/**
 * Response metadata from Kimi API.
 */
export interface KimiResponseMetadata {
  id?: string | null;
  model?: string | null;
  created?: number | null;
}

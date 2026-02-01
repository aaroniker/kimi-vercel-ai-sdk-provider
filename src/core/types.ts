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

  /**
   * Default temperature for the model.
   * Thinking models require temperature=1.0 for optimal reasoning.
   */
  defaultTemperature?: number;

  /**
   * Whether temperature is locked (cannot be changed).
   * Thinking models have this set to true.
   */
  temperatureLocked?: boolean;

  /**
   * Default max output tokens for the model.
   * Thinking models need higher limits to avoid truncated reasoning.
   */
  defaultMaxOutputTokens?: number;
}

/**
 * Default temperature for thinking models.
 * Kimi thinking models require temperature=1.0 for optimal reasoning quality.
 */
export const THINKING_MODEL_TEMPERATURE = 1.0;

/**
 * Default max output tokens for thinking models.
 * Higher limit ensures reasoning traces aren't truncated.
 */
export const THINKING_MODEL_DEFAULT_MAX_TOKENS = 32768;

/**
 * Default max output tokens for standard models.
 */
export const STANDARD_MODEL_DEFAULT_MAX_TOKENS = 4096;

/**
 * Infer model capabilities from the model ID.
 *
 * @param modelId - The model identifier
 * @returns Inferred capabilities based on model name patterns
 *
 * @remarks
 * This function automatically detects model capabilities and sets
 * appropriate defaults:
 * - Thinking models (`-thinking` suffix) get temperature=1.0 locked
 * - Thinking models get 32k default max_tokens to avoid truncation
 * - K2.5 models get video input support
 *
 * @example
 * ```ts
 * const caps = inferModelCapabilities('kimi-k2.5-thinking');
 * // {
 * //   thinking: true,
 * //   alwaysThinking: true,
 * //   videoInput: true,
 * //   temperatureLocked: true,
 * //   defaultTemperature: 1.0,
 * //   defaultMaxOutputTokens: 32768,
 * //   ...
 * // }
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
    structuredOutputs: true,
    // Thinking models require temperature=1.0 for optimal reasoning
    defaultTemperature: isThinkingModel ? THINKING_MODEL_TEMPERATURE : undefined,
    temperatureLocked: isThinkingModel,
    // Thinking models need higher token limits to avoid truncated reasoning
    defaultMaxOutputTokens: isThinkingModel ? THINKING_MODEL_DEFAULT_MAX_TOKENS : STANDARD_MODEL_DEFAULT_MAX_TOKENS
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

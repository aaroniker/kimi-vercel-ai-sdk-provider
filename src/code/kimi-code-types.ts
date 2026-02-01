/**
 * Types for the Kimi Code provider.
 *
 * Kimi Code is a premium coding service within the Kimi ecosystem that provides:
 * - High-speed output (up to 100 tokens/s)
 * - Extended thinking/reasoning support
 * - Full compatibility with Claude Code and Roo Code
 * - Anthropic-compatible API format
 *
 * @see https://www.kimi.com/code/docs/en/
 * @module
 */

import type { LanguageModelV3 } from '@ai-sdk/provider';

// ============================================================================
// Constants
// ============================================================================

/**
 * Default Kimi Code API endpoint (Anthropic-compatible).
 * Used with Claude Code - set as ANTHROPIC_BASE_URL
 */
export const KIMI_CODE_BASE_URL = 'https://api.kimi.com/coding/v1';

/**
 * OpenAI-compatible API endpoint.
 * Used with Roo Code - set as OpenAI Compatible entrypoint
 */
export const KIMI_CODE_OPENAI_BASE_URL = 'https://api.kimi.com/coding/v1';

/**
 * Default Kimi Code model ID.
 * Primary coding model optimized for development tasks.
 */
export const KIMI_CODE_DEFAULT_MODEL = 'kimi-for-coding';

/**
 * Alternative model with enhanced thinking/reasoning.
 * Can be toggled with Tab key in Claude Code.
 */
export const KIMI_CODE_THINKING_MODEL = 'kimi-k2-thinking';

/**
 * All available Kimi Code models.
 */
export const KIMI_CODE_MODELS = [KIMI_CODE_DEFAULT_MODEL, KIMI_CODE_THINKING_MODEL] as const;

/**
 * Default max output tokens for Kimi Code (per Roo Code docs).
 */
export const KIMI_CODE_DEFAULT_MAX_TOKENS = 32768;

/**
 * Default context window size (per Roo Code docs).
 */
export const KIMI_CODE_DEFAULT_CONTEXT_WINDOW = 262144;

/**
 * Anthropic API version header value.
 */
export const KIMI_CODE_ANTHROPIC_VERSION = '2023-06-01';

// ============================================================================
// Model IDs
// ============================================================================

/**
 * Available Kimi Code model IDs.
 *
 * @remarks
 * - `kimi-for-coding` - Primary coding model optimized for development tasks
 * - `kimi-k2-thinking` - Model with extended thinking for complex reasoning (toggle with Tab in Claude Code)
 *
 * @example
 * ```ts
 * // Default model
 * const model = kimiCode('kimi-for-coding');
 *
 * // Thinking model
 * const thinkingModel = kimiCode('kimi-k2-thinking');
 * ```
 */
export type KimiCodeModelId = 'kimi-for-coding' | 'kimi-k2-thinking' | (string & {});

// ============================================================================
// Model Capabilities
// ============================================================================

/**
 * Capabilities specific to Kimi Code models.
 * Based on Roo Code configuration documentation.
 */
export interface KimiCodeCapabilities {
  /**
   * Whether the model supports extended thinking/reasoning.
   * When enabled, use `thinking.type: 'enabled'` with `budget_tokens`.
   */
  extendedThinking?: boolean;

  /**
   * Maximum output tokens.
   * Default: 32768 (per Roo Code docs)
   */
  maxOutputTokens?: number;

  /**
   * Maximum context window size.
   * Default: 262144 (per Roo Code docs)
   */
  maxContextSize?: number;

  /**
   * Whether the model supports streaming.
   * Always true for Kimi Code.
   */
  streaming?: boolean;

  /**
   * Whether the model supports tool/function calling.
   * Always true for Kimi Code.
   */
  toolCalling?: boolean;

  /**
   * Whether the model supports image inputs.
   */
  imageInput?: boolean;
}

/**
 * Infer model capabilities from the model ID.
 *
 * @param modelId - The model identifier
 * @returns Inferred capabilities based on model name patterns
 *
 * @example
 * ```ts
 * const caps = inferKimiCodeCapabilities('kimi-k2-thinking');
 * // caps.extendedThinking === true
 * ```
 */
export function inferKimiCodeCapabilities(modelId: string): KimiCodeCapabilities {
  const isThinkingModel = modelId.includes('-thinking') || modelId.includes('k2-thinking');

  return {
    extendedThinking: isThinkingModel,
    maxOutputTokens: KIMI_CODE_DEFAULT_MAX_TOKENS,
    maxContextSize: KIMI_CODE_DEFAULT_CONTEXT_WINDOW,
    streaming: true,
    toolCalling: true,
    imageInput: true
  };
}

// ============================================================================
// Provider Configuration
// ============================================================================

/**
 * Configuration for the Kimi Code language model.
 * @internal
 */
export interface KimiCodeConfig {
  /**
   * Provider identifier.
   */
  provider: string;

  /**
   * Base URL for the API.
   */
  baseURL: string;

  /**
   * Function to get headers for requests.
   */
  headers: () => Record<string, string | undefined>;

  /**
   * Custom fetch implementation.
   */
  fetch?: typeof globalThis.fetch;

  /**
   * ID generator for tool call fallback IDs.
   */
  generateId?: () => string;

  /**
   * Whether to include usage in streaming responses.
   */
  includeUsageInStream?: boolean;

  /**
   * Override supported URL patterns.
   */
  supportedUrls?: LanguageModelV3['supportedUrls'];
}

// ============================================================================
// Extended Thinking Configuration
// ============================================================================

/**
 * Reasoning effort levels for extended thinking.
 * Maps to budget_tokens for the thinking parameter.
 *
 * Per Roo Code docs: Enable Reasoning Effort: Medium
 */
export type ReasoningEffort = 'low' | 'medium' | 'high';

/**
 * Configuration for extended thinking/reasoning.
 * Compatible with Anthropic's thinking parameter format.
 *
 * @example
 * ```ts
 * // Enable thinking with medium effort
 * const config: ExtendedThinkingConfig = {
 *   enabled: true,
 *   effort: 'medium'
 * };
 *
 * // Or specify exact budget tokens
 * const config: ExtendedThinkingConfig = {
 *   enabled: true,
 *   budgetTokens: 10000
 * };
 * ```
 */
export interface ExtendedThinkingConfig {
  /**
   * Enable extended thinking mode.
   * @default false
   */
  enabled?: boolean;

  /**
   * Reasoning effort level.
   * Controls how much computation is spent on reasoning.
   * - low: ~2048 tokens
   * - medium: ~8192 tokens (default, recommended by Roo Code)
   * - high: ~16384 tokens
   * @default 'medium'
   */
  effort?: ReasoningEffort;

  /**
   * Budget tokens for thinking (alternative to effort).
   * Higher values allow for more complex reasoning.
   * Takes precedence over effort if both are specified.
   */
  budgetTokens?: number;
}

// ============================================================================
// API Response Types (Anthropic-compatible)
// ============================================================================

/**
 * Token usage from Kimi Code API.
 * Follows Anthropic's usage format.
 */
export interface KimiCodeTokenUsage {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

/**
 * Response metadata from Kimi Code API.
 * Follows Anthropic's message format.
 */
export interface KimiCodeResponseMetadata {
  id?: string | null;
  model?: string | null;
  type?: string | null;
  stop_reason?: string | null;
  stop_sequence?: string | null;
}

/**
 * Thinking block in response (for extended thinking).
 * Appears when thinking is enabled.
 */
export interface KimiCodeThinkingBlock {
  type: 'thinking';
  thinking: string;
}

/**
 * Text block in response.
 */
export interface KimiCodeTextBlock {
  type: 'text';
  text: string;
}

/**
 * Tool use block in response.
 * Follows Anthropic's tool_use format.
 */
export interface KimiCodeToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * Content block types in Kimi Code responses.
 */
export type KimiCodeContentBlock = KimiCodeThinkingBlock | KimiCodeTextBlock | KimiCodeToolUseBlock;

// ============================================================================
// Streaming Event Types (Anthropic SSE format)
// ============================================================================

/**
 * Streaming event types from Kimi Code API.
 * Follows Anthropic's SSE format.
 *
 * Event sequence:
 * 1. message_start - Contains message metadata and initial usage
 * 2. content_block_start - Start of a content block (text, thinking, tool_use)
 * 3. content_block_delta - Incremental content updates
 * 4. content_block_stop - End of a content block
 * 5. message_delta - Final message updates (stop_reason, usage)
 * 6. message_stop - End of message
 *
 * @see https://docs.anthropic.com/claude/reference/streaming
 */
export type KimiCodeStreamEventType =
  | 'message_start'
  | 'content_block_start'
  | 'content_block_delta'
  | 'content_block_stop'
  | 'message_delta'
  | 'message_stop'
  | 'ping'
  | 'error';

/**
 * Delta types for content_block_delta events.
 */
export type KimiCodeDeltaType = 'text_delta' | 'thinking_delta' | 'input_json_delta';

/**
 * Stop reasons from Kimi Code API.
 * Follows Anthropic's stop_reason format.
 */
export type KimiCodeStopReason = 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | null;

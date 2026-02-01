import { LanguageModelV3 } from '@ai-sdk/provider';
import { z } from 'zod/v4';

// ============================================================================
// Model IDs
// ============================================================================

export type KimiChatModelId =
  | 'kimi-k2.5'
  | 'kimi-k2.5-thinking'
  | 'kimi-k2-turbo'
  | 'kimi-k2-thinking'
  | (string & {});

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
}

/**
 * Infer model capabilities from the model ID.
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
  };
}

// ============================================================================
// Built-in Tools
// ============================================================================

/**
 * Kimi's built-in web search tool identifier.
 * This is a special tool type that uses Kimi's server-side web search.
 */
export const KIMI_WEB_SEARCH_TOOL_NAME = '$web_search';

/**
 * Configuration for Kimi's built-in web search tool.
 */
export interface KimiWebSearchToolConfig {
  /**
   * Whether to enable the built-in web search tool.
   * When enabled, Kimi can search the web to answer questions.
   */
  enabled: boolean;

  /**
   * Optional search configuration.
   */
  config?: {
    /**
     * Whether to include search results in the response.
     */
    search_result?: boolean;
  };
}

/**
 * Helper to create the Kimi web search built-in tool definition.
 */
export function createKimiWebSearchTool(
  config?: KimiWebSearchToolConfig['config'],
): KimiBuiltinTool {
  return {
    type: 'builtin_function',
    function: {
      name: KIMI_WEB_SEARCH_TOOL_NAME,
      ...(config ? { config } : {}),
    },
  };
}

/**
 * A Kimi built-in tool (e.g., $web_search).
 * These are handled server-side by Kimi's API.
 */
export interface KimiBuiltinTool {
  type: 'builtin_function';
  function: {
    name: string;
    config?: Record<string, unknown>;
  };
}

// ============================================================================
// Chat Settings
// ============================================================================

export interface KimiChatSettings {
  /**
   * Enable JSON schema structured outputs when a schema is provided.
   */
  supportsStructuredOutputs?: boolean;

  /**
   * Request usage metrics during streaming (if supported by the API).
   */
  includeUsageInStream?: boolean;

  /**
   * Override supported URL patterns for file parts.
   */
  supportedUrls?: LanguageModelV3['supportedUrls'];

  /**
   * Enable the built-in web search tool.
   * When true, Kimi can search the web to answer questions.
   * You can also pass a configuration object for more control.
   */
  webSearch?: boolean | KimiWebSearchToolConfig;

  /**
   * Override inferred model capabilities.
   */
  capabilities?: Partial<KimiModelCapabilities>;
}

// ============================================================================
// Provider Options Schema
// ============================================================================

export const kimiProviderOptionsSchema = z.object({
  /**
   * A unique identifier representing your end-user.
   */
  user: z.string().optional(),

  /**
   * Whether to use strict JSON schema validation when supported.
   */
  strictJsonSchema: z.boolean().optional(),

  /**
   * Optional request ID to correlate logs.
   */
  requestId: z.string().optional(),

  /**
   * Optional extra headers for this call.
   */
  extraHeaders: z.record(z.string(), z.string()).optional(),

  /**
   * Whether the provider should allow parallel tool calls.
   */
  parallelToolCalls: z.boolean().optional(),

  /**
   * Enable or configure the built-in web search tool for this request.
   * This allows Kimi to search the web to help answer questions.
   */
  webSearch: z
    .union([
      z.boolean(),
      z.object({
        enabled: z.boolean(),
        config: z
          .object({
            search_result: z.boolean().optional(),
          })
          .optional(),
      }),
    ])
    .optional(),
});

export type KimiProviderOptions = z.infer<typeof kimiProviderOptionsSchema>;

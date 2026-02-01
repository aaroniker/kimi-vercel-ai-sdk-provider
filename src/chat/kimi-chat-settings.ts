/**
 * Chat model settings and provider options schema.
 * @module
 */

import type { LanguageModelV3 } from '@ai-sdk/provider';
import type { KimiModelCapabilities } from '../core';
import type { KimiCodeInterpreterToolOptions, KimiWebSearchToolOptions } from '../tools';
import { z } from 'zod/v4';

// ============================================================================
// Re-exports
// ============================================================================

export type {
  KimiChatConfig,
  KimiChatModelId,
  KimiModelCapabilities
} from '../core';
export { inferModelCapabilities } from '../core';

// ============================================================================
// Context Caching Types
// ============================================================================

/**
 * Configuration for context caching.
 * Enables cost reduction for long, repeated prompts.
 */
export interface KimiCachingConfig {
  /**
   * Enable context caching for this request.
   */
  enabled: boolean;

  /**
   * Optional cache key for identifying cached context.
   * Use the same key across requests to hit the same cache.
   */
  cacheKey?: string;

  /**
   * Time-to-live for the cache in seconds.
   * Defaults to API default (typically 3600 seconds / 1 hour).
   */
  ttlSeconds?: number;

  /**
   * Reset the cache even if a matching cache exists.
   */
  resetCache?: boolean;
}

// ============================================================================
// Chat Settings
// ============================================================================

/**
 * Settings for creating a Kimi chat model instance.
 */
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
  webSearch?: boolean | KimiWebSearchToolOptions;

  /**
   * Enable the built-in code interpreter tool.
   * When true, Kimi can execute code to solve problems.
   * You can also pass a configuration object for more control.
   */
  codeInterpreter?: boolean | KimiCodeInterpreterToolOptions;

  /**
   * Override inferred model capabilities.
   */
  capabilities?: Partial<KimiModelCapabilities>;

  /**
   * Enable tool choice polyfill for unsupported tool choice modes.
   * When true (default), uses system message injection to simulate
   * `required` and `tool` choices that Kimi doesn't natively support.
   *
   * @default true
   */
  toolChoicePolyfill?: boolean;

  /**
   * Enable automatic file handling for experimental_attachments.
   * When true, PDFs and documents will be automatically uploaded
   * to Kimi's file API and their content injected into the context.
   *
   * @default false
   */
  autoFileUpload?: boolean;

  /**
   * Context caching configuration.
   * Reduces costs by up to 90% for repeated long prompts.
   */
  caching?: boolean | KimiCachingConfig;

  /**
   * Auto-enable tools based on prompt content analysis.
   * When true, the provider will analyze the prompt and automatically
   * enable webSearch or codeInterpreter if patterns match.
   *
   * @default false
   */
  autoEnableTools?: boolean;
}

// ============================================================================
// Provider Options Schema
// ============================================================================

/**
 * Zod schema for caching configuration.
 */
export const kimiCachingConfigSchema = z.object({
  enabled: z.boolean(),
  cacheKey: z.string().optional(),
  ttlSeconds: z.number().optional(),
  resetCache: z.boolean().optional()
});

/**
 * Zod schema for validating provider options passed to individual calls.
 */
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
            search_result: z.boolean().optional()
          })
          .optional()
      })
    ])
    .optional(),

  /**
   * Enable or configure the built-in code interpreter tool for this request.
   * This allows Kimi to execute code to help solve problems.
   */
  codeInterpreter: z
    .union([
      z.boolean(),
      z.object({
        enabled: z.boolean(),
        config: z
          .object({
            timeout: z.number().optional(),
            include_output: z.boolean().optional()
          })
          .optional()
      })
    ])
    .optional(),

  /**
   * Enable or configure context caching for this request.
   * Reduces costs for repeated long prompts.
   */
  caching: z.union([z.boolean(), kimiCachingConfigSchema]).optional(),

  /**
   * Enable tool choice polyfill for this request.
   */
  toolChoicePolyfill: z.boolean().optional(),

  /**
   * Auto-enable tools based on prompt content analysis.
   */
  autoEnableTools: z.boolean().optional()
});

/**
 * Type for provider options passed to individual calls.
 */
export type KimiProviderOptions = z.infer<typeof kimiProviderOptionsSchema>;

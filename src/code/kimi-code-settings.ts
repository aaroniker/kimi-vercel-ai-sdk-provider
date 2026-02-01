/**
 * Settings for the Kimi Code provider.
 *
 * @remarks
 * Kimi Code is compatible with Claude Code and Roo Code agents.
 * Default settings are based on Roo Code documentation:
 * - Max Output Tokens: 32768
 * - Context Window Size: 262144
 * - Reasoning Effort: Medium
 *
 * @see https://www.kimi.com/code/docs/en/more/third-party-agents.html
 * @module
 */

import type { ExtendedThinkingConfig, KimiCodeCapabilities, ReasoningEffort } from './kimi-code-types';
import { z } from 'zod/v4';

// ============================================================================
// Settings Interface
// ============================================================================

/**
 * Settings for creating a Kimi Code model instance.
 */
export interface KimiCodeSettings {
  /**
   * Override inferred model capabilities.
   */
  capabilities?: KimiCodeCapabilities;

  /**
   * Extended thinking/reasoning configuration.
   * When enabled, the model will show its reasoning process.
   *
   * @example
   * ```ts
   * const model = kimiCode('kimi-for-coding', {
   *   extendedThinking: {
   *     enabled: true,
   *     effort: 'high'
   *   }
   * });
   * ```
   */
  extendedThinking?: ExtendedThinkingConfig | boolean;

  /**
   * Whether to include usage in streaming responses.
   */
  includeUsageInStream?: boolean;

  /**
   * Override supported URL patterns.
   */
  supportedUrls?: Record<string, RegExp[]>;
}

// ============================================================================
// Provider Options Schema
// ============================================================================

/**
 * Schema for Kimi Code provider options passed via providerOptions.
 */
export const kimiCodeProviderOptionsSchema = z.object({
  /**
   * Extended thinking configuration.
   */
  extendedThinking: z
    .union([
      z.boolean(),
      z.object({
        enabled: z.boolean().optional(),
        effort: z.enum(['low', 'medium', 'high']).optional(),
        budgetTokens: z.number().optional()
      })
    ])
    .optional(),

  /**
   * System prompt to prepend.
   */
  system: z.string().optional(),

  /**
   * Custom stop sequences.
   */
  stopSequences: z.array(z.string()).optional()
});

/**
 * Inferred type from the provider options schema.
 */
export type KimiCodeProviderOptions = z.infer<typeof kimiCodeProviderOptionsSchema>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Normalize extended thinking config to a consistent format.
 *
 * @param config - Boolean or config object
 * @returns Normalized config object
 */
export function normalizeExtendedThinkingConfig(
  config: ExtendedThinkingConfig | boolean | undefined
): ExtendedThinkingConfig | undefined {
  if (config === undefined) {
    return undefined;
  }

  if (typeof config === 'boolean') {
    return config ? { enabled: true, effort: 'medium' } : { enabled: false };
  }

  return {
    enabled: config.enabled ?? true,
    effort: config.effort ?? 'medium',
    budgetTokens: config.budgetTokens
  };
}

/**
 * Convert reasoning effort to budget tokens.
 *
 * @param effort - Reasoning effort level
 * @returns Approximate budget tokens for the effort level
 */
export function effortToBudgetTokens(effort: ReasoningEffort): number {
  switch (effort) {
    case 'low':
      return 2048;
    case 'medium':
      return 8192;
    case 'high':
      return 16384;
    default:
      return 8192;
  }
}

// ============================================================================
// Anthropic API Conversion Helpers
// ============================================================================

/**
 * Convert ExtendedThinkingConfig to Anthropic API thinking parameter format.
 *
 * @remarks
 * This converts our config to the Anthropic API format expected by Kimi Code:
 * - `{ type: 'enabled', budget_tokens: number }` when enabled
 * - `{ type: 'disabled' }` when disabled
 * - `undefined` when not configured
 *
 * @param config - Extended thinking configuration (boolean or object)
 * @returns Anthropic-compatible thinking parameter or undefined
 *
 * @example
 * ```ts
 * // From boolean
 * toAnthropicThinking(true)
 * // => { type: 'enabled', budget_tokens: 8192 }
 *
 * // From config object
 * toAnthropicThinking({ enabled: true, effort: 'high' })
 * // => { type: 'enabled', budget_tokens: 16384 }
 *
 * // With explicit budget
 * toAnthropicThinking({ enabled: true, budgetTokens: 10000 })
 * // => { type: 'enabled', budget_tokens: 10000 }
 * ```
 */
export function toAnthropicThinking(
  config: ExtendedThinkingConfig | boolean | undefined
): { type: 'enabled'; budget_tokens: number } | { type: 'disabled' } | undefined {
  const normalized = normalizeExtendedThinkingConfig(config);

  if (normalized === undefined) {
    return undefined;
  }

  if (!normalized.enabled) {
    return { type: 'disabled' };
  }

  const budgetTokens = normalized.budgetTokens ?? effortToBudgetTokens(normalized.effort ?? 'medium');

  return {
    type: 'enabled',
    budget_tokens: budgetTokens
  };
}

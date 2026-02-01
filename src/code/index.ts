/**
 * Kimi Code module - Premium coding service with extended thinking support.
 *
 * @remarks
 * Kimi Code provides high-speed coding assistance (up to 100 tokens/s)
 * with full compatibility for Claude Code and Roo Code agents.
 *
 * **Quick Start:**
 * ```ts
 * import { kimiCode } from 'kimi-vercel-ai-sdk-provider
';
 *
 * const result = await generateText({
 *   model: kimiCode(), // Uses 'kimi-for-coding' by default
 *   prompt: 'Write a function to merge sorted arrays',
 * });
 * ```
 *
 * @see https://www.kimi.com/code/docs/en/
 * @module
 */

// Messages
export type { KimiCodeContentPart, KimiCodeMessage, KimiCodePrompt } from './kimi-code-messages';
// Provider
export type { KimiCodeProvider, KimiCodeProviderSettings } from './kimi-code-provider';
// Settings
export type { KimiCodeProviderOptions, KimiCodeSettings } from './kimi-code-settings';
// Types
export type {
  ExtendedThinkingConfig,
  KimiCodeCapabilities,
  KimiCodeConfig,
  KimiCodeContentBlock,
  KimiCodeDeltaType,
  KimiCodeModelId,
  KimiCodeResponseMetadata,
  KimiCodeStopReason,
  KimiCodeStreamEventType,
  KimiCodeTextBlock,
  KimiCodeThinkingBlock,
  KimiCodeTokenUsage,
  KimiCodeToolUseBlock,
  ReasoningEffort
} from './kimi-code-types';
// Language Model
export { KimiCodeLanguageModel } from './kimi-code-language-model';
export { convertToKimiCodePrompt } from './kimi-code-messages';
export { createKimiCode, kimiCode } from './kimi-code-provider';
export {
  effortToBudgetTokens,
  kimiCodeProviderOptionsSchema,
  normalizeExtendedThinkingConfig,
  toAnthropicThinking
} from './kimi-code-settings';
export {
  KIMI_CODE_ANTHROPIC_VERSION,
  KIMI_CODE_BASE_URL,
  KIMI_CODE_DEFAULT_CONTEXT_WINDOW,
  KIMI_CODE_DEFAULT_MAX_TOKENS,
  KIMI_CODE_DEFAULT_MODEL,
  KIMI_CODE_MODELS,
  KIMI_CODE_OPENAI_BASE_URL,
  KIMI_CODE_THINKING_MODEL,
  inferKimiCodeCapabilities
} from './kimi-code-types';

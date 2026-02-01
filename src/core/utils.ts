/**
 * Utility functions for the Kimi provider.
 * @module
 */

import type { JSONObject, LanguageModelV3FinishReason, LanguageModelV3Usage } from '@ai-sdk/provider';
import type { KimiResponseMetadata, KimiTokenUsage } from './types';

// ============================================================================
// Finish Reason Mapping
// ============================================================================

/**
 * Map Kimi finish reasons to standard AI SDK finish reasons.
 *
 * @param finishReason - The raw finish reason from Kimi API
 * @returns The mapped unified finish reason
 */
export function mapKimiFinishReason(finishReason: string | null | undefined): LanguageModelV3FinishReason['unified'] {
  switch (finishReason) {
    case 'stop':
      return 'stop';
    case 'length':
      return 'length';
    case 'content_filter':
      return 'content-filter';
    case 'tool_calls':
    case 'function_call':
      return 'tool-calls';
    default:
      return 'other';
  }
}

// ============================================================================
// Usage Conversion
// ============================================================================

/**
 * Extended usage information including web search and code interpreter tokens.
 */
export interface KimiExtendedUsage extends LanguageModelV3Usage {
  /**
   * Tokens used by the built-in web search tool.
   */
  webSearchTokens?: number;

  /**
   * Tokens used by the built-in code interpreter.
   */
  codeInterpreterTokens?: number;
}

/**
 * Convert Kimi usage data to standard AI SDK usage format.
 *
 * @param usage - The raw usage data from Kimi API
 * @param webSearchTokens - Optional web search token count
 * @param codeInterpreterTokens - Optional code interpreter token count
 * @returns Standardized usage object
 */
export function convertKimiUsage(
  usage: KimiTokenUsage | null | undefined,
  webSearchTokens?: number,
  codeInterpreterTokens?: number
): KimiExtendedUsage {
  if (usage == null) {
    return {
      inputTokens: {
        total: undefined,
        noCache: undefined,
        cacheRead: undefined,
        cacheWrite: undefined
      },
      outputTokens: {
        total: undefined,
        text: undefined,
        reasoning: undefined
      },
      raw: undefined,
      ...(webSearchTokens != null ? { webSearchTokens } : {}),
      ...(codeInterpreterTokens != null ? { codeInterpreterTokens } : {})
    };
  }

  const promptTokens = usage.prompt_tokens ?? 0;
  const completionTokens = usage.completion_tokens ?? 0;
  const cacheReadTokens = usage.prompt_tokens_details?.cached_tokens ?? 0;
  const reasoningTokens = usage.completion_tokens_details?.reasoning_tokens ?? 0;

  // Convert to JSONObject for the raw field
  const rawUsage: JSONObject = {
    prompt_tokens: usage.prompt_tokens ?? undefined,
    completion_tokens: usage.completion_tokens ?? undefined,
    total_tokens: usage.total_tokens ?? undefined,
    ...(usage.prompt_tokens_details
      ? {
          prompt_tokens_details: {
            cached_tokens: usage.prompt_tokens_details.cached_tokens ?? undefined
          }
        }
      : {}),
    ...(usage.completion_tokens_details
      ? {
          completion_tokens_details: {
            reasoning_tokens: usage.completion_tokens_details.reasoning_tokens ?? undefined
          }
        }
      : {})
  };

  return {
    inputTokens: {
      total: promptTokens,
      noCache: promptTokens - cacheReadTokens,
      cacheRead: cacheReadTokens,
      cacheWrite: undefined
    },
    outputTokens: {
      total: completionTokens,
      text: completionTokens - reasoningTokens,
      reasoning: reasoningTokens
    },
    raw: rawUsage,
    ...(webSearchTokens != null ? { webSearchTokens } : {}),
    ...(codeInterpreterTokens != null ? { codeInterpreterTokens } : {})
  };
}

// ============================================================================
// Response Metadata
// ============================================================================

/**
 * Extract response metadata from Kimi API response.
 *
 * @param response - The raw response metadata
 * @returns Formatted response metadata
 */
export function getResponseMetadata(response: KimiResponseMetadata) {
  return {
    id: response.id ?? undefined,
    modelId: response.model ?? undefined,
    timestamp: response.created != null ? new Date(response.created * 1000) : undefined
  };
}

/**
 * Extract request ID from response headers.
 *
 * @param headers - Response headers
 * @returns The request ID if found
 */
export function getKimiRequestId(headers?: Record<string, string>): string | undefined {
  if (!headers) {
    return undefined;
  }

  const lowerHeaders = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));

  return lowerHeaders['x-request-id'] || lowerHeaders['x-trace-id'] || lowerHeaders['x-moonshot-request-id'];
}

// ============================================================================
// Message Content Extraction
// ============================================================================

/**
 * Extract text and reasoning content from a message.
 *
 * @param message - The message object from API response
 * @returns Extracted text and reasoning content
 */
export function extractMessageContent(message: {
  content?: unknown;
  reasoning_content?: string | null;
  reasoning?: string | null;
}): { text: string; reasoning: string } {
  let text = '';
  let reasoning = '';

  if (typeof message.content === 'string') {
    text = message.content;
  } else if (Array.isArray(message.content)) {
    for (const part of message.content) {
      if (part && typeof part === 'object') {
        const candidate = part as Record<string, unknown>;
        if (candidate.type === 'text' && typeof candidate.text === 'string') {
          text += candidate.text;
        }
        if (candidate.type === 'thinking' && typeof candidate.thinking === 'string') {
          reasoning += candidate.thinking;
        }
        if (candidate.type === 'reasoning' && typeof candidate.text === 'string') {
          reasoning += candidate.text;
        }
      }
    }
  }

  if (typeof message.reasoning_content === 'string') {
    reasoning += message.reasoning_content;
  }

  if (typeof message.reasoning === 'string') {
    reasoning += message.reasoning;
  }

  return { text, reasoning };
}

// ============================================================================
// Multi-turn Reasoning Utilities
// ============================================================================

/**
 * Information about reasoning content in a conversation.
 */
export interface ReasoningAnalysis {
  /** Total number of messages with reasoning content */
  messagesWithReasoning: number;
  /** Total reasoning tokens (estimated by character count / 4) */
  estimatedReasoningTokens: number;
  /** Whether reasoning is properly preserved in the conversation */
  isPreserved: boolean;
  /** Messages that are missing expected reasoning content */
  missingReasoningIndices: number[];
}

/**
 * Analyze reasoning content preservation in a conversation.
 *
 * This utility helps verify that reasoning content is being properly
 * preserved across multi-turn conversations with thinking models.
 * Kimi requires reasoning content to be maintained in the message
 * history for logical continuity in agentic/tool-calling scenarios.
 *
 * @param messages - Array of messages to analyze
 * @returns Analysis of reasoning preservation
 *
 * @example
 * ```ts
 * const analysis = analyzeReasoningPreservation(messages);
 * if (!analysis.isPreserved) {
 *   console.warn('Reasoning content missing from messages:', analysis.missingReasoningIndices);
 * }
 * ```
 */
export function analyzeReasoningPreservation(
  messages: Array<{
    role: string;
    content?: unknown;
    reasoning_content?: string | null;
    reasoning?: string | null;
  }>
): ReasoningAnalysis {
  let messagesWithReasoning = 0;
  let totalReasoningChars = 0;
  const missingReasoningIndices: number[] = [];

  // Track whether we've seen a tool call that should have reasoning preserved
  let expectReasoningAfterToolCall = false;

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];

    if (message.role === 'assistant') {
      const { reasoning } = extractMessageContent(message);

      if (reasoning.length > 0) {
        messagesWithReasoning++;
        totalReasoningChars += reasoning.length;
        expectReasoningAfterToolCall = false;
      } else if (expectReasoningAfterToolCall) {
        // This assistant message should have reasoning from the previous turn
        missingReasoningIndices.push(i);
      }

      // Check if this message has tool calls
      if ('tool_calls' in message && Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
        expectReasoningAfterToolCall = true;
      }
    } else if (message.role === 'tool') {
      // After a tool response, we expect the next assistant message to potentially have reasoning
      expectReasoningAfterToolCall = true;
    }
  }

  return {
    messagesWithReasoning,
    estimatedReasoningTokens: Math.ceil(totalReasoningChars / 4),
    isPreserved: missingReasoningIndices.length === 0,
    missingReasoningIndices
  };
}

/**
 * Check if a conversation is suitable for thinking models.
 *
 * Thinking models work best with:
 * - Complex reasoning tasks
 * - Multi-step problem solving
 * - Tasks requiring chain-of-thought
 *
 * This helper provides guidance on whether a thinking model would benefit
 * the conversation.
 *
 * @param messageCount - Number of messages in the conversation
 * @param hasToolCalls - Whether the conversation includes tool calls
 * @param estimatedComplexity - Estimated task complexity (0-1)
 * @returns Recommendation on using thinking models
 */
export function recommendThinkingModel(
  messageCount: number,
  hasToolCalls: boolean,
  estimatedComplexity: number
): { recommended: boolean; reason: string } {
  // Thinking models are recommended for:
  // 1. Complex tasks (complexity > 0.5)
  // 2. Agentic scenarios with tool calls
  // 3. Multi-turn conversations where reasoning continuity matters

  if (estimatedComplexity > 0.7) {
    return {
      recommended: true,
      reason: 'High complexity task benefits from extended reasoning'
    };
  }

  if (hasToolCalls && messageCount > 2) {
    return {
      recommended: true,
      reason: 'Multi-turn tool usage benefits from reasoning preservation'
    };
  }

  if (estimatedComplexity > 0.5) {
    return {
      recommended: true,
      reason: 'Moderate complexity may benefit from reasoning'
    };
  }

  return {
    recommended: false,
    reason: 'Standard model sufficient for this task'
  };
}

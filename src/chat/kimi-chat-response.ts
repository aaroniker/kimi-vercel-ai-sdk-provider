/**
 * Response processing utilities for Kimi API.
 * @module
 */

import { KIMI_CODE_INTERPRETER_TOOL_NAME, KIMI_WEB_SEARCH_TOOL_NAME } from '../tools';

export type { KimiExtendedUsage, KimiTokenUsage } from '../core';
export {
  convertKimiUsage,
  extractMessageContent,
  getKimiRequestId,
  getResponseMetadata,
  mapKimiFinishReason
} from '../core';

// ============================================================================
// Built-in Tool Token Extraction
// ============================================================================

/**
 * Tool call structure for token extraction.
 */
interface ToolCallForTokens {
  function: { name: string; arguments?: string | null };
}

/**
 * Extract total_tokens from $web_search tool call arguments.
 * The Kimi API includes usage information in the tool call arguments.
 *
 * @param toolCalls - The tool calls from the response
 * @returns The total web search tokens, or undefined if no web search was used
 */
export function extractWebSearchTokens(toolCalls: Array<ToolCallForTokens> | null | undefined): number | undefined {
  return extractBuiltinToolTokens(toolCalls, KIMI_WEB_SEARCH_TOOL_NAME);
}

/**
 * Extract total_tokens from $code tool call arguments.
 * The Kimi API includes usage information in the tool call arguments.
 *
 * @param toolCalls - The tool calls from the response
 * @returns The total code interpreter tokens, or undefined if no code was executed
 */
export function extractCodeInterpreterTokens(
  toolCalls: Array<ToolCallForTokens> | null | undefined
): number | undefined {
  return extractBuiltinToolTokens(toolCalls, KIMI_CODE_INTERPRETER_TOOL_NAME);
}

/**
 * Extract tokens from a specific built-in tool.
 */
function extractBuiltinToolTokens(
  toolCalls: Array<ToolCallForTokens> | null | undefined,
  toolName: string
): number | undefined {
  if (!toolCalls) {
    return undefined;
  }

  let totalTokens = 0;
  let foundTool = false;

  for (const toolCall of toolCalls) {
    if (toolCall.function.name === toolName) {
      foundTool = true;

      if (toolCall.function.arguments) {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          if (typeof args.total_tokens === 'number') {
            totalTokens += args.total_tokens;
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
  }

  return foundTool ? totalTokens : undefined;
}

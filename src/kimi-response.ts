import { JSONObject, LanguageModelV3FinishReason, LanguageModelV3Usage } from '@ai-sdk/provider';
import { KIMI_WEB_SEARCH_TOOL_NAME } from './kimi-chat-options';

// ============================================================================
// Finish Reason Mapping
// ============================================================================

export function mapKimiFinishReason(
  finishReason: string | null | undefined,
): LanguageModelV3FinishReason['unified'] {
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
// Usage Types
// ============================================================================

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
 * Extended usage information including web search tokens.
 */
export interface KimiExtendedUsage extends LanguageModelV3Usage {
  /**
   * Tokens used by the built-in web search tool.
   * This is extracted from the $web_search tool call arguments.
   */
  webSearchTokens?: number;
}

// ============================================================================
// Usage Conversion
// ============================================================================

export function convertKimiUsage(
  usage: KimiTokenUsage | null | undefined,
  webSearchTokens?: number,
): KimiExtendedUsage {
  if (usage == null) {
    return {
      inputTokens: {
        total: undefined,
        noCache: undefined,
        cacheRead: undefined,
        cacheWrite: undefined,
      },
      outputTokens: {
        total: undefined,
        text: undefined,
        reasoning: undefined,
      },
      raw: undefined,
      ...(webSearchTokens != null ? { webSearchTokens } : {}),
    };
  }

  const promptTokens = usage.prompt_tokens ?? 0;
  const completionTokens = usage.completion_tokens ?? 0;
  const cacheReadTokens = usage.prompt_tokens_details?.cached_tokens ?? 0;
  const reasoningTokens =
    usage.completion_tokens_details?.reasoning_tokens ?? 0;

  // Convert usage to JSONObject for the raw field
  const rawUsage: JSONObject = {
    prompt_tokens: usage.prompt_tokens ?? undefined,
    completion_tokens: usage.completion_tokens ?? undefined,
    total_tokens: usage.total_tokens ?? undefined,
    ...(usage.prompt_tokens_details
      ? {
          prompt_tokens_details: {
            cached_tokens: usage.prompt_tokens_details.cached_tokens ?? undefined,
          },
        }
      : {}),
    ...(usage.completion_tokens_details
      ? {
          completion_tokens_details: {
            reasoning_tokens: usage.completion_tokens_details.reasoning_tokens ?? undefined,
          },
        }
      : {}),
  };

  return {
    inputTokens: {
      total: promptTokens,
      noCache: promptTokens - cacheReadTokens,
      cacheRead: cacheReadTokens,
      cacheWrite: undefined,
    },
    outputTokens: {
      total: completionTokens,
      text: completionTokens - reasoningTokens,
      reasoning: reasoningTokens,
    },
    raw: rawUsage,
    ...(webSearchTokens != null ? { webSearchTokens } : {}),
  };
}

// ============================================================================
// Response Metadata
// ============================================================================

export function getResponseMetadata({
  id,
  model,
  created,
}: {
  id?: string | null;
  model?: string | null;
  created?: number | null;
}) {
  return {
    id: id ?? undefined,
    modelId: model ?? undefined,
    timestamp: created != null ? new Date(created * 1000) : undefined,
  };
}

export function getKimiRequestId(headers?: Record<string, string>) {
  if (!headers) {
    return undefined;
  }

  const lowerHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );

  return (
    lowerHeaders['x-request-id'] ||
    lowerHeaders['x-trace-id'] ||
    lowerHeaders['x-moonshot-request-id']
  );
}

// ============================================================================
// Web Search Token Extraction
// ============================================================================

/**
 * Extract total_tokens from $web_search tool call arguments.
 * The Kimi API includes usage information in the tool call arguments.
 */
export function extractWebSearchTokens(
  toolCalls: Array<{
    function: { name: string; arguments?: string | null };
  }> | null | undefined,
): number | undefined {
  if (!toolCalls) {
    return undefined;
  }

  let totalSearchTokens = 0;
  let foundSearchTool = false;

  for (const toolCall of toolCalls) {
    if (toolCall.function.name === KIMI_WEB_SEARCH_TOOL_NAME) {
      foundSearchTool = true;

      if (toolCall.function.arguments) {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          if (typeof args.total_tokens === 'number') {
            totalSearchTokens += args.total_tokens;
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
  }

  return foundSearchTool ? totalSearchTokens : undefined;
}

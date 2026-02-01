/**
 * Message conversion for Kimi Code API.
 * Converts AI SDK messages to Anthropic-compatible format used by Kimi Code.
 * @module
 */

import type { LanguageModelV3FilePart, LanguageModelV3Prompt } from '@ai-sdk/provider';
import { UnsupportedFunctionalityError } from '@ai-sdk/provider';
import { convertToBase64 } from '@ai-sdk/provider-utils';

// ============================================================================
// Types
// ============================================================================

/**
 * Kimi Code message content part types.
 */
export type KimiCodeContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'image'; source: { type: 'url'; url: string } }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string | KimiCodeContentPart[]; is_error?: boolean };

/**
 * Kimi Code message format (Anthropic-compatible).
 */
export interface KimiCodeMessage {
  role: 'user' | 'assistant';
  content: string | KimiCodeContentPart[];
}

/**
 * Kimi Code prompt structure.
 */
export interface KimiCodePrompt {
  system?: string;
  messages: KimiCodeMessage[];
}

// ============================================================================
// Conversion Functions
// ============================================================================

/**
 * Convert AI SDK prompt to Kimi Code message format.
 *
 * @param prompt - AI SDK prompt
 * @returns Kimi Code formatted prompt with system and messages
 */
export async function convertToKimiCodePrompt(prompt: LanguageModelV3Prompt): Promise<KimiCodePrompt> {
  let systemMessage: string | undefined;
  const messages: KimiCodeMessage[] = [];

  for (const message of prompt) {
    switch (message.role) {
      case 'system': {
        // System messages have content as string in V3
        const systemText = typeof message.content === 'string' ? message.content : '';
        systemMessage = systemMessage ? `${systemMessage}\n\n${systemText}` : systemText;
        break;
      }

      case 'user': {
        const content: KimiCodeContentPart[] = [];

        for (const part of message.content) {
          switch (part.type) {
            case 'text':
              content.push({ type: 'text', text: part.text });
              break;

            case 'file':
              // Check if it's an image file
              if (part.mediaType?.startsWith('image/')) {
                content.push(await convertFilePart(part));
              } else {
                throw new UnsupportedFunctionalityError({
                  functionality: `file type: ${part.mediaType}`
                });
              }
              break;

            default:
              throw new UnsupportedFunctionalityError({
                functionality: `user content part type: ${(part as { type: string }).type}`
              });
          }
        }

        messages.push({
          role: 'user',
          content: content.length === 1 && content[0].type === 'text' ? content[0].text : content
        });
        break;
      }

      case 'assistant': {
        const content: KimiCodeContentPart[] = [];

        for (const part of message.content) {
          switch (part.type) {
            case 'text':
              content.push({ type: 'text', text: part.text });
              break;

            case 'tool-call':
              content.push({
                type: 'tool_use',
                id: part.toolCallId,
                name: part.toolName,
                input: typeof part.input === 'string' ? JSON.parse(part.input) : (part.input as Record<string, unknown>)
              });
              break;

            case 'reasoning':
              // Include reasoning as text (Kimi Code handles thinking blocks)
              if (part.text) {
                content.push({ type: 'text', text: `<thinking>${part.text}</thinking>` });
              }
              break;

            default:
              throw new UnsupportedFunctionalityError({
                functionality: `assistant content part type: ${(part as { type: string }).type}`
              });
          }
        }

        if (content.length > 0) {
          messages.push({
            role: 'assistant',
            content: content.length === 1 && content[0].type === 'text' ? content[0].text : content
          });
        }
        break;
      }

      case 'tool': {
        // Tool results need to be part of a user message in Anthropic format
        const toolResults: KimiCodeContentPart[] = [];

        for (const part of message.content) {
          if (part.type === 'tool-result') {
            toolResults.push(convertToolResultPart(part));
          }
        }

        // If the last message is from the assistant, add tool results as user message
        if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
          messages.push({
            role: 'user',
            content: toolResults
          });
        } else {
          // Merge with existing user message or create new one
          const lastMessage = messages[messages.length - 1];
          if (lastMessage?.role === 'user' && Array.isArray(lastMessage.content)) {
            lastMessage.content.push(...toolResults);
          } else {
            messages.push({
              role: 'user',
              content: toolResults
            });
          }
        }
        break;
      }

      default:
        throw new UnsupportedFunctionalityError({
          functionality: `message role: ${(message as { role: string }).role}`
        });
    }
  }

  return {
    system: systemMessage,
    messages
  };
}

/**
 * Convert a file part to Kimi Code format.
 */
async function convertFilePart(part: LanguageModelV3FilePart): Promise<KimiCodeContentPart> {
  const mediaType = part.mediaType ?? 'image/png';

  // Handle URL data
  if (part.data instanceof URL) {
    return {
      type: 'image',
      source: {
        type: 'url',
        url: part.data.toString()
      }
    };
  }

  // Handle string data
  if (typeof part.data === 'string') {
    // Check if it's a URL string
    if (part.data.startsWith('http://') || part.data.startsWith('https://')) {
      return {
        type: 'image',
        source: {
          type: 'url',
          url: part.data
        }
      };
    }

    // Check if it's a data URL
    if (part.data.startsWith('data:')) {
      const [header, data] = part.data.split(',');
      const extractedMimeType = header.match(/data:([^;]+)/)?.[1] ?? mediaType;
      return {
        type: 'image',
        source: {
          type: 'base64',
          media_type: extractedMimeType,
          data
        }
      };
    }

    // Assume it's base64 encoded
    return {
      type: 'image',
      source: {
        type: 'base64',
        media_type: mediaType,
        data: part.data
      }
    };
  }

  // Handle Uint8Array - convert to base64
  const base64 = convertToBase64(part.data);
  return {
    type: 'image',
    source: {
      type: 'base64',
      media_type: mediaType,
      data: base64
    }
  };
}

/**
 * Tool result output type from LanguageModelV3.
 */
interface ToolResultOutput {
  type: 'text' | 'error-text' | 'json' | 'error-json' | 'content' | 'execution-denied';
  value?: unknown;
  reason?: string;
}

/**
 * Convert a tool result part to Kimi Code format.
 */
function convertToolResultPart(part: {
  type: 'tool-result';
  toolCallId: string;
  toolName: string;
  output: ToolResultOutput;
}): KimiCodeContentPart {
  // Handle different output types based on the discriminated union
  const output = part.output;
  let content: string;
  let isError = false;

  switch (output.type) {
    case 'text':
      content = String(output.value ?? '');
      break;
    case 'error-text':
      content = String(output.value ?? '');
      isError = true;
      break;
    case 'execution-denied':
      content = output.reason ?? 'Tool execution denied.';
      isError = true;
      break;
    case 'json':
    case 'content':
      content = JSON.stringify(output.value);
      break;
    case 'error-json':
      content = JSON.stringify(output.value);
      isError = true;
      break;
    default:
      content = JSON.stringify(output);
  }

  return {
    type: 'tool_result',
    tool_use_id: part.toolCallId,
    content,
    is_error: isError || undefined
  };
}

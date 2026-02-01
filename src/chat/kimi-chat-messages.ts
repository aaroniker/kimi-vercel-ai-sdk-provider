/**
 * Message conversion utilities for Kimi API.
 * @module
 */

import {
  type LanguageModelV3Prompt,
  type LanguageModelV3ToolResultPart,
  UnsupportedFunctionalityError
} from '@ai-sdk/provider';
import { convertToBase64 } from '@ai-sdk/provider-utils';
import { isBuiltinToolName } from '../tools';

// ============================================================================
// Message Types
// ============================================================================

/**
 * A Kimi chat message.
 */
export type KimiChatMessage =
  | {
      role: 'system';
      content: string;
    }
  | {
      role: 'user';
      content: string | Array<KimiChatContentPart>;
    }
  | {
      role: 'assistant';
      content: string | null;
      reasoning_content?: string;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
      }>;
    }
  | {
      role: 'tool';
      tool_call_id: string;
      content: string;
    };

/**
 * A content part in a user message.
 */
export type KimiChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'video_url'; video_url: { url: string } };

/**
 * A sequence of Kimi chat messages.
 */
export type KimiChatPrompt = Array<KimiChatMessage>;

// ============================================================================
// Supported Media Types
// ============================================================================

const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/*'];

const SUPPORTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/*'];

// ============================================================================
// Message Conversion
// ============================================================================

/**
 * Convert AI SDK prompt format to Kimi chat messages.
 *
 * @param prompt - The AI SDK prompt
 * @returns Kimi chat messages
 */
export function convertToKimiChatMessages(prompt: LanguageModelV3Prompt): KimiChatPrompt {
  const messages: KimiChatPrompt = [];

  for (const { role, content } of prompt) {
    switch (role) {
      case 'system': {
        messages.push({ role: 'system', content });
        break;
      }
      case 'user': {
        if (content.length === 1 && content[0].type === 'text') {
          messages.push({ role: 'user', content: content[0].text });
          break;
        }

        messages.push({
          role: 'user',
          content: content.map((part) => {
            switch (part.type) {
              case 'text':
                return { type: 'text' as const, text: part.text };
              case 'file': {
                // Handle image files
                if (isImageMediaType(part.mediaType)) {
                  return convertImagePart(part);
                }

                // Handle video files (Kimi K2.5 supports video)
                if (isVideoMediaType(part.mediaType)) {
                  return convertVideoPart(part);
                }

                // Handle text files
                if (part.mediaType.startsWith('text/')) {
                  const text =
                    part.data instanceof URL
                      ? part.data.toString()
                      : typeof part.data === 'string'
                        ? part.data
                        : new TextDecoder().decode(part.data);

                  return { type: 'text' as const, text };
                }

                throw new UnsupportedFunctionalityError({
                  functionality: `file part media type ${part.mediaType}`
                });
              }
              default: {
                const _exhaustiveCheck: never = part;
                throw new Error(`Unsupported part type: ${_exhaustiveCheck}`);
              }
            }
          })
        });
        break;
      }
      case 'assistant': {
        let text = '';
        let reasoning = '';
        const toolCalls: Array<{
          id: string;
          type: 'function';
          function: { name: string; arguments: string };
        }> = [];

        for (const part of content) {
          switch (part.type) {
            case 'text': {
              text += part.text;
              break;
            }
            case 'reasoning': {
              reasoning += part.text;
              break;
            }
            case 'tool-call': {
              toolCalls.push({
                id: part.toolCallId,
                type: 'function',
                function: {
                  name: part.toolName,
                  arguments: JSON.stringify(part.input)
                }
              });
              break;
            }
            case 'file': {
              // Assistant file parts are not directly supported by Kimi API
              // We could convert images to text descriptions, but for now skip
              break;
            }
            case 'tool-result': {
              // Tool results in assistant messages are unusual but handle gracefully
              // These would typically be in a 'tool' role message
              break;
            }
            default: {
              const _exhaustiveCheck: never = part;
              throw new Error(`Unsupported assistant part: ${_exhaustiveCheck}`);
            }
          }
        }

        messages.push({
          role: 'assistant',
          content: text.length > 0 ? text : null,
          ...(reasoning.length > 0 ? { reasoning_content: reasoning } : {}),
          ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {})
        });
        break;
      }
      case 'tool': {
        for (const toolResponse of content) {
          if (toolResponse.type === 'tool-approval-response') {
            continue;
          }

          messages.push({
            role: 'tool',
            tool_call_id: toolResponse.toolCallId,
            content: serializeToolResult(toolResponse)
          });
        }
        break;
      }
      default: {
        const _exhaustiveCheck: never = role;
        throw new Error(`Unsupported role: ${_exhaustiveCheck}`);
      }
    }
  }

  return messages;
}

// ============================================================================
// Helper Functions
// ============================================================================

function isImageMediaType(mediaType: string): boolean {
  return mediaType.startsWith('image/') || SUPPORTED_IMAGE_TYPES.includes(mediaType);
}

function isVideoMediaType(mediaType: string): boolean {
  return mediaType.startsWith('video/') || SUPPORTED_VIDEO_TYPES.includes(mediaType);
}

function convertImagePart(part: { mediaType: string; data: URL | Uint8Array | string }): {
  type: 'image_url';
  image_url: { url: string };
} {
  const mediaType = part.mediaType === 'image/*' ? 'image/jpeg' : part.mediaType;

  const url =
    part.data instanceof URL ? part.data.toString() : `data:${mediaType};base64,${convertToBase64(part.data)}`;

  return { type: 'image_url', image_url: { url } };
}

function convertVideoPart(part: { mediaType: string; data: URL | Uint8Array | string }): {
  type: 'video_url';
  video_url: { url: string };
} {
  // Video must be provided as a URL - base64 inline video is not practical
  if (!(part.data instanceof URL)) {
    throw new UnsupportedFunctionalityError({
      functionality: 'inline video data (video must be provided as a URL)'
    });
  }

  return { type: 'video_url', video_url: { url: part.data.toString() } };
}

function serializeToolResult(toolResponse: LanguageModelV3ToolResultPart): string {
  const { toolName } = toolResponse;
  const output = toolResponse.output;

  // For built-in tools like $web_search, just pass through the arguments
  // The Kimi API expects the tool result to be the same as what was passed
  if (isBuiltinToolName(toolName)) {
    return serializeBuiltinToolResult(output);
  }

  // Standard tool result serialization
  switch (output.type) {
    case 'text':
    case 'error-text':
      return output.value;
    case 'execution-denied':
      return output.reason ?? 'Tool execution denied.';
    case 'json':
    case 'error-json':
    case 'content':
      return JSON.stringify(output.value);
    default: {
      const _exhaustiveCheck: never = output;
      return JSON.stringify(_exhaustiveCheck);
    }
  }
}

function serializeBuiltinToolResult(output: LanguageModelV3ToolResultPart['output']): string {
  // For built-in tools, we need to pass through the result as-is
  // The model expects the arguments it passed to be echoed back
  switch (output.type) {
    case 'text':
    case 'error-text':
      return output.value;
    case 'json':
    case 'error-json':
    case 'content':
      return JSON.stringify(output.value);
    case 'execution-denied':
      return output.reason ?? 'Tool execution denied.';
    default: {
      const _exhaustiveCheck: never = output;
      return JSON.stringify(_exhaustiveCheck);
    }
  }
}

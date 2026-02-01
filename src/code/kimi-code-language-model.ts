/**
 * Kimi Code language model implementation.
 * @module
 */

import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3Content,
  LanguageModelV3FinishReason,
  LanguageModelV3FunctionTool,
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamPart,
  LanguageModelV3StreamResult,
  SharedV3ProviderMetadata,
  SharedV3Warning
} from '@ai-sdk/provider';
import {
  type ParseResult,
  combineHeaders,
  createEventSourceResponseHandler,
  createJsonErrorResponseHandler,
  createJsonResponseHandler,
  generateId,
  parseProviderOptions,
  postJsonToApi,
  removeUndefinedEntries
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import { convertToKimiCodePrompt } from './kimi-code-messages';
import {
  type KimiCodeSettings,
  effortToBudgetTokens,
  kimiCodeProviderOptionsSchema,
  normalizeExtendedThinkingConfig
} from './kimi-code-settings';
import {
  type KimiCodeCapabilities,
  type KimiCodeConfig,
  type KimiCodeModelId,
  inferKimiCodeCapabilities
} from './kimi-code-types';

// ============================================================================
// Response Schemas
// ============================================================================

const kimiCodeErrorSchema = z.union([
  z.object({
    error: z.object({
      message: z.string(),
      type: z.string().nullish(),
      code: z.union([z.string(), z.number()]).nullish()
    })
  }),
  z.object({
    message: z.string()
  })
]);

type KimiCodeErrorData = z.infer<typeof kimiCodeErrorSchema>;

const kimiCodeTextContentSchema = z.object({
  type: z.literal('text'),
  text: z.string()
});

const kimiCodeThinkingContentSchema = z.object({
  type: z.literal('thinking'),
  thinking: z.string()
});

const kimiCodeToolUseContentSchema = z.object({
  type: z.literal('tool_use'),
  id: z.string(),
  name: z.string(),
  input: z.record(z.string(), z.unknown())
});

const kimiCodeContentBlockSchema = z.union([
  kimiCodeTextContentSchema,
  kimiCodeThinkingContentSchema,
  kimiCodeToolUseContentSchema
]);

const kimiCodeResponseSchema = z.object({
  id: z.string().optional(),
  type: z.string().optional(),
  model: z.string().optional(),
  stop_reason: z.string().nullish(),
  stop_sequence: z.string().nullish(),
  content: z.array(kimiCodeContentBlockSchema),
  usage: z
    .object({
      input_tokens: z.number().optional(),
      output_tokens: z.number().optional(),
      cache_read_input_tokens: z.number().optional(),
      cache_creation_input_tokens: z.number().optional()
    })
    .optional()
});

const kimiCodeStreamChunkSchema = z.object({
  type: z.string(),
  index: z.number().optional(),
  message: z
    .object({
      id: z.string().optional(),
      type: z.string().optional(),
      model: z.string().optional(),
      content: z.array(z.unknown()).optional(),
      stop_reason: z.string().nullish(),
      stop_sequence: z.string().nullish(),
      usage: z
        .object({
          input_tokens: z.number().optional(),
          output_tokens: z.number().optional()
        })
        .optional()
    })
    .optional(),
  content_block: z
    .object({
      type: z.string(),
      text: z.string().optional(),
      thinking: z.string().optional(),
      id: z.string().optional(),
      name: z.string().optional(),
      input: z.record(z.string(), z.unknown()).optional()
    })
    .optional(),
  delta: z
    .object({
      type: z.string().optional(),
      text: z.string().optional(),
      thinking: z.string().optional(),
      partial_json: z.string().optional(),
      stop_reason: z.string().optional(),
      stop_sequence: z.string().optional()
    })
    .optional(),
  usage: z
    .object({
      input_tokens: z.number().optional(),
      output_tokens: z.number().optional()
    })
    .optional()
});

type KimiCodeResponse = z.infer<typeof kimiCodeResponseSchema>;
type KimiCodeStreamChunk = z.infer<typeof kimiCodeStreamChunkSchema>;

// ============================================================================
// Error Handler
// ============================================================================

const kimiCodeFailedResponseHandler = createJsonErrorResponseHandler({
  errorSchema: kimiCodeErrorSchema,
  errorToMessage: (error: KimiCodeErrorData) => {
    if ('error' in error) {
      return error.error.message;
    }
    return error.message;
  },
  isRetryable: (response) =>
    response.status === 408 || response.status === 409 || response.status === 429 || response.status >= 500
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map Kimi Code stop reason to AI SDK finish reason.
 */
function mapStopReason(stopReason: string | null | undefined): LanguageModelV3FinishReason {
  switch (stopReason) {
    case 'end_turn':
    case 'stop_sequence':
      return { unified: 'stop', raw: stopReason };
    case 'tool_use':
      return { unified: 'tool-calls', raw: stopReason };
    case 'max_tokens':
      return { unified: 'length', raw: stopReason };
    default:
      return { unified: 'other', raw: stopReason ?? undefined };
  }
}

/**
 * Convert Kimi Code usage to AI SDK usage format.
 */
function convertUsage(usage?: {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}) {
  const inputTokens = usage?.input_tokens ?? 0;
  const outputTokens = usage?.output_tokens ?? 0;
  const cacheRead = usage?.cache_read_input_tokens ?? 0;

  return {
    inputTokens: {
      total: inputTokens,
      cacheRead,
      cacheWrite: usage?.cache_creation_input_tokens,
      noCache: inputTokens - cacheRead
    },
    outputTokens: {
      total: outputTokens,
      text: outputTokens,
      reasoning: 0
    },
    raw: usage
  };
}

/**
 * Convert tools to Kimi Code (Anthropic) format.
 */
function convertTools(tools?: LanguageModelV3FunctionTool[]) {
  if (!tools || tools.length === 0) {
    return undefined;
  }

  return tools.map((tool) => {
    return {
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema ?? { type: 'object', properties: {} }
    };
  });
}

// ============================================================================
// Language Model Implementation
// ============================================================================

/**
 * Kimi Code language model implementing LanguageModelV3.
 */
export class KimiCodeLanguageModel implements LanguageModelV3 {
  readonly specificationVersion = 'v3';
  readonly modelId: KimiCodeModelId;

  private readonly config: KimiCodeConfig;
  private readonly settings: KimiCodeSettings;
  private readonly generateIdFn: () => string;

  constructor(modelId: KimiCodeModelId, settings: KimiCodeSettings, config: KimiCodeConfig) {
    this.modelId = modelId;
    this.settings = settings;
    this.config = config;
    this.generateIdFn = config.generateId ?? generateId;
  }

  get provider(): string {
    return this.config.provider;
  }

  private get providerOptionsName(): string {
    return 'kimiCode';
  }

  /**
   * Get the inferred or configured capabilities for this model.
   */
  get capabilities(): KimiCodeCapabilities {
    const inferred = inferKimiCodeCapabilities(this.modelId);
    return {
      ...inferred,
      ...this.settings.capabilities
    };
  }

  get supportedUrls() {
    const patterns: Record<string, RegExp[]> = {
      'image/*': [/^https?:\/\/.*$/i]
    };
    return this.settings.supportedUrls ?? this.config.supportedUrls ?? patterns;
  }

  /**
   * Build request arguments.
   */
  private async getArgs(options: LanguageModelV3CallOptions) {
    const { prompt, maxOutputTokens, temperature, topP, topK, stopSequences, tools, toolChoice, providerOptions } =
      options;

    const warnings: SharedV3Warning[] = [];

    // Parse provider options
    const kimiCodeOptions = await parseProviderOptions({
      provider: this.providerOptionsName,
      providerOptions,
      schema: kimiCodeProviderOptionsSchema
    });

    // Merge extended thinking config from settings and provider options
    const extendedThinking =
      normalizeExtendedThinkingConfig(kimiCodeOptions?.extendedThinking) ??
      normalizeExtendedThinkingConfig(this.settings.extendedThinking);

    // Warn about unsupported options
    if (topK != null) {
      warnings.push({
        type: 'unsupported',
        feature: 'topK'
      });
    }

    // Convert prompt to Kimi Code format
    const { system, messages } = await convertToKimiCodePrompt(prompt);

    // Prepare tool choice
    let toolChoiceParam: { type: string; name?: string } | undefined;
    if (toolChoice != null) {
      switch (toolChoice.type) {
        case 'auto':
          toolChoiceParam = { type: 'auto' };
          break;
        case 'none':
          toolChoiceParam = { type: 'none' };
          break;
        case 'required':
          toolChoiceParam = { type: 'any' };
          break;
        case 'tool':
          toolChoiceParam = { type: 'tool', name: toolChoice.toolName };
          break;
      }
    }

    // Filter to only function tools
    const functionTools = tools?.filter((t): t is LanguageModelV3FunctionTool => t.type === 'function');

    // Build request body
    const body = removeUndefinedEntries({
      model: this.modelId,
      system: kimiCodeOptions?.system ?? system,
      messages,
      max_tokens: maxOutputTokens ?? this.capabilities.maxOutputTokens ?? 32768,
      temperature,
      top_p: topP,
      stop_sequences: kimiCodeOptions?.stopSequences ?? stopSequences,
      tools: convertTools(functionTools),
      tool_choice: toolChoiceParam,
      // Extended thinking parameters
      ...(extendedThinking?.enabled && {
        thinking: {
          type: 'enabled',
          budget_tokens: extendedThinking.budgetTokens ?? effortToBudgetTokens(extendedThinking.effort ?? 'medium')
        }
      })
    });

    const requestHeaders: Record<string, string | undefined> = {
      ...(options.headers ?? {})
    };

    return {
      body,
      warnings,
      requestHeaders
    };
  }

  async doGenerate(options: LanguageModelV3CallOptions): Promise<LanguageModelV3GenerateResult> {
    const { body, warnings, requestHeaders } = await this.getArgs(options);

    const {
      responseHeaders,
      value: rawResponse,
      rawValue
    } = await postJsonToApi({
      url: `${this.config.baseURL}/messages`,
      headers: combineHeaders(this.config.headers(), requestHeaders, options.headers),
      body,
      failedResponseHandler: kimiCodeFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(kimiCodeResponseSchema),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch
    });

    // Parse and validate response
    const response = rawResponse as KimiCodeResponse;

    // Extract content from response
    const content: Array<LanguageModelV3Content> = [];

    for (const block of response.content) {
      switch (block.type) {
        case 'text':
          content.push({ type: 'text', text: block.text });
          break;

        case 'thinking':
          content.push({
            type: 'reasoning',
            text: block.thinking
          });
          break;

        case 'tool_use':
          content.push({
            type: 'tool-call',
            toolCallId: block.id,
            toolName: block.name,
            input: JSON.stringify(block.input)
          });
          break;
      }
    }

    const providerMetadata: SharedV3ProviderMetadata = {
      [this.providerOptionsName]: {
        requestId: responseHeaders?.['x-request-id'] ?? undefined,
        modelId: response.model,
        stopReason: response.stop_reason,
        stopSequence: response.stop_sequence
      }
    };

    return {
      content,
      finishReason: mapStopReason(response.stop_reason),
      usage: convertUsage(response.usage),
      providerMetadata,
      request: { body },
      response: {
        id: response.id,
        modelId: response.model,
        headers: responseHeaders,
        body: rawValue
      },
      warnings
    };
  }

  async doStream(options: LanguageModelV3CallOptions): Promise<LanguageModelV3StreamResult> {
    const { body, warnings, requestHeaders } = await this.getArgs(options);

    const streamBody = {
      ...body,
      stream: true
    };

    const { responseHeaders, value: response } = await postJsonToApi({
      url: `${this.config.baseURL}/messages`,
      headers: combineHeaders(this.config.headers(), requestHeaders, options.headers),
      body: streamBody,
      failedResponseHandler: kimiCodeFailedResponseHandler,
      successfulResponseHandler: createEventSourceResponseHandler(kimiCodeStreamChunkSchema),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch
    });

    const providerOptionsName = this.providerOptionsName;
    const generateIdFn = this.generateIdFn;
    const capturedResponseHeaders = responseHeaders;

    // Track state across stream
    let currentBlockType: string | undefined;
    let currentToolCallId: string | undefined;
    let currentToolName: string | undefined;
    let accumulatedToolInput = '';
    let finishReason: LanguageModelV3FinishReason = { unified: 'other', raw: undefined };
    let usage: ReturnType<typeof convertUsage> | undefined;
    let responseId: string | undefined;
    let responseModel: string | undefined;
    let isActiveText = false;
    let isActiveReasoning = false;
    let hasToolCallFinished = false;

    return {
      stream: response.pipeThrough(
        new TransformStream<ParseResult<KimiCodeStreamChunk>, LanguageModelV3StreamPart>({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings });
          },

          transform(chunk, controller) {
            if (!chunk.success) {
              controller.enqueue({ type: 'error', error: chunk.error });
              return;
            }

            const data = chunk.value;

            switch (data.type) {
              case 'message_start':
                if (data.message) {
                  responseId = data.message.id;
                  responseModel = data.message.model;
                  if (data.message.usage) {
                    usage = convertUsage(data.message.usage);
                  }
                  // Emit response metadata
                  controller.enqueue({
                    type: 'response-metadata',
                    id: responseId,
                    modelId: responseModel
                  });
                }
                break;

              case 'content_block_start':
                if (data.content_block) {
                  currentBlockType = data.content_block.type;
                  if (data.content_block.type === 'tool_use') {
                    currentToolCallId = data.content_block.id ?? generateIdFn();
                    currentToolName = data.content_block.name;
                    accumulatedToolInput = '';
                    hasToolCallFinished = false;

                    // Close any active text/reasoning blocks
                    if (isActiveText) {
                      controller.enqueue({ type: 'text-end', id: 'text-0' });
                      isActiveText = false;
                    }
                    if (isActiveReasoning) {
                      controller.enqueue({ type: 'reasoning-end', id: 'reasoning-0' });
                      isActiveReasoning = false;
                    }

                    controller.enqueue({
                      type: 'tool-input-start',
                      id: currentToolCallId,
                      toolName: currentToolName ?? ''
                    });
                  } else if (data.content_block.type === 'text') {
                    if (!isActiveText) {
                      if (isActiveReasoning) {
                        controller.enqueue({ type: 'reasoning-end', id: 'reasoning-0' });
                        isActiveReasoning = false;
                      }
                      controller.enqueue({ type: 'text-start', id: 'text-0' });
                      isActiveText = true;
                    }
                  } else if (data.content_block.type === 'thinking') {
                    if (!isActiveReasoning) {
                      if (isActiveText) {
                        controller.enqueue({ type: 'text-end', id: 'text-0' });
                        isActiveText = false;
                      }
                      controller.enqueue({ type: 'reasoning-start', id: 'reasoning-0' });
                      isActiveReasoning = true;
                    }
                  }
                }
                break;

              case 'content_block_delta':
                if (data.delta) {
                  if (data.delta.type === 'text_delta' && data.delta.text) {
                    if (!isActiveText) {
                      if (isActiveReasoning) {
                        controller.enqueue({ type: 'reasoning-end', id: 'reasoning-0' });
                        isActiveReasoning = false;
                      }
                      controller.enqueue({ type: 'text-start', id: 'text-0' });
                      isActiveText = true;
                    }
                    controller.enqueue({
                      type: 'text-delta',
                      id: 'text-0',
                      delta: data.delta.text
                    });
                  } else if (data.delta.type === 'thinking_delta' && data.delta.thinking) {
                    if (!isActiveReasoning) {
                      if (isActiveText) {
                        controller.enqueue({ type: 'text-end', id: 'text-0' });
                        isActiveText = false;
                      }
                      controller.enqueue({ type: 'reasoning-start', id: 'reasoning-0' });
                      isActiveReasoning = true;
                    }
                    controller.enqueue({
                      type: 'reasoning-delta',
                      id: 'reasoning-0',
                      delta: data.delta.thinking
                    });
                  } else if (data.delta.type === 'input_json_delta' && data.delta.partial_json) {
                    accumulatedToolInput += data.delta.partial_json;
                    controller.enqueue({
                      type: 'tool-input-delta',
                      id: currentToolCallId ?? '',
                      delta: data.delta.partial_json
                    });
                  }
                }
                break;

              case 'content_block_stop':
                if (currentBlockType === 'tool_use' && currentToolCallId && !hasToolCallFinished) {
                  // Parse accumulated input
                  controller.enqueue({ type: 'tool-input-end', id: currentToolCallId });

                  controller.enqueue({
                    type: 'tool-call',
                    toolCallId: currentToolCallId,
                    toolName: currentToolName ?? '',
                    input: accumulatedToolInput
                  });
                  hasToolCallFinished = true;
                } else if (currentBlockType === 'text' && isActiveText) {
                  controller.enqueue({ type: 'text-end', id: 'text-0' });
                  isActiveText = false;
                } else if (currentBlockType === 'thinking' && isActiveReasoning) {
                  controller.enqueue({ type: 'reasoning-end', id: 'reasoning-0' });
                  isActiveReasoning = false;
                }
                currentBlockType = undefined;
                currentToolCallId = undefined;
                currentToolName = undefined;
                accumulatedToolInput = '';
                break;

              case 'message_delta':
                if (data.delta?.stop_reason) {
                  finishReason = mapStopReason(data.delta.stop_reason);
                }
                if (data.usage) {
                  usage = convertUsage(data.usage);
                }
                break;

              case 'message_stop':
                // Close any remaining active blocks
                if (isActiveText) {
                  controller.enqueue({ type: 'text-end', id: 'text-0' });
                }
                if (isActiveReasoning) {
                  controller.enqueue({ type: 'reasoning-end', id: 'reasoning-0' });
                }

                controller.enqueue({
                  type: 'finish',
                  finishReason,
                  usage: usage ?? convertUsage({}),
                  providerMetadata: {
                    [providerOptionsName]: {
                      requestId: capturedResponseHeaders?.['x-request-id'] ?? undefined,
                      modelId: responseModel
                    }
                  }
                });
                break;

              case 'error':
                controller.enqueue({
                  type: 'error',
                  error: new Error(
                    (data as unknown as { error?: { message?: string } }).error?.message ?? 'Unknown streaming error'
                  )
                });
                break;
            }
          }
        })
      ),
      request: { body: streamBody },
      response: {
        headers: responseHeaders
      }
    };
  }
}

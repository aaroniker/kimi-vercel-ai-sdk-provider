/**
 * Kimi chat language model implementation.
 * @module
 */

import {
  InvalidResponseDataError,
  type JSONValue,
  type LanguageModelV3,
  type LanguageModelV3CallOptions,
  type LanguageModelV3Content,
  type LanguageModelV3FinishReason,
  type LanguageModelV3GenerateResult,
  type LanguageModelV3StreamPart,
  type LanguageModelV3StreamResult,
  type SharedV3ProviderMetadata,
  type SharedV3Warning
} from '@ai-sdk/provider';
import {
  type ParseResult,
  combineHeaders,
  createEventSourceResponseHandler,
  createJsonResponseHandler,
  generateId,
  isParsableJson,
  parseProviderOptions,
  postJsonToApi,
  removeUndefinedEntries
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import { kimiErrorSchema, kimiFailedResponseHandler } from '../core';
import { type KimiCodeInterpreterToolOptions, type KimiWebSearchToolOptions, prepareKimiTools } from '../tools';
import { convertToKimiChatMessages } from './kimi-chat-messages';
import {
  convertKimiUsage,
  extractCodeInterpreterTokens,
  extractMessageContent,
  extractWebSearchTokens,
  getKimiRequestId,
  getResponseMetadata,
  mapKimiFinishReason
} from './kimi-chat-response';
import {
  type KimiCachingConfig,
  type KimiChatConfig,
  type KimiChatModelId,
  type KimiChatSettings,
  type KimiProviderOptions,
  inferModelCapabilities,
  kimiProviderOptionsSchema
} from './kimi-chat-settings';

// ============================================================================
// Language Model Implementation
// ============================================================================

/**
 * Kimi chat language model implementing LanguageModelV3.
 */
export class KimiChatLanguageModel implements LanguageModelV3 {
  readonly specificationVersion = 'v3';
  readonly modelId: KimiChatModelId;

  private readonly config: KimiChatConfig;
  private readonly settings: KimiChatSettings;
  private readonly generateIdFn: () => string;
  private readonly supportsStructuredOutputs: boolean;

  constructor(modelId: KimiChatModelId, settings: KimiChatSettings, config: KimiChatConfig) {
    this.modelId = modelId;
    this.settings = settings;
    this.config = config;
    this.generateIdFn = config.generateId ?? generateId;
    this.supportsStructuredOutputs = config.supportsStructuredOutputs ?? false;
  }

  get provider(): string {
    return this.config.provider;
  }

  private get providerOptionsName(): string {
    return this.config.provider.split('.')[0].trim();
  }

  /**
   * Get the inferred or configured capabilities for this model.
   */
  get capabilities() {
    const inferred = inferModelCapabilities(this.modelId);
    return {
      ...inferred,
      ...this.settings.capabilities
    };
  }

  get supportedUrls() {
    const caps = this.capabilities;
    const patterns: Record<string, RegExp[]> = {
      'image/*': [/^https?:\/\/.*$/i]
    };

    // Add video support for models that support it
    if (caps.videoInput) {
      patterns['video/*'] = [/^https?:\/\/.*$/i];
    }

    return this.settings.supportedUrls ?? this.config.supportedUrls ?? patterns;
  }

  private async getArgs({
    prompt,
    maxOutputTokens,
    temperature,
    topP,
    topK,
    frequencyPenalty,
    presencePenalty,
    stopSequences,
    responseFormat,
    seed,
    providerOptions,
    tools,
    toolChoice
  }: LanguageModelV3CallOptions) {
    const warnings: SharedV3Warning[] = [];

    const deprecatedOptions = await parseProviderOptions({
      provider: 'moonshot',
      providerOptions,
      schema: kimiProviderOptionsSchema
    });

    if (deprecatedOptions != null) {
      warnings.push({
        type: 'other',
        message: "The 'moonshot' key in providerOptions is deprecated. Use 'kimi' instead."
      });
    }

    const providerOptionsName = this.providerOptionsName;
    const kimiOptions = await parseProviderOptions({
      provider: providerOptionsName,
      providerOptions,
      schema: kimiProviderOptionsSchema
    });

    const options: KimiProviderOptions = {
      ...(deprecatedOptions ?? {}),
      ...(kimiOptions ?? {})
    };

    if (topK != null) {
      warnings.push({ type: 'unsupported', feature: 'topK' });
    }

    const strictJsonSchema = options.strictJsonSchema ?? true;

    if (responseFormat?.type === 'json' && responseFormat.schema != null && !this.supportsStructuredOutputs) {
      warnings.push({
        type: 'unsupported',
        feature: 'responseFormat',
        details: 'JSON schema response format requires structured outputs support.'
      });
    }

    // Resolve web search configuration from settings and provider options
    const webSearch = resolveBuiltinToolConfig(this.settings.webSearch, options.webSearch);

    // Resolve code interpreter configuration from settings and provider options
    const codeInterpreter = resolveBuiltinToolConfig(this.settings.codeInterpreter, options.codeInterpreter);

    // Resolve tool choice polyfill setting
    const toolChoicePolyfill = options.toolChoicePolyfill ?? this.settings.toolChoicePolyfill ?? true;

    const {
      tools: kimiTools,
      toolChoice: kimiToolChoice,
      toolWarnings,
      toolChoiceSystemMessage
    } = prepareKimiTools({
      tools,
      toolChoice,
      webSearch,
      codeInterpreter,
      toolChoicePolyfill
    });

    // Resolve caching configuration
    const caching = resolveCachingConfig(this.settings.caching, options.caching);

    // Build caching headers
    const cachingHeaders = buildCachingHeaders(caching);

    const passthroughOptions = getPassthroughOptions({
      providerOptions,
      providerOptionsName,
      deprecatedProviderOptionsName: 'moonshot',
      knownKeys: Object.keys(kimiProviderOptionsSchema.shape)
    });

    // Convert messages and optionally inject tool choice system message
    const messages = convertToKimiChatMessages(prompt);
    if (toolChoiceSystemMessage) {
      // Prepend the tool choice instruction as a system message
      messages.unshift({ role: 'system', content: toolChoiceSystemMessage });
    }

    const body = removeUndefinedEntries({
      model: this.modelId,
      messages,
      max_tokens: maxOutputTokens,
      temperature,
      top_p: topP,
      frequency_penalty: frequencyPenalty,
      presence_penalty: presencePenalty,
      stop: stopSequences,
      seed,
      response_format:
        responseFormat?.type === 'json'
          ? this.supportsStructuredOutputs && responseFormat.schema != null
            ? {
                type: 'json_schema',
                json_schema: {
                  schema: responseFormat.schema,
                  strict: strictJsonSchema,
                  name: responseFormat.name ?? 'response',
                  description: responseFormat.description
                }
              }
            : { type: 'json_object' }
          : undefined,
      tools: kimiTools,
      tool_choice: kimiToolChoice,
      user: options.user,
      ...(kimiTools != null && options.parallelToolCalls != null
        ? { parallel_tool_calls: options.parallelToolCalls }
        : {}),
      ...passthroughOptions
    });

    const requestHeaders: Record<string, string | undefined> = {
      ...(options.requestId ? { 'X-Request-ID': options.requestId } : {}),
      ...(options.extraHeaders ?? {}),
      ...cachingHeaders
    };

    return {
      body,
      warnings: [...warnings, ...toolWarnings],
      requestHeaders
    };
  }

  async doGenerate(options: LanguageModelV3CallOptions): Promise<LanguageModelV3GenerateResult> {
    const { body, warnings, requestHeaders } = await this.getArgs(options);

    const {
      responseHeaders,
      value: response,
      rawValue
    } = await postJsonToApi({
      url: `${this.config.baseURL}/chat/completions`,
      headers: combineHeaders(this.config.headers(), requestHeaders, options.headers),
      body,
      failedResponseHandler: kimiFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(kimiChatResponseSchema),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch
    });

    const choice = response.choices[0];
    const content: Array<LanguageModelV3Content> = [];

    const { text, reasoning } = extractMessageContent(choice.message);

    if (reasoning.length > 0) {
      content.push({ type: 'reasoning', text: reasoning });
    }

    if (text.length > 0) {
      content.push({ type: 'text', text });
    }

    if (choice.message.tool_calls != null) {
      for (const toolCall of choice.message.tool_calls) {
        content.push({
          type: 'tool-call',
          toolCallId: toolCall.id ?? this.generateIdFn(),
          toolName: toolCall.function.name,
          input: toolCall.function.arguments ?? ''
        });
      }
    }

    // Extract built-in tool token usage from tool calls
    const webSearchTokens = extractWebSearchTokens(choice.message.tool_calls);
    const codeInterpreterTokens = extractCodeInterpreterTokens(choice.message.tool_calls);

    const providerMetadata = buildProviderMetadata({
      providerOptionsName: this.providerOptionsName,
      responseHeaders,
      webSearchTokens,
      codeInterpreterTokens
    });

    return {
      content,
      finishReason: {
        unified: mapKimiFinishReason(choice.finish_reason),
        raw: choice.finish_reason ?? undefined
      },
      usage: convertKimiUsage(response.usage, webSearchTokens, codeInterpreterTokens),
      ...(providerMetadata ? { providerMetadata } : {}),
      request: { body },
      response: {
        ...getResponseMetadata(response),
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
      stream: true,
      stream_options: this.config.includeUsageInStream ? { include_usage: true } : undefined
    };

    const { responseHeaders, value: response } = await postJsonToApi({
      url: `${this.config.baseURL}/chat/completions`,
      headers: combineHeaders(this.config.headers(), requestHeaders, options.headers),
      body: streamBody,
      failedResponseHandler: kimiFailedResponseHandler,
      successfulResponseHandler: createEventSourceResponseHandler(kimiChatChunkSchema),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch
    });

    const requestId = getKimiRequestId(responseHeaders);

    let finishReason: LanguageModelV3FinishReason = {
      unified: 'other',
      raw: undefined
    };
    let usage: z.infer<typeof kimiTokenUsageSchema> | undefined;

    let isFirstChunk = true;
    let isActiveText = false;
    let isActiveReasoning = false;

    const toolCalls: Array<{
      id: string;
      type: 'function';
      function: { name: string; arguments: string };
      hasFinished: boolean;
    }> = [];

    const providerOptionsName = this.providerOptionsName;
    const _generateIdFn = this.generateIdFn;

    return {
      stream: response.pipeThrough(
        new TransformStream<ParseResult<z.infer<typeof kimiChatChunkSchema>>, LanguageModelV3StreamPart>({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings });
          },

          transform(chunk, controller) {
            if (options.includeRawChunks) {
              controller.enqueue({ type: 'raw', rawValue: chunk.rawValue });
            }

            if (!chunk.success) {
              finishReason = { unified: 'error', raw: undefined };
              controller.enqueue({ type: 'error', error: chunk.error });
              return;
            }

            if ('error' in chunk.value) {
              finishReason = { unified: 'error', raw: undefined };
              const error = (chunk.value as { error?: { message?: string } }).error;
              controller.enqueue({
                type: 'error',
                error: error?.message ?? chunk.value
              });
              return;
            }

            const value = chunk.value as z.infer<typeof kimiChatChunkBaseSchema>;

            if (isFirstChunk) {
              isFirstChunk = false;
              controller.enqueue({
                type: 'response-metadata',
                ...getResponseMetadata(value)
              });
            }

            if (value.usage != null) {
              usage = value.usage;
            }

            const choice = value.choices[0];
            if (!choice) {
              return;
            }

            if (choice.finish_reason != null) {
              finishReason = {
                unified: mapKimiFinishReason(choice.finish_reason),
                raw: choice.finish_reason ?? undefined
              };
            }

            const delta = choice.delta;
            if (!delta) {
              return;
            }

            const reasoningDelta = delta.reasoning_content ?? delta.reasoning;
            if (reasoningDelta) {
              if (!isActiveReasoning) {
                if (isActiveText) {
                  controller.enqueue({ type: 'text-end', id: 'text-0' });
                  isActiveText = false;
                }
                controller.enqueue({
                  type: 'reasoning-start',
                  id: 'reasoning-0'
                });
                isActiveReasoning = true;
              }

              controller.enqueue({
                type: 'reasoning-delta',
                id: 'reasoning-0',
                delta: reasoningDelta
              });
            }

            if (delta.content) {
              if (isActiveReasoning) {
                controller.enqueue({ type: 'reasoning-end', id: 'reasoning-0' });
                isActiveReasoning = false;
              }

              if (!isActiveText) {
                controller.enqueue({ type: 'text-start', id: 'text-0' });
                isActiveText = true;
              }

              controller.enqueue({
                type: 'text-delta',
                id: 'text-0',
                delta: delta.content
              });
            }

            if (delta.tool_calls != null) {
              if (isActiveReasoning) {
                controller.enqueue({ type: 'reasoning-end', id: 'reasoning-0' });
                isActiveReasoning = false;
              }

              for (const toolCallDelta of delta.tool_calls) {
                const index = toolCallDelta.index ?? toolCalls.length;

                if (toolCalls[index] == null) {
                  if (toolCallDelta.id == null) {
                    throw new InvalidResponseDataError({
                      data: toolCallDelta,
                      message: "Expected 'id' to be a string."
                    });
                  }

                  if (toolCallDelta.function?.name == null) {
                    throw new InvalidResponseDataError({
                      data: toolCallDelta,
                      message: "Expected 'function.name' to be a string."
                    });
                  }

                  controller.enqueue({
                    type: 'tool-input-start',
                    id: toolCallDelta.id,
                    toolName: toolCallDelta.function.name
                  });

                  toolCalls[index] = {
                    id: toolCallDelta.id,
                    type: 'function',
                    function: {
                      name: toolCallDelta.function.name,
                      arguments: toolCallDelta.function.arguments ?? ''
                    },
                    hasFinished: false
                  };

                  const toolCall = toolCalls[index];

                  if (toolCall.function.arguments.length > 0) {
                    controller.enqueue({
                      type: 'tool-input-delta',
                      id: toolCall.id,
                      delta: toolCall.function.arguments
                    });
                  }

                  if (isParsableJson(toolCall.function.arguments)) {
                    controller.enqueue({ type: 'tool-input-end', id: toolCall.id });

                    controller.enqueue({
                      type: 'tool-call',
                      toolCallId: toolCall.id,
                      toolName: toolCall.function.name,
                      input: toolCall.function.arguments
                    });

                    toolCall.hasFinished = true;
                  }

                  continue;
                }

                const toolCall = toolCalls[index];
                if (toolCall.hasFinished) {
                  continue;
                }

                if (toolCallDelta.function?.arguments != null) {
                  toolCall.function.arguments += toolCallDelta.function.arguments;
                }

                controller.enqueue({
                  type: 'tool-input-delta',
                  id: toolCall.id,
                  delta: toolCallDelta.function?.arguments ?? ''
                });

                if (isParsableJson(toolCall.function.arguments)) {
                  controller.enqueue({ type: 'tool-input-end', id: toolCall.id });

                  controller.enqueue({
                    type: 'tool-call',
                    toolCallId: toolCall.id,
                    toolName: toolCall.function.name,
                    input: toolCall.function.arguments
                  });

                  toolCall.hasFinished = true;
                }
              }
            }
          },

          flush(controller) {
            if (isActiveReasoning) {
              controller.enqueue({ type: 'reasoning-end', id: 'reasoning-0' });
              isActiveReasoning = false;
            }

            if (isActiveText) {
              controller.enqueue({ type: 'text-end', id: 'text-0' });
              isActiveText = false;
            }

            for (const toolCall of toolCalls.filter((call) => !call.hasFinished)) {
              controller.enqueue({ type: 'tool-input-end', id: toolCall.id });
              controller.enqueue({
                type: 'tool-call',
                toolCallId: toolCall.id,
                toolName: toolCall.function.name,
                input: toolCall.function.arguments
              });
            }

            // Extract built-in tool tokens from accumulated tool calls
            const webSearchTokens = extractWebSearchTokens(toolCalls);
            const codeInterpreterTokens = extractCodeInterpreterTokens(toolCalls);

            const providerMetadata: SharedV3ProviderMetadata | undefined =
              requestId || webSearchTokens != null || codeInterpreterTokens != null
                ? {
                    [providerOptionsName]: {
                      ...(requestId ? { requestId } : {}),
                      ...(webSearchTokens != null ? { webSearchTokens } : {}),
                      ...(codeInterpreterTokens != null ? { codeInterpreterTokens } : {})
                    }
                  }
                : undefined;

            controller.enqueue({
              type: 'finish',
              finishReason,
              usage: convertKimiUsage(usage, webSearchTokens, codeInterpreterTokens),
              ...(providerMetadata ? { providerMetadata } : {})
            });
          }
        })
      ),
      request: { body: streamBody },
      response: { headers: responseHeaders }
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function buildProviderMetadata({
  providerOptionsName,
  responseHeaders,
  webSearchTokens,
  codeInterpreterTokens
}: {
  providerOptionsName: string;
  responseHeaders?: Record<string, string>;
  webSearchTokens?: number;
  codeInterpreterTokens?: number;
}): SharedV3ProviderMetadata | undefined {
  const requestId = getKimiRequestId(responseHeaders);

  if (!requestId && webSearchTokens == null && codeInterpreterTokens == null) {
    return undefined;
  }

  return {
    [providerOptionsName]: {
      ...(requestId ? { requestId } : {}),
      ...(webSearchTokens != null ? { webSearchTokens } : {}),
      ...(codeInterpreterTokens != null ? { codeInterpreterTokens } : {})
    }
  };
}

function getPassthroughOptions({
  providerOptions,
  providerOptionsName,
  deprecatedProviderOptionsName,
  knownKeys
}: {
  providerOptions: LanguageModelV3CallOptions['providerOptions'];
  providerOptionsName: string;
  deprecatedProviderOptionsName: string;
  knownKeys: string[];
}) {
  const rawOptions = [providerOptions?.[deprecatedProviderOptionsName], providerOptions?.[providerOptionsName]].filter(
    (entry): entry is Record<string, JSONValue | undefined> => entry != null && typeof entry === 'object'
  );

  const passthrough: Record<string, JSONValue | undefined> = {};

  for (const options of rawOptions) {
    for (const [key, value] of Object.entries(options ?? {})) {
      if (!knownKeys.includes(key)) {
        passthrough[key] = value;
      }
    }
  }

  return passthrough;
}

type BuiltinToolOptions = boolean | KimiWebSearchToolOptions | KimiCodeInterpreterToolOptions | undefined;

function resolveBuiltinToolConfig<T extends BuiltinToolOptions>(
  settingsConfig: T | undefined,
  optionsConfig: T | undefined
): T | undefined {
  // Provider options take precedence
  if (optionsConfig != null) {
    if (typeof optionsConfig === 'boolean') {
      return optionsConfig ? ({ enabled: true } as T) : undefined;
    }
    const config = optionsConfig as { enabled: boolean };
    return config.enabled ? optionsConfig : undefined;
  }

  // Fall back to settings
  if (settingsConfig != null) {
    if (typeof settingsConfig === 'boolean') {
      return settingsConfig ? ({ enabled: true } as T) : undefined;
    }
    const config = settingsConfig as { enabled: boolean };
    return config.enabled ? settingsConfig : undefined;
  }

  return undefined;
}

type CachingOptions = boolean | KimiCachingConfig | undefined;

/**
 * Resolve caching configuration from settings and provider options.
 */
function resolveCachingConfig(
  settingsConfig: CachingOptions,
  optionsConfig: CachingOptions
): KimiCachingConfig | undefined {
  // Provider options take precedence
  const config = optionsConfig ?? settingsConfig;

  if (config == null) {
    return undefined;
  }

  if (typeof config === 'boolean') {
    return config ? { enabled: true } : undefined;
  }

  return config.enabled ? config : undefined;
}

/**
 * Build HTTP headers for context caching.
 * Kimi uses specific headers to control caching behavior.
 */
function buildCachingHeaders(caching: KimiCachingConfig | undefined): Record<string, string> {
  if (!caching?.enabled) {
    return {};
  }

  const headers: Record<string, string> = {
    'X-Kimi-Cache': 'enabled'
  };

  if (caching.cacheKey) {
    headers['X-Kimi-Cache-Key'] = caching.cacheKey;
  }

  if (caching.ttlSeconds) {
    headers['X-Kimi-Cache-TTL'] = String(caching.ttlSeconds);
  }

  if (caching.resetCache) {
    headers['X-Kimi-Cache-Reset'] = 'true';
  }

  return headers;
}

// ============================================================================
// Zod Schemas
// ============================================================================

const kimiTokenUsageSchema = z
  .object({
    prompt_tokens: z.number().nullish(),
    completion_tokens: z.number().nullish(),
    total_tokens: z.number().nullish(),
    prompt_tokens_details: z
      .object({
        cached_tokens: z.number().nullish()
      })
      .nullish(),
    completion_tokens_details: z
      .object({
        reasoning_tokens: z.number().nullish()
      })
      .nullish()
  })
  .nullish();

/**
 * Schema for content parts in response messages.
 * Can be text, image, or other content types.
 */
const kimiContentPartSchema = z.union([
  z.object({
    type: z.literal('text'),
    text: z.string()
  }),
  z.object({
    type: z.literal('image_url'),
    image_url: z.object({
      url: z.string()
    })
  }),
  z.looseObject({
    type: z.string()
  })
]);

const kimiChatResponseSchema = z.looseObject({
  id: z.string().nullish(),
  created: z.number().nullish(),
  model: z.string().nullish(),
  choices: z.array(
    z.object({
      message: z.object({
        role: z.string().nullish(),
        content: z.union([z.string(), z.array(kimiContentPartSchema)]).nullish(),
        reasoning_content: z.string().nullish(),
        reasoning: z.string().nullish(),
        tool_calls: z
          .array(
            z.object({
              id: z.string().nullish(),
              function: z.object({
                name: z.string(),
                arguments: z.string().nullish()
              })
            })
          )
          .nullish()
      }),
      finish_reason: z.string().nullish()
    })
  ),
  usage: kimiTokenUsageSchema
});

const kimiChatChunkBaseSchema = z.looseObject({
  id: z.string().nullish(),
  created: z.number().nullish(),
  model: z.string().nullish(),
  choices: z.array(
    z.object({
      delta: z
        .object({
          role: z.enum(['assistant']).nullish(),
          content: z.string().nullish(),
          reasoning_content: z.string().nullish(),
          reasoning: z.string().nullish(),
          tool_calls: z
            .array(
              z.object({
                index: z.number().nullish(),
                id: z.string().nullish(),
                function: z.object({
                  name: z.string().nullish(),
                  arguments: z.string().nullish()
                })
              })
            )
            .nullish()
        })
        .nullish(),
      finish_reason: z.string().nullish()
    })
  ),
  usage: kimiTokenUsageSchema
});

const kimiChatChunkSchema = z.union([kimiChatChunkBaseSchema, kimiErrorSchema]);

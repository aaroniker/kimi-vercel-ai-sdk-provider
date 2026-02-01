/**
 * Kimi provider factory.
 * @module
 */

import { type LanguageModelV3, NoSuchModelError, type ProviderV3 } from '@ai-sdk/provider';
import {
  type FetchFunction,
  loadApiKey,
  loadOptionalSetting,
  withUserAgentSuffix,
  withoutTrailingSlash
} from '@ai-sdk/provider-utils';
import { KimiChatLanguageModel, type KimiChatModelId, type KimiChatSettings } from './chat';
import { KimiFileClient } from './files';
import { kimiTools } from './tools';
import { VERSION } from './version';

// ============================================================================
// Constants
// ============================================================================

const GLOBAL_BASE_URL = 'https://api.moonshot.ai/v1';
const CN_BASE_URL = 'https://api.moonshot.cn/v1';

// ============================================================================
// Provider Settings
// ============================================================================

/**
 * Settings for creating a Kimi provider instance.
 */
export interface KimiProviderSettings {
  /**
   * Moonshot AI API key. Defaults to the MOONSHOT_API_KEY environment variable.
   */
  apiKey?: string;

  /**
   * Base URL override. Defaults to the global or China endpoint.
   */
  baseURL?: string;

  /**
   * Select the regional endpoint when baseURL is not provided.
   * - `global`: Use the global API endpoint (api.moonshot.ai)
   * - `cn`: Use the China API endpoint (api.moonshot.cn)
   *
   * @default 'global'
   */
  endpoint?: 'global' | 'cn';

  /**
   * Default headers for all requests.
   */
  headers?: Record<string, string | undefined>;

  /**
   * Custom fetch implementation.
   */
  fetch?: FetchFunction;

  /**
   * ID generator for tool call fallback IDs.
   */
  generateId?: () => string;

  /**
   * Enable JSON schema structured outputs by default.
   */
  supportsStructuredOutputs?: boolean;

  /**
   * Include usage details in streaming responses if supported.
   */
  includeUsageInStream?: boolean;

  /**
   * Override supported URL patterns for file parts.
   */
  supportedUrls?: LanguageModelV3['supportedUrls'];
}

// ============================================================================
// Provider Interface
// ============================================================================

/**
 * The Kimi provider interface.
 */
export interface KimiProvider extends Omit<ProviderV3, 'specificationVersion'> {
  specificationVersion: 'v3';

  /**
   * Creates a chat language model.
   * @param modelId - The model identifier
   * @param settings - Optional model settings
   */
  (modelId: KimiChatModelId, settings?: KimiChatSettings): LanguageModelV3;

  /**
   * Creates a chat language model.
   * @param modelId - The model identifier
   * @param settings - Optional model settings
   */
  languageModel(modelId: KimiChatModelId, settings?: KimiChatSettings): LanguageModelV3;

  /**
   * Creates a chat language model (alias for languageModel).
   * @param modelId - The model identifier
   * @param settings - Optional model settings
   */
  chat(modelId: KimiChatModelId, settings?: KimiChatSettings): LanguageModelV3;

  /**
   * Built-in tools that can be used with Kimi models.
   */
  tools: typeof kimiTools;

  /**
   * File client for uploading and extracting content from files.
   * Pre-configured with the provider's API key and base URL.
   *
   * @example
   * ```ts
   * const kimi = createKimi();
   * const result = await kimi.files.uploadAndExtract({
   *   data: pdfBuffer,
   *   filename: 'document.pdf',
   * });
   * console.log(result.content);
   * ```
   */
  files: KimiFileClient;
}

// ============================================================================
// Provider Factory
// ============================================================================

/**
 * Create a Kimi provider instance.
 *
 * @param options - Provider settings
 * @returns A configured Kimi provider
 *
 * @example
 * ```ts
 * import { createKimi } from 'ai-sdk-provider-kimi';
 *
 * const kimi = createKimi({
 *   apiKey: process.env.MOONSHOT_API_KEY,
 * });
 *
 * const result = await generateText({
 *   model: kimi('kimi-k2.5'),
 *   prompt: 'Hello!',
 * });
 * ```
 *
 * @example
 * ```ts
 * // With web search enabled
 * const result = await generateText({
 *   model: kimi('kimi-k2.5', { webSearch: true }),
 *   prompt: 'What are the latest AI news?',
 * });
 * ```
 *
 * @example
 * ```ts
 * // With code interpreter
 * const result = await generateText({
 *   model: kimi('kimi-k2.5', { codeInterpreter: true }),
 *   prompt: 'Calculate the factorial of 20',
 * });
 * ```
 */
export function createKimi(options: KimiProviderSettings = {}): KimiProvider {
  const resolvedBaseURL =
    loadOptionalSetting({
      settingValue: options.baseURL,
      environmentVariableName: 'MOONSHOT_BASE_URL'
    }) ?? (options.endpoint === 'cn' ? CN_BASE_URL : GLOBAL_BASE_URL);

  const baseURL = withoutTrailingSlash(resolvedBaseURL) ?? GLOBAL_BASE_URL;

  const getHeaders = () =>
    withUserAgentSuffix(
      {
        Authorization: `Bearer ${loadApiKey({
          apiKey: options.apiKey,
          environmentVariableName: 'MOONSHOT_API_KEY',
          description: 'Moonshot'
        })}`,
        ...options.headers
      },
      `ai-sdk/kimi/${VERSION}`
    );

  const createChatModel = (modelId: KimiChatModelId, settings: KimiChatSettings = {}) =>
    new KimiChatLanguageModel(modelId, settings, {
      provider: 'kimi.chat',
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
      generateId: options.generateId,
      supportsStructuredOutputs: settings.supportsStructuredOutputs ?? options.supportsStructuredOutputs,
      includeUsageInStream: settings.includeUsageInStream ?? options.includeUsageInStream,
      supportedUrls: settings.supportedUrls ?? options.supportedUrls
    });

  const provider: KimiProvider = (modelId: KimiChatModelId, settings?: KimiChatSettings): KimiChatLanguageModel => {
    if (new.target) {
      throw new Error('The Kimi provider function cannot be called with new.');
    }

    return createChatModel(modelId, settings);
  };

  provider.specificationVersion = 'v3';
  provider.languageModel = createChatModel;
  provider.chat = createChatModel;
  provider.tools = kimiTools;
  provider.files = new KimiFileClient({
    baseURL,
    headers: getHeaders,
    fetch: options.fetch
  });

  provider.embeddingModel = (modelId: string) => {
    throw new NoSuchModelError({ modelId, modelType: 'embeddingModel' });
  };

  provider.imageModel = (modelId: string) => {
    throw new NoSuchModelError({ modelId, modelType: 'imageModel' });
  };

  provider.rerankingModel = (modelId: string) => {
    throw new NoSuchModelError({ modelId, modelType: 'rerankingModel' });
  };

  return provider;
}

/**
 * Default Kimi provider instance.
 *
 * Uses the MOONSHOT_API_KEY environment variable for authentication.
 *
 * @example
 * ```ts
 * import { kimi } from 'ai-sdk-provider-kimi';
 *
 * const result = await generateText({
 *   model: kimi('kimi-k2.5'),
 *   prompt: 'Hello!',
 * });
 * ```
 */
export const kimi = createKimi();

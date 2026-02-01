/**
 * Kimi Code provider factory.
 * @module
 */

import type { KimiCodeSettings } from './kimi-code-settings';
import { type LanguageModelV3, NoSuchModelError, type ProviderV3 } from '@ai-sdk/provider';
import {
  type FetchFunction,
  loadOptionalSetting,
  withUserAgentSuffix,
  withoutTrailingSlash
} from '@ai-sdk/provider-utils';
import { VERSION } from '../version';
import { KimiCodeLanguageModel } from './kimi-code-language-model';
import { KIMI_CODE_BASE_URL, KIMI_CODE_DEFAULT_MODEL, type KimiCodeModelId } from './kimi-code-types';

// ============================================================================
// Provider Settings
// ============================================================================

/**
 * Settings for creating a Kimi Code provider instance.
 */
export interface KimiCodeProviderSettings {
  /**
   * Kimi Code API key. Defaults to the KIMI_CODE_API_KEY or KIMI_API_KEY environment variable.
   */
  apiKey?: string;

  /**
   * Base URL override. Defaults to https://api.kimi.com/coding/v1
   */
  baseURL?: string;

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
   * Include usage details in streaming responses.
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
 * The Kimi Code provider interface.
 */
export interface KimiCodeProvider extends Omit<ProviderV3, 'specificationVersion'> {
  specificationVersion: 'v3';

  /**
   * Creates a Kimi Code language model.
   * @param modelId - The model identifier (defaults to 'kimi-for-coding')
   * @param settings - Optional model settings
   */
  (modelId?: KimiCodeModelId, settings?: KimiCodeSettings): LanguageModelV3;

  /**
   * Creates a Kimi Code language model.
   * @param modelId - The model identifier
   * @param settings - Optional model settings
   */
  languageModel(modelId: KimiCodeModelId, settings?: KimiCodeSettings): LanguageModelV3;

  /**
   * Creates a Kimi Code language model (alias for languageModel).
   * @param modelId - The model identifier
   * @param settings - Optional model settings
   */
  chat(modelId: KimiCodeModelId, settings?: KimiCodeSettings): LanguageModelV3;
}

// ============================================================================
// Provider Factory
// ============================================================================

/**
 * Create a Kimi Code provider instance.
 *
 * @param options - Provider settings
 * @returns A configured Kimi Code provider
 *
 * @example
 * ```ts
 * import { createKimiCode } from 'kimi-vercel-ai-sdk-provider
';
 *
 * const kimiCode = createKimiCode({
 *   apiKey: process.env.KIMI_CODE_API_KEY,
 * });
 *
 * const result = await generateText({
 *   model: kimiCode(), // Uses default 'kimi-for-coding' model
 *   prompt: 'Write a TypeScript function to merge two sorted arrays',
 * });
 * ```
 *
 * @example
 * ```ts
 * // With extended thinking enabled
 * const result = await generateText({
 *   model: kimiCode('kimi-for-coding', {
 *     extendedThinking: {
 *       enabled: true,
 *       effort: 'high'
 *     }
 *   }),
 *   prompt: 'Design a distributed cache system',
 * });
 * ```
 *
 * @example
 * ```ts
 * // Using with Claude Code compatible settings
 * const result = await generateText({
 *   model: kimiCode('kimi-k2-thinking'),
 *   prompt: 'Explain and fix this bug',
 * });
 * ```
 */
export function createKimiCode(options: KimiCodeProviderSettings = {}): KimiCodeProvider {
  const resolvedBaseURL =
    loadOptionalSetting({
      settingValue: options.baseURL,
      environmentVariableName: 'KIMI_CODE_BASE_URL'
    }) ?? KIMI_CODE_BASE_URL;

  const baseURL = withoutTrailingSlash(resolvedBaseURL) ?? KIMI_CODE_BASE_URL;

  const getHeaders = () => {
    // Try KIMI_CODE_API_KEY first, fall back to KIMI_API_KEY
    let apiKey = options.apiKey;
    if (!apiKey) {
      apiKey = process.env.KIMI_CODE_API_KEY ?? process.env.KIMI_API_KEY;
    }
    if (!apiKey) {
      throw new Error(
        'Kimi Code API key is required. Set the KIMI_CODE_API_KEY or KIMI_API_KEY environment variable, or pass the apiKey option.'
      );
    }

    return withUserAgentSuffix(
      {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        ...options.headers
      },
      `ai-sdk/kimi-code/${VERSION}`
    );
  };

  const createCodeModel = (modelId: KimiCodeModelId = KIMI_CODE_DEFAULT_MODEL, settings: KimiCodeSettings = {}) =>
    new KimiCodeLanguageModel(modelId, settings, {
      provider: 'kimi.code',
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
      generateId: options.generateId,
      includeUsageInStream: settings.includeUsageInStream ?? options.includeUsageInStream,
      supportedUrls: settings.supportedUrls ?? options.supportedUrls
    });

  const provider: KimiCodeProvider = (
    modelId: KimiCodeModelId = KIMI_CODE_DEFAULT_MODEL,
    settings?: KimiCodeSettings
  ): KimiCodeLanguageModel => {
    if (new.target) {
      throw new Error('The Kimi Code provider function cannot be called with new.');
    }

    return createCodeModel(modelId, settings);
  };

  provider.specificationVersion = 'v3';
  provider.languageModel = createCodeModel;
  provider.chat = createCodeModel;

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
 * Default Kimi Code provider instance.
 *
 * Uses the KIMI_CODE_API_KEY or KIMI_API_KEY environment variable for authentication.
 *
 * @example
 * ```ts
 * import { kimiCode } from 'kimi-vercel-ai-sdk-provider
';
 *
 * const result = await generateText({
 *   model: kimiCode(), // Uses default model
 *   prompt: 'Implement a binary search tree',
 * });
 * ```
 *
 * @example
 * ```ts
 * // With extended thinking
 * const result = await generateText({
 *   model: kimiCode('kimi-for-coding', { extendedThinking: true }),
 *   prompt: 'Design a microservices architecture',
 * });
 * ```
 */
export const kimiCode = createKimiCode();

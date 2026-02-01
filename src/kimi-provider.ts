import {
  LanguageModelV3,
  NoSuchModelError,
  ProviderV3,
} from '@ai-sdk/provider';
import {
  FetchFunction,
  loadApiKey,
  loadOptionalSetting,
  withoutTrailingSlash,
  withUserAgentSuffix,
} from '@ai-sdk/provider-utils';
import { KimiChatLanguageModel } from './kimi-chat-language-model';
import { KimiChatModelId, KimiChatSettings } from './kimi-chat-options';
import { VERSION } from './version';

const GLOBAL_BASE_URL = 'https://api.moonshot.ai/v1';
const CN_BASE_URL = 'https://api.moonshot.cn/v1';

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

export interface KimiProvider extends Omit<ProviderV3, 'specificationVersion'> {
  specificationVersion: 'v3';
  (modelId: KimiChatModelId, settings?: KimiChatSettings): LanguageModelV3;

  /**
   * Creates a chat language model.
   */
  languageModel(modelId: KimiChatModelId, settings?: KimiChatSettings): LanguageModelV3;

  /**
   * Creates a chat language model (alias).
   */
  chat(modelId: KimiChatModelId, settings?: KimiChatSettings): LanguageModelV3;
}

export function createKimi(options: KimiProviderSettings = {}): KimiProvider {
  const resolvedBaseURL =
    loadOptionalSetting({
      settingValue: options.baseURL,
      environmentVariableName: 'MOONSHOT_BASE_URL',
    }) ?? (options.endpoint === 'cn' ? CN_BASE_URL : GLOBAL_BASE_URL);

  const baseURL = withoutTrailingSlash(resolvedBaseURL) ?? GLOBAL_BASE_URL;

  const getHeaders = () =>
    withUserAgentSuffix(
      {
        Authorization: `Bearer ${loadApiKey({
          apiKey: options.apiKey,
          environmentVariableName: 'MOONSHOT_API_KEY',
          description: 'Moonshot',
        })}`,
        ...options.headers,
      },
      `ai-sdk/kimi/${VERSION}`,
    );

  const createChatModel = (
    modelId: KimiChatModelId,
    settings: KimiChatSettings = {},
  ) =>
    new KimiChatLanguageModel(modelId, settings, {
      provider: 'kimi.chat',
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
      generateId: options.generateId,
      supportsStructuredOutputs:
        settings.supportsStructuredOutputs ?? options.supportsStructuredOutputs,
      includeUsageInStream:
        settings.includeUsageInStream ?? options.includeUsageInStream,
      supportedUrls: settings.supportedUrls ?? options.supportedUrls,
    });

  const provider: KimiProvider = (
    modelId: KimiChatModelId,
    settings?: KimiChatSettings,
  ): KimiChatLanguageModel => {
    if (new.target) {
      throw new Error('The Kimi provider function cannot be called with new.');
    }

    return createChatModel(modelId, settings);
  };

  provider.specificationVersion = 'v3';
  provider.languageModel = createChatModel;
  provider.chat = createChatModel;

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

export const kimi = createKimi();

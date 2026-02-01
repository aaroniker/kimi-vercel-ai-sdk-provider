/**
 * Kimi provider factory.
 * @module
 */

import type { ValidationResult } from './code-validation';
import type { EnsembleConfig, GenerateFunction as EnsembleGenerateFunction, EnsembleResult } from './ensemble';
import type { LanguageModelUsage as EnsembleUsage } from './ensemble/types';
import type { MultiAgentConfig, MultiAgentResult } from './multi-agent';
import type { ScaffoldConfig, ScaffoldResult } from './project-tools';
import { type LanguageModelV3, NoSuchModelError, type ProviderV3 } from '@ai-sdk/provider';
import {
  type FetchFunction,
  loadApiKey,
  loadOptionalSetting,
  withUserAgentSuffix,
  withoutTrailingSlash
} from '@ai-sdk/provider-utils';
import { KimiChatLanguageModel, type KimiChatModelId, type KimiChatSettings } from './chat';
import { CodeValidator } from './code-validation';
import { MultiSampler } from './ensemble';
import { KimiFileClient } from './files';
import { type GenerateTextFunction as WorkflowGenerateTextFunction, WorkflowRunner } from './multi-agent';
import { ProjectScaffolder } from './project-tools';
import { detectToolsFromPrompt, kimiTools } from './tools';
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
 * Generate function signature for ensemble and convenience methods.
 * Takes a model and prompt and returns generation results.
 */
export type ProviderGenerateFunction = (
  model: LanguageModelV3,
  prompt: string,
  options?: { temperature?: number }
) => Promise<{
  text: string;
  reasoning?: string;
  toolCalls?: unknown[];
  toolResults?: unknown[];
  usage?: EnsembleUsage;
  finishReason?: string;
}>;

/**
 * Options for ensemble generation.
 */
export interface EnsembleOptions extends Partial<EnsembleConfig> {
  /**
   * Model to use for generation. Defaults to 'kimi-k2.5'.
   */
  model?: KimiChatModelId;

  /**
   * Base temperature for generation.
   * @default 0.7
   */
  baseTemperature?: number;
}

/**
 * Options for multi-agent workflows.
 */
export interface MultiAgentOptions extends Partial<MultiAgentConfig> {
  /**
   * Default model settings to apply.
   */
  modelSettings?: KimiChatSettings;
}

/**
 * Options for code validation.
 */
export interface ValidateCodeOptions {
  /**
   * Model to use for LLM-based validation. Defaults to 'kimi-k2.5'.
   */
  model?: KimiChatModelId;

  /**
   * Model settings to apply.
   */
  modelSettings?: KimiChatSettings;

  /**
   * Maximum number of attempts to fix errors.
   * @default 3
   */
  maxAttempts?: number;

  /**
   * Language to validate (auto-detected if not specified).
   * @default 'auto'
   */
  language?: 'javascript' | 'typescript' | 'python' | 'java' | 'cpp' | 'go' | 'rust' | 'ruby' | 'php' | 'auto';

  /**
   * Validation strictness level.
   * @default 'strict'
   */
  strictness?: 'lenient' | 'strict' | 'maximum';

  /**
   * Timeout for each code execution attempt (ms).
   * @default 30000
   */
  executionTimeoutMs?: number;

  /**
   * Whether to include test cases in validation.
   * @default true
   */
  includeTests?: boolean;

  /**
   * Whether to return the fixed code even if validation fails.
   * @default true
   */
  returnPartialFix?: boolean;
}

/**
 * Options for project scaffolding.
 */
export interface ScaffoldProjectOptions extends ScaffoldConfig {
  /**
   * Model to use for generation. Defaults to 'kimi-k2.5'.
   */
  model?: KimiChatModelId;

  /**
   * Model settings to apply.
   */
  modelSettings?: KimiChatSettings;
}

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

  /**
   * Generate multiple samples and select the best one using ensemble techniques.
   *
   * @param prompt - The prompt to generate from
   * @param generateFn - Function that generates text (from AI SDK)
   * @param options - Ensemble configuration options
   * @returns The best response based on the selection strategy
   *
   * @example
   * ```ts
   * import { generateText } from 'ai';
   *
   * const result = await kimi.ensemble(
   *   'Write a function to sort an array',
   *   async (model, prompt, opts) => {
   *     const result = await generateText({ model, prompt, temperature: opts?.temperature });
   *     return { text: result.text, usage: result.usage };
   *   },
   *   { n: 3, selectionStrategy: 'best', scoringHeuristic: 'code' }
   * );
   * ```
   */
  ensemble(prompt: string, generateFn: ProviderGenerateFunction, options?: EnsembleOptions): Promise<EnsembleResult>;

  /**
   * Run a multi-agent workflow for complex tasks.
   *
   * @param prompt - The task description
   * @param generateFn - Function that generates text (from AI SDK)
   * @param options - Multi-agent workflow configuration
   * @returns The result of the multi-agent collaboration
   *
   * @example
   * ```ts
   * const result = await kimi.multiAgent(
   *   'Build a REST API for user authentication',
   *   async (modelId, prompt) => {
   *     const result = await generateText({ model: kimi(modelId), prompt });
   *     return { text: result.text };
   *   },
   *   { workflow: 'planner-executor' }
   * );
   * ```
   */
  multiAgent(
    prompt: string,
    generateFn: WorkflowGenerateTextFunction,
    options?: MultiAgentOptions
  ): Promise<MultiAgentResult>;

  /**
   * Validate code for syntax errors and common issues.
   *
   * @param code - The code to validate
   * @param generateFn - Optional function for LLM-based validation
   * @param options - Validation configuration
   * @returns Validation result with errors and optionally fixed code
   *
   * @example
   * ```ts
   * const result = await kimi.validateCode(
   *   'function test() { return 42 }',
   *   async (model, prompt) => {
   *     const result = await generateText({ model, prompt });
   *     return { text: result.text };
   *   },
   *   { language: 'javascript', strictness: 'strict' }
   * );
   * ```
   */
  validateCode(
    code: string,
    generateFn?: (model: LanguageModelV3, prompt: string) => Promise<{ text: string }>,
    options?: ValidateCodeOptions
  ): Promise<ValidationResult>;

  /**
   * Generate a complete project scaffold from a description.
   *
   * @param description - Description of the project to create
   * @param generateFn - Function that generates text (from AI SDK)
   * @param options - Scaffold configuration
   * @returns Generated project files and setup instructions
   *
   * @example
   * ```ts
   * const result = await kimi.scaffoldProject(
   *   'A Next.js app with authentication and database',
   *   async (prompt) => {
   *     const result = await generateText({ model: kimi('kimi-k2.5'), prompt });
   *     return { text: result.text };
   *   },
   *   { type: 'nextjs', includeTests: true, includeDocker: true }
   * );
   * ```
   */
  scaffoldProject(
    description: string,
    generateFn: (prompt: string) => Promise<{ text: string }>,
    options?: ScaffoldProjectOptions
  ): Promise<ScaffoldResult>;

  /**
   * Auto-detect which tools should be enabled based on prompt content.
   *
   * @param prompt - The user's prompt
   * @returns Object with webSearch and codeInterpreter booleans
   *
   * @example
   * ```ts
   * const tools = kimi.detectTools('What is the current Bitcoin price?');
   * // { webSearch: true, codeInterpreter: false }
   *
   * const model = kimi('kimi-k2.5', {
   *   webSearch: tools.webSearch,
   *   codeInterpreter: tools.codeInterpreter
   * });
   * ```
   */
  detectTools(prompt: string): { webSearch: boolean; codeInterpreter: boolean };
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
 * import { createKimi } from 'kimi-vercel-ai-sdk-provider
';
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

  // ============================================================================
  // Advanced Feature Methods
  // ============================================================================

  provider.ensemble = async (
    prompt: string,
    generateFn: ProviderGenerateFunction,
    ensembleOptions: EnsembleOptions = {}
  ): Promise<EnsembleResult> => {
    const { model = 'kimi-k2.5', baseTemperature = 0.7, ...config } = ensembleOptions;

    const sampler = new MultiSampler({
      modelId: model,
      baseTemperature
    });

    // Wrap the generate function to match the expected signature
    const wrappedGenerateFn: EnsembleGenerateFunction = async (options) => {
      const languageModel = createChatModel(model, {});
      const result = await generateFn(languageModel, prompt, { temperature: options.temperature });
      return {
        text: result.text,
        reasoning: result.reasoning,
        toolCalls: result.toolCalls,
        toolResults: result.toolResults,
        usage: result.usage,
        finishReason: result.finishReason ?? 'stop'
      };
    };

    return sampler.generate(wrappedGenerateFn, {
      n: config.n ?? 3,
      selectionStrategy: config.selectionStrategy ?? 'best',
      temperatureVariance: config.temperatureVariance ?? 0.1,
      scoringHeuristic: config.scoringHeuristic ?? 'confidence',
      customScorer: config.customScorer,
      timeoutMs: config.timeoutMs ?? 60000,
      allowPartialFailure: config.allowPartialFailure ?? true,
      minSuccessfulSamples: config.minSuccessfulSamples ?? 1
    });
  };

  provider.multiAgent = async (
    prompt: string,
    generateFn: WorkflowGenerateTextFunction,
    agentOptions: MultiAgentOptions = {}
  ): Promise<MultiAgentResult> => {
    const { modelSettings, ...config } = agentOptions;

    const runner = new WorkflowRunner(generateFn);

    return runner.run(prompt, {
      workflow: config.workflow ?? 'planner-executor',
      modelA: config.modelA ?? 'kimi-k2.5-thinking',
      modelB: config.modelB ?? 'kimi-k2.5',
      iterations: config.iterations ?? 2,
      validateCode: config.validateCode ?? false,
      timeoutMs: config.timeoutMs ?? 120000,
      customWorkflow: config.customWorkflow,
      verbose: config.verbose ?? false,
      systemPrompts: config.systemPrompts
    });
  };

  provider.validateCode = async (
    code: string,
    generateFn?: (model: LanguageModelV3, prompt: string) => Promise<{ text: string }>,
    validateOptions: ValidateCodeOptions = {}
  ): Promise<ValidationResult> => {
    const { model = 'kimi-k2.5', modelSettings, ...config } = validateOptions;

    // Create generate function that uses our model if LLM validation is needed
    const languageModel = createChatModel(model, modelSettings);
    const llmGenerateFn = generateFn
      ? async (prompt: string) => generateFn(languageModel, prompt)
      : async (_prompt: string) => {
          return { text: '' };
        }; // Fallback for static-only validation

    const validator = new CodeValidator({
      generateText: llmGenerateFn
    });

    return validator.validate(code, {
      enabled: true,
      maxAttempts: config.maxAttempts ?? 3,
      language: config.language ?? 'auto',
      strictness: config.strictness ?? 'strict',
      executionTimeoutMs: config.executionTimeoutMs ?? 30000,
      includeTests: config.includeTests ?? true,
      returnPartialFix: config.returnPartialFix ?? true
    });
  };

  provider.scaffoldProject = async (
    description: string,
    generateFn: (prompt: string) => Promise<{ text: string }>,
    scaffoldOptions: ScaffoldProjectOptions = {}
  ): Promise<ScaffoldResult> => {
    const scaffolder = new ProjectScaffolder({
      generateText: generateFn
    });

    return scaffolder.scaffold(description, scaffoldOptions);
  };

  provider.detectTools = (prompt: string): { webSearch: boolean; codeInterpreter: boolean } => {
    const result = detectToolsFromPrompt(prompt);
    return {
      webSearch: result.webSearch,
      codeInterpreter: result.codeInterpreter
    };
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
 * import { kimi } from 'kimi-vercel-ai-sdk-provider
';
 *
 * const result = await generateText({
 *   model: kimi('kimi-k2.5'),
 *   prompt: 'Hello!',
 * });
 * ```
 */
export const kimi = createKimi();

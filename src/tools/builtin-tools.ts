/**
 * Built-in tools for Kimi API.
 *
 * Kimi provides server-side tools that can be invoked during chat completions:
 * - `$web_search`: Search the web for information
 * - `$code`: Execute code using Kimi's code interpreter
 *
 * @module
 */

// ============================================================================
// Constants
// ============================================================================

/**
 * Kimi's built-in web search tool identifier.
 * This tool allows Kimi to search the web for up-to-date information.
 */
export const KIMI_WEB_SEARCH_TOOL_NAME = '$web_search';

/**
 * Kimi's built-in code interpreter tool identifier.
 * This tool allows Kimi to execute code and return results.
 */
export const KIMI_CODE_INTERPRETER_TOOL_NAME = '$code';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for Kimi's built-in web search tool.
 */
export interface KimiWebSearchConfig {
  /**
   * Whether to include search results in the response.
   * When true, the search results will be included in the tool output.
   */
  search_result?: boolean;
  /**
   * Allow additional configuration options.
   */
  [key: string]: unknown;
}

/**
 * Configuration for Kimi's built-in code interpreter tool.
 */
export interface KimiCodeInterpreterConfig {
  /**
   * Maximum execution time in seconds.
   * Default varies by model and API tier.
   */
  timeout?: number;

  /**
   * Whether to return execution output.
   * When true, stdout/stderr will be included in results.
   */
  include_output?: boolean;

  /**
   * Allow additional configuration options.
   */
  [key: string]: unknown;
}

/**
 * A Kimi built-in tool definition.
 * These are handled server-side by Kimi's API.
 */
export interface KimiBuiltinTool {
  type: 'builtin_function';
  function: {
    name: string;
    config?: Record<string, unknown>;
  };
}

// ============================================================================
// Web Search Tool
// ============================================================================

/**
 * Configuration options for the web search tool.
 */
export interface KimiWebSearchToolOptions {
  /**
   * Whether the web search tool is enabled.
   */
  enabled: boolean;

  /**
   * Optional configuration for the web search tool.
   */
  config?: KimiWebSearchConfig;
}

export type KimiWebSearchToolConfig = KimiWebSearchToolOptions;

/**
 * Create a Kimi built-in web search tool definition.
 *
 * @param config - Optional configuration for the web search tool
 * @returns A built-in tool definition for $web_search
 *
 * @example
 * ```ts
 * // Basic usage
 * const tool = createWebSearchTool();
 *
 * // With configuration
 * const tool = createWebSearchTool({ search_result: true });
 * ```
 */
export function createWebSearchTool(config?: KimiWebSearchConfig): KimiBuiltinTool {
  return {
    type: 'builtin_function',
    function: {
      name: KIMI_WEB_SEARCH_TOOL_NAME,
      ...(config ? { config } : {})
    }
  };
}

export function createKimiWebSearchTool(config?: KimiWebSearchConfig): KimiBuiltinTool {
  return createWebSearchTool(config);
}

// ============================================================================
// Code Interpreter Tool
// ============================================================================

/**
 * Configuration options for the code interpreter tool.
 */
export interface KimiCodeInterpreterToolOptions {
  /**
   * Whether the code interpreter tool is enabled.
   */
  enabled: boolean;

  /**
   * Optional configuration for the code interpreter tool.
   */
  config?: KimiCodeInterpreterConfig;
}

/**
 * Create a Kimi built-in code interpreter tool definition.
 *
 * @param config - Optional configuration for the code interpreter tool
 * @returns A built-in tool definition for $code
 *
 * @example
 * ```ts
 * // Basic usage
 * const tool = createCodeInterpreterTool();
 *
 * // With configuration
 * const tool = createCodeInterpreterTool({ timeout: 30, include_output: true });
 * ```
 */
export function createCodeInterpreterTool(config?: KimiCodeInterpreterConfig): KimiBuiltinTool {
  return {
    type: 'builtin_function',
    function: {
      name: KIMI_CODE_INTERPRETER_TOOL_NAME,
      ...(config ? { config } : {})
    }
  };
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Check if a tool name is a Kimi built-in tool.
 * Built-in tools are prefixed with '$'.
 *
 * @param toolName - The tool name to check
 * @returns True if the tool is a built-in tool
 */
export function isBuiltinToolName(toolName: string): boolean {
  return toolName.startsWith('$');
}

/**
 * Check if a tool name is the web search tool.
 *
 * @param toolName - The tool name to check
 * @returns True if the tool is the web search tool
 */
export function isWebSearchTool(toolName: string): boolean {
  return toolName === KIMI_WEB_SEARCH_TOOL_NAME;
}

/**
 * Check if a tool name is the code interpreter tool.
 *
 * @param toolName - The tool name to check
 * @returns True if the tool is the code interpreter tool
 */
export function isCodeInterpreterTool(toolName: string): boolean {
  return toolName === KIMI_CODE_INTERPRETER_TOOL_NAME;
}

// ============================================================================
// Provider Tool Definitions
// ============================================================================

/**
 * Create provider-level tool definitions for use with the AI SDK.
 * These can be passed directly to the tools option.
 */
export const kimiTools = {
  /**
   * Create a web search tool for use with Kimi models.
   *
   * @param config - Optional configuration
   * @returns A provider tool definition
   *
   * @example
   * ```ts
   * import { kimi, kimiTools } from 'kimi-vercel-ai-sdk-provider
';
   *
   * const result = await generateText({
   *   model: kimi('kimi-k2.5'),
   *   tools: {
   *     webSearch: kimiTools.webSearch(),
   *   },
   *   prompt: 'What are the latest AI news?',
   * });
   * ```
   */
  webSearch: (config?: KimiWebSearchConfig) => {
    return {
      type: 'provider' as const,
      id: 'kimi.webSearch',
      args: createWebSearchTool(config)
    };
  },

  /**
   * Create a code interpreter tool for use with Kimi models.
   *
   * @param config - Optional configuration
   * @returns A provider tool definition
   *
   * @example
   * ```ts
   * import { kimi, kimiTools } from 'kimi-vercel-ai-sdk-provider
';
   *
   * const result = await generateText({
   *   model: kimi('kimi-k2.5'),
   *   tools: {
   *     codeInterpreter: kimiTools.codeInterpreter(),
   *   },
   *   prompt: 'Calculate the factorial of 10',
   * });
   * ```
   */
  codeInterpreter: (config?: KimiCodeInterpreterConfig) => {
    return {
      type: 'provider' as const,
      id: 'kimi.codeInterpreter',
      args: createCodeInterpreterTool(config)
    };
  }
};

/**
 * Tool preparation utilities for Kimi API.
 * @module
 */

import {
  type LanguageModelV3CallOptions,
  type LanguageModelV3ProviderTool,
  type SharedV3Warning,
  UnsupportedFunctionalityError
} from '@ai-sdk/provider';
import {
  type KimiBuiltinTool,
  type KimiCodeInterpreterToolOptions,
  type KimiWebSearchToolOptions,
  createCodeInterpreterTool,
  createWebSearchTool
} from './builtin-tools';

// ============================================================================
// Types
// ============================================================================

/**
 * A standard function tool for Kimi API.
 */
export interface KimiFunctionTool {
  type: 'function';
  function: {
    name: string;
    description: string | undefined;
    parameters: unknown;
    strict?: boolean;
  };
}

/**
 * Union of all tool types supported by Kimi API.
 */
export type KimiTool = KimiFunctionTool | KimiBuiltinTool;

/**
 * Options for preparing tools.
 */
export interface PrepareToolsOptions {
  /**
   * The tools from the call options.
   */
  tools: LanguageModelV3CallOptions['tools'];

  /**
   * The tool choice from the call options.
   */
  toolChoice?: LanguageModelV3CallOptions['toolChoice'];

  /**
   * Web search configuration.
   */
  webSearch?: boolean | KimiWebSearchToolOptions;

  /**
   * Code interpreter configuration.
   */
  codeInterpreter?: boolean | KimiCodeInterpreterToolOptions;
}

/**
 * Result of preparing tools.
 */
export interface PrepareToolsResult {
  /**
   * The prepared tools for the API request.
   */
  tools: KimiTool[] | undefined;

  /**
   * The tool choice setting for the API request.
   */
  toolChoice: 'auto' | 'none' | undefined;

  /**
   * Any warnings generated during tool preparation.
   */
  toolWarnings: SharedV3Warning[];
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Prepare tools for a Kimi API request.
 *
 * This function processes user-defined tools and built-in tools,
 * converting them to the format expected by the Kimi API.
 *
 * @param options - Tool preparation options
 * @returns Prepared tools, tool choice, and warnings
 */
export function prepareKimiTools({
  tools,
  toolChoice,
  webSearch,
  codeInterpreter
}: PrepareToolsOptions): PrepareToolsResult {
  tools = tools?.length ? tools : undefined;

  const toolWarnings: SharedV3Warning[] = [];
  const kimiTools: KimiTool[] = [];

  // Add built-in web search tool if enabled
  if (webSearch) {
    const config = typeof webSearch === 'boolean' ? undefined : webSearch.config;
    kimiTools.push(createWebSearchTool(config));
  }

  // Add built-in code interpreter tool if enabled
  if (codeInterpreter) {
    const config = typeof codeInterpreter === 'boolean' ? undefined : codeInterpreter.config;
    kimiTools.push(createCodeInterpreterTool(config));
  }

  // Process user-defined tools
  if (tools != null) {
    for (const tool of tools) {
      if (tool.type === 'provider') {
        // Check if this is a Kimi built-in tool
        const builtinTool = tryConvertToKimiBuiltinTool(tool);
        if (builtinTool) {
          kimiTools.push(builtinTool);
          continue;
        }

        toolWarnings.push({
          type: 'unsupported',
          feature: `provider-defined tool ${tool.id}`
        });
        continue;
      }

      kimiTools.push({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
          ...(tool.strict != null ? { strict: tool.strict } : {})
        }
      });
    }
  }

  // Return undefined if no tools
  if (kimiTools.length === 0) {
    return { tools: undefined, toolChoice: undefined, toolWarnings };
  }

  // Handle tool choice
  if (toolChoice == null) {
    return { tools: kimiTools, toolChoice: undefined, toolWarnings };
  }

  switch (toolChoice.type) {
    case 'auto':
    case 'none':
      return { tools: kimiTools, toolChoice: toolChoice.type, toolWarnings };
    case 'required':
      toolWarnings.push({
        type: 'compatibility',
        feature: 'toolChoice.required',
        details: 'Moonshot does not support required tool choice. Falling back to auto.'
      });
      return { tools: kimiTools, toolChoice: 'auto', toolWarnings };
    case 'tool':
      toolWarnings.push({
        type: 'compatibility',
        feature: `toolChoice.tool:${toolChoice.toolName}`,
        details: 'Moonshot does not support forcing a specific tool. Falling back to auto.'
      });
      return { tools: kimiTools, toolChoice: 'auto', toolWarnings };
    default: {
      const _exhaustiveCheck: never = toolChoice;
      throw new UnsupportedFunctionalityError({
        functionality: `tool choice type: ${_exhaustiveCheck}`
      });
    }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Try to convert a provider-defined tool to a Kimi built-in tool.
 * Returns undefined if the tool is not a Kimi built-in tool.
 */
function tryConvertToKimiBuiltinTool(tool: LanguageModelV3ProviderTool): KimiBuiltinTool | undefined {
  // Check if this is a Kimi provider tool (id starts with 'kimi.')
  if (!tool.id.startsWith('kimi.')) {
    return undefined;
  }

  // Check if the args indicate a builtin_function type
  const args = tool.args;
  if (
    args &&
    typeof args === 'object' &&
    'type' in args &&
    args.type === 'builtin_function' &&
    'function' in args &&
    typeof args.function === 'object'
  ) {
    const fn = args.function as { name?: string; config?: Record<string, unknown> };
    if (typeof fn.name === 'string') {
      return {
        type: 'builtin_function',
        function: {
          name: fn.name,
          ...(fn.config ? { config: fn.config } : {})
        }
      };
    }
  }

  return undefined;
}

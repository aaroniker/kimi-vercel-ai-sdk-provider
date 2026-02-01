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

  /**
   * Enable tool choice polyfill for unsupported modes.
   * When true, uses system message injection to simulate
   * `required` and `tool` choices.
   */
  toolChoicePolyfill?: boolean;
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

  /**
   * System message to inject for tool choice polyfill.
   * This should be prepended to the messages array.
   */
  toolChoiceSystemMessage?: string;
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
 * When `toolChoicePolyfill` is enabled, the function will generate
 * system messages to simulate unsupported tool choice modes:
 * - `required`: Injects a message instructing the model to use a tool
 * - `tool`: Injects a message instructing the model to use a specific tool
 *
 * @param options - Tool preparation options
 * @returns Prepared tools, tool choice, warnings, and optional system message
 */
export function prepareKimiTools({
  tools,
  toolChoice,
  webSearch,
  codeInterpreter,
  toolChoicePolyfill = true
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

      // Sanitize schema for Kimi compatibility
      const sanitizedSchema = sanitizeToolSchema(tool.inputSchema);

      kimiTools.push({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: sanitizedSchema
          // Don't pass strict mode to Kimi - it may cause issues
          // ...(tool.strict != null ? { strict: tool.strict } : {})
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

    case 'required': {
      if (toolChoicePolyfill) {
        // Generate system message to force tool usage
        const toolNames = kimiTools.map((t) => (t.type === 'function' ? t.function.name : t.function.name)).join(', ');
        const systemMessage = generateRequiredToolMessage(toolNames);

        toolWarnings.push({
          type: 'compatibility',
          feature: 'toolChoice.required',
          details: 'Using tool choice polyfill with system message injection.'
        });

        return {
          tools: kimiTools,
          toolChoice: 'auto',
          toolWarnings,
          toolChoiceSystemMessage: systemMessage
        };
      }

      toolWarnings.push({
        type: 'compatibility',
        feature: 'toolChoice.required',
        details: 'Moonshot does not support required tool choice. Falling back to auto.'
      });
      return { tools: kimiTools, toolChoice: 'auto', toolWarnings };
    }

    case 'tool': {
      if (toolChoicePolyfill) {
        // Generate system message to force specific tool
        const systemMessage = generateSpecificToolMessage(toolChoice.toolName);

        toolWarnings.push({
          type: 'compatibility',
          feature: `toolChoice.tool:${toolChoice.toolName}`,
          details: 'Using tool choice polyfill with system message injection.'
        });

        return {
          tools: kimiTools,
          toolChoice: 'auto',
          toolWarnings,
          toolChoiceSystemMessage: systemMessage
        };
      }

      toolWarnings.push({
        type: 'compatibility',
        feature: `toolChoice.tool:${toolChoice.toolName}`,
        details: 'Moonshot does not support forcing a specific tool. Falling back to auto.'
      });
      return { tools: kimiTools, toolChoice: 'auto', toolWarnings };
    }

    default: {
      const _exhaustiveCheck: never = toolChoice;
      throw new UnsupportedFunctionalityError({
        functionality: `tool choice type: ${_exhaustiveCheck}`
      });
    }
  }
}

// ============================================================================
// Tool Choice Polyfill Messages
// ============================================================================

/**
 * Tool descriptions for better guidance.
 */
const TOOL_DESCRIPTIONS: Record<string, string> = {
  $web_search:
    'Search the web for up-to-date information, current events, facts, news, prices, weather, or any data not available in your training',
  $code: 'Execute code to perform calculations, data processing, algorithmic tasks, or verify code correctness'
};

/**
 * Options for generating tool guidance messages.
 */
export interface ToolGuidanceOptions {
  /**
   * The tool names available.
   */
  toolNames: string[];

  /**
   * The type of tool choice.
   */
  choiceType: 'required' | 'tool';

  /**
   * The specific tool name if choiceType is 'tool'.
   */
  targetTool?: string;

  /**
   * Optional context from the user's prompt to include.
   */
  promptContext?: string;

  /**
   * Whether to include detailed tool descriptions.
   * @default true
   */
  includeDescriptions?: boolean;
}

/**
 * Generate a comprehensive tool guidance message.
 *
 * @param options - Options for generating the message
 * @returns The generated system message
 */
export function generateToolGuidanceMessage(options: ToolGuidanceOptions): string {
  const { toolNames, choiceType, targetTool, promptContext, includeDescriptions = true } = options;

  const lines: string[] = ['=== TOOL USAGE GUIDANCE ===', ''];

  // Add tool descriptions
  if (includeDescriptions && toolNames.length > 0) {
    lines.push('Available tools:');
    for (const toolName of toolNames) {
      const description = TOOL_DESCRIPTIONS[toolName] || 'Execute this tool';
      lines.push(`- ${toolName}: ${description}`);
    }
    lines.push('');
  }

  // Add the requirement
  if (choiceType === 'required') {
    lines.push('⚠️ IMPORTANT: You MUST use at least one of the available tools to respond.');
    lines.push('Do NOT provide a direct text response without first calling a tool.');
  } else if (choiceType === 'tool' && targetTool) {
    lines.push(`⚠️ IMPORTANT: You MUST use the "${targetTool}" tool to respond.`);
    lines.push('Do NOT use any other tool or provide a direct text response.');
  }

  // Add context-specific guidance
  if (promptContext) {
    lines.push('');
    lines.push(`Task context: ${promptContext.slice(0, 200)}${promptContext.length > 200 ? '...' : ''}`);
  }

  return lines.join('\n');
}

/**
 * Generate a system message to force the model to use a tool.
 */
function generateRequiredToolMessage(toolNames: string): string {
  const tools = toolNames.split(', ');
  return generateToolGuidanceMessage({
    toolNames: tools,
    choiceType: 'required',
    includeDescriptions: true
  });
}

/**
 * Generate a system message to force the model to use a specific tool.
 */
function generateSpecificToolMessage(toolName: string): string {
  return generateToolGuidanceMessage({
    toolNames: [toolName],
    choiceType: 'tool',
    targetTool: toolName,
    includeDescriptions: true
  });
}

// ============================================================================
// Schema Sanitization
// ============================================================================

/**
 * JSON Schema keywords that may cause issues with Kimi's API.
 * These are removed during sanitization to improve compatibility.
 */
const UNSUPPORTED_SCHEMA_KEYWORDS = [
  '$schema',
  '$id',
  '$ref',
  '$defs',
  'definitions',
  'if',
  'then',
  'else',
  'allOf',
  'anyOf',
  'oneOf',
  'not',
  'patternProperties',
  'additionalItems',
  'contains',
  'propertyNames',
  'const',
  'contentMediaType',
  'contentEncoding',
  'examples',
  '$comment'
] as const;

/**
 * Sanitize a JSON Schema for better Kimi API compatibility.
 *
 * This function removes advanced schema keywords that Kimi may not
 * fully support, while preserving the essential structure for validation.
 *
 * @param schema - The original JSON Schema
 * @returns A sanitized schema safe for Kimi
 */
function sanitizeToolSchema(schema: unknown): unknown {
  if (schema === null || schema === undefined) {
    return schema;
  }

  if (Array.isArray(schema)) {
    return schema.map(sanitizeToolSchema);
  }

  if (typeof schema !== 'object') {
    return schema;
  }

  const sanitized: Record<string, unknown> = {};
  const schemaObj = schema as Record<string, unknown>;

  for (const [key, value] of Object.entries(schemaObj)) {
    // Skip unsupported keywords
    if (UNSUPPORTED_SCHEMA_KEYWORDS.includes(key as (typeof UNSUPPORTED_SCHEMA_KEYWORDS)[number])) {
      continue;
    }

    // Recursively sanitize nested objects
    if (key === 'properties' && typeof value === 'object' && value !== null) {
      const props: Record<string, unknown> = {};
      for (const [propKey, propValue] of Object.entries(value as Record<string, unknown>)) {
        props[propKey] = sanitizeToolSchema(propValue);
      }
      sanitized[key] = props;
    } else if (key === 'items' && typeof value === 'object') {
      sanitized[key] = sanitizeToolSchema(value);
    } else if (key === 'additionalProperties' && typeof value === 'object') {
      sanitized[key] = sanitizeToolSchema(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
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

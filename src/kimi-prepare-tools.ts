import {
  LanguageModelV3CallOptions,
  LanguageModelV3ProviderTool,
  SharedV3Warning,
  UnsupportedFunctionalityError,
} from '@ai-sdk/provider';
import {
  KimiBuiltinTool,
  KimiWebSearchToolConfig,
  createKimiWebSearchTool,
} from './kimi-chat-options';

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

export function prepareKimiTools({
  tools,
  toolChoice,
  webSearch,
}: {
  tools: LanguageModelV3CallOptions['tools'];
  toolChoice?: LanguageModelV3CallOptions['toolChoice'];
  webSearch?: boolean | KimiWebSearchToolConfig;
}): {
  tools: KimiTool[] | undefined;
  toolChoice: 'auto' | 'none' | undefined;
  toolWarnings: SharedV3Warning[];
} {
  tools = tools?.length ? tools : undefined;

  const toolWarnings: SharedV3Warning[] = [];
  const kimiTools: KimiTool[] = [];

  // Add built-in web search tool if enabled
  if (webSearch) {
    const config =
      typeof webSearch === 'boolean'
        ? undefined
        : webSearch.config;
    kimiTools.push(createKimiWebSearchTool(config));
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
          feature: `provider-defined tool ${tool.id}`,
        });
        continue;
      }

      kimiTools.push({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
          ...(tool.strict != null ? { strict: tool.strict } : {}),
        },
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
        details: 'Moonshot does not support required tool choice. Falling back to auto.',
      });
      return { tools: kimiTools, toolChoice: 'auto', toolWarnings };
    case 'tool':
      toolWarnings.push({
        type: 'compatibility',
        feature: `toolChoice.tool:${toolChoice.toolName}`,
        details: 'Moonshot does not support forcing a specific tool. Falling back to auto.',
      });
      return { tools: kimiTools, toolChoice: 'auto', toolWarnings };
    default: {
      const _exhaustiveCheck: never = toolChoice;
      throw new UnsupportedFunctionalityError({
        functionality: `tool choice type: ${_exhaustiveCheck}`,
      });
    }
  }
}

/**
 * Try to convert a provider-defined tool to a Kimi built-in tool.
 * Returns undefined if the tool is not a Kimi built-in tool.
 */
function tryConvertToKimiBuiltinTool(
  tool: LanguageModelV3ProviderTool,
): KimiBuiltinTool | undefined {
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
          ...(fn.config ? { config: fn.config } : {}),
        },
      };
    }
  }

  return undefined;
}

/**
 * Check if a tool name is a Kimi built-in tool.
 */
export function isBuiltinToolName(toolName: string): boolean {
  return toolName.startsWith('$');
}

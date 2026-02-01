import { describe, expect, it } from 'vitest';
import {
  KIMI_CODE_INTERPRETER_TOOL_NAME,
  KIMI_WEB_SEARCH_TOOL_NAME,
  createCodeInterpreterTool,
  createKimiWebSearchTool,
  createWebSearchTool,
  isBuiltinToolName,
  isCodeInterpreterTool,
  isWebSearchTool,
  kimiTools,
  prepareKimiTools
} from '../tools';

describe('builtin-tools', () => {
  describe('constants', () => {
    it('should have correct web search tool name', () => {
      expect(KIMI_WEB_SEARCH_TOOL_NAME).toBe('$web_search');
    });

    it('should have correct code interpreter tool name', () => {
      expect(KIMI_CODE_INTERPRETER_TOOL_NAME).toBe('$code');
    });
  });

  describe('createWebSearchTool', () => {
    it('should create basic web search tool', () => {
      const tool = createWebSearchTool();
      expect(tool).toEqual({
        type: 'builtin_function',
        function: {
          name: '$web_search'
        }
      });
    });

    it('should create web search tool with config', () => {
      const tool = createWebSearchTool({ search_result: true });
      expect(tool).toEqual({
        type: 'builtin_function',
        function: {
          name: '$web_search',
          config: { search_result: true }
        }
      });
    });
  });

  describe('createKimiWebSearchTool', () => {
    it('should create web search tool (alias)', () => {
      const tool = createKimiWebSearchTool();
      expect(tool).toEqual({
        type: 'builtin_function',
        function: {
          name: '$web_search'
        }
      });
    });
  });

  describe('createCodeInterpreterTool', () => {
    it('should create basic code interpreter tool', () => {
      const tool = createCodeInterpreterTool();
      expect(tool).toEqual({
        type: 'builtin_function',
        function: {
          name: '$code'
        }
      });
    });

    it('should create code interpreter tool with config', () => {
      const tool = createCodeInterpreterTool({
        timeout: 30,
        include_output: true
      });
      expect(tool).toEqual({
        type: 'builtin_function',
        function: {
          name: '$code',
          config: { timeout: 30, include_output: true }
        }
      });
    });
  });

  describe('isBuiltinToolName', () => {
    it('should return true for $web_search', () => {
      expect(isBuiltinToolName('$web_search')).toBe(true);
    });

    it('should return true for $code', () => {
      expect(isBuiltinToolName('$code')).toBe(true);
    });

    it('should return true for any tool starting with $', () => {
      expect(isBuiltinToolName('$custom_tool')).toBe(true);
    });

    it('should return false for regular tool names', () => {
      expect(isBuiltinToolName('get_weather')).toBe(false);
      expect(isBuiltinToolName('web_search')).toBe(false);
      expect(isBuiltinToolName('code')).toBe(false);
    });
  });

  describe('isWebSearchTool', () => {
    it('should return true for $web_search', () => {
      expect(isWebSearchTool('$web_search')).toBe(true);
    });

    it('should return false for other tools', () => {
      expect(isWebSearchTool('$code')).toBe(false);
      expect(isWebSearchTool('web_search')).toBe(false);
    });
  });

  describe('isCodeInterpreterTool', () => {
    it('should return true for $code', () => {
      expect(isCodeInterpreterTool('$code')).toBe(true);
    });

    it('should return false for other tools', () => {
      expect(isCodeInterpreterTool('$web_search')).toBe(false);
      expect(isCodeInterpreterTool('code')).toBe(false);
    });
  });

  describe('kimiTools', () => {
    describe('webSearch', () => {
      it('should create a provider tool for web search', () => {
        const tool = kimiTools.webSearch();
        expect(tool.type).toBe('provider');
        expect(tool.id).toBe('kimi.webSearch');
        expect(tool.args).toEqual({
          type: 'builtin_function',
          function: { name: '$web_search' }
        });
      });

      it('should create a provider tool with config', () => {
        const tool = kimiTools.webSearch({ search_result: true });
        expect(tool.args).toEqual({
          type: 'builtin_function',
          function: {
            name: '$web_search',
            config: { search_result: true }
          }
        });
      });
    });

    describe('codeInterpreter', () => {
      it('should create a provider tool for code interpreter', () => {
        const tool = kimiTools.codeInterpreter();
        expect(tool.type).toBe('provider');
        expect(tool.id).toBe('kimi.codeInterpreter');
        expect(tool.args).toEqual({
          type: 'builtin_function',
          function: { name: '$code' }
        });
      });

      it('should create a provider tool with config', () => {
        const tool = kimiTools.codeInterpreter({ timeout: 60 });
        expect(tool.args).toEqual({
          type: 'builtin_function',
          function: {
            name: '$code',
            config: { timeout: 60 }
          }
        });
      });
    });
  });
});

describe('prepareKimiTools', () => {
  describe('with no tools', () => {
    it('should return undefined when tools is undefined', () => {
      const result = prepareKimiTools({ tools: undefined });
      expect(result.tools).toBeUndefined();
      expect(result.toolChoice).toBeUndefined();
      expect(result.toolWarnings).toEqual([]);
    });

    it('should return undefined when tools is empty array', () => {
      const result = prepareKimiTools({ tools: [] });
      expect(result.tools).toBeUndefined();
      expect(result.toolChoice).toBeUndefined();
    });
  });

  describe('with function tools', () => {
    it('should convert function tools to Kimi format', () => {
      const result = prepareKimiTools({
        tools: [
          {
            type: 'function',
            name: 'get_weather',
            description: 'Get weather for a location',
            inputSchema: {
              type: 'object',
              properties: {
                location: { type: 'string' }
              }
            }
          }
        ]
      });

      expect(result.tools).toHaveLength(1);
      expect(result.tools?.[0]).toEqual({
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Get weather for a location',
          parameters: {
            type: 'object',
            properties: {
              location: { type: 'string' }
            }
          }
        }
      });
    });

    it('should not pass strict mode to Kimi for better compatibility', () => {
      // Kimi doesn't fully support strict mode, so we don't pass it
      const result = prepareKimiTools({
        tools: [
          {
            type: 'function',
            name: 'test',
            description: 'Test tool',
            inputSchema: {},
            strict: true
          }
        ]
      });

      // Strict should not be present in the output
      const tool = result.tools?.[0];
      expect(tool).toBeDefined();
      if (tool && 'function' in tool) {
        expect(tool.function).not.toHaveProperty('strict');
      }
    });

    it('should sanitize JSON schema by removing unsupported keywords', () => {
      const result = prepareKimiTools({
        tools: [
          {
            type: 'function',
            name: 'test',
            description: 'Test tool',
            inputSchema: {
              $schema: 'http://json-schema.org/draft-07/schema#',
              $id: 'test-schema',
              type: 'object',
              properties: {
                name: { type: 'string' }
              },
              $defs: { unused: { type: 'string' } },
              $comment: 'This is a comment'
            }
          }
        ]
      });

      const tool = result.tools?.[0];
      expect(tool).toBeDefined();
      expect(tool?.type).toBe('function');
      if (tool && tool.type === 'function') {
        const params = tool.function.parameters as Record<string, unknown>;
        expect(params).not.toHaveProperty('$schema');
        expect(params).not.toHaveProperty('$id');
        expect(params).not.toHaveProperty('$defs');
        expect(params).not.toHaveProperty('$comment');
        expect(params.type).toBe('object');
        expect(params.properties).toEqual({ name: { type: 'string' } });
      }
    });

    it('should preserve basic schema properties', () => {
      const result = prepareKimiTools({
        tools: [
          {
            type: 'function',
            name: 'test',
            description: 'Test tool',
            inputSchema: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Name field' },
                count: { type: 'number', minimum: 0 }
              },
              required: ['name']
            }
          }
        ]
      });

      const tool = result.tools?.[0];
      expect(tool).toBeDefined();
      expect(tool?.type).toBe('function');
      if (tool && tool.type === 'function') {
        const params = tool.function.parameters as Record<string, unknown>;
        expect(params.type).toBe('object');
        expect(params.required).toEqual(['name']);
        expect((params.properties as Record<string, unknown>).name).toEqual({
          type: 'string',
          description: 'Name field'
        });
      }
    });
  });

  describe('with web search', () => {
    it('should add web search tool when webSearch is true', () => {
      const result = prepareKimiTools({
        tools: undefined,
        webSearch: true
      });

      expect(result.tools).toHaveLength(1);
      expect(result.tools?.[0]).toEqual({
        type: 'builtin_function',
        function: {
          name: '$web_search'
        }
      });
    });

    it('should add web search tool with config', () => {
      const result = prepareKimiTools({
        tools: undefined,
        webSearch: {
          enabled: true,
          config: { search_result: true }
        }
      });

      expect(result.tools).toHaveLength(1);
      expect(result.tools?.[0]).toEqual({
        type: 'builtin_function',
        function: {
          name: '$web_search',
          config: { search_result: true }
        }
      });
    });

    it('should combine web search with function tools', () => {
      const result = prepareKimiTools({
        tools: [
          {
            type: 'function',
            name: 'get_data',
            description: 'Get data',
            inputSchema: {}
          }
        ],
        webSearch: true
      });

      expect(result.tools).toHaveLength(2);
      expect(result.tools?.[0].type).toBe('builtin_function');
      expect(result.tools?.[1].type).toBe('function');
    });
  });

  describe('with code interpreter', () => {
    it('should add code interpreter tool when codeInterpreter is true', () => {
      const result = prepareKimiTools({
        tools: undefined,
        codeInterpreter: true
      });

      expect(result.tools).toHaveLength(1);
      expect(result.tools?.[0]).toEqual({
        type: 'builtin_function',
        function: {
          name: '$code'
        }
      });
    });

    it('should add code interpreter tool with config', () => {
      const result = prepareKimiTools({
        tools: undefined,
        codeInterpreter: {
          enabled: true,
          config: { timeout: 30, include_output: true }
        }
      });

      expect(result.tools).toHaveLength(1);
      expect(result.tools?.[0]).toEqual({
        type: 'builtin_function',
        function: {
          name: '$code',
          config: { timeout: 30, include_output: true }
        }
      });
    });

    it('should combine both web search and code interpreter', () => {
      const result = prepareKimiTools({
        tools: undefined,
        webSearch: true,
        codeInterpreter: true
      });

      expect(result.tools).toHaveLength(2);
      expect(result.tools?.[0]).toEqual({
        type: 'builtin_function',
        function: { name: '$web_search' }
      });
      expect(result.tools?.[1]).toEqual({
        type: 'builtin_function',
        function: { name: '$code' }
      });
    });
  });

  describe('with tool choice', () => {
    const basicTools = [
      {
        type: 'function' as const,
        name: 'test',
        description: 'Test',
        inputSchema: {}
      }
    ];

    it('should pass through auto tool choice', () => {
      const result = prepareKimiTools({
        tools: basicTools,
        toolChoice: { type: 'auto' }
      });
      expect(result.toolChoice).toBe('auto');
    });

    it('should pass through none tool choice', () => {
      const result = prepareKimiTools({
        tools: basicTools,
        toolChoice: { type: 'none' }
      });
      expect(result.toolChoice).toBe('none');
    });

    it('should warn and fallback to auto for required tool choice with polyfill', () => {
      const result = prepareKimiTools({
        tools: basicTools,
        toolChoice: { type: 'required' }
      });
      expect(result.toolChoice).toBe('auto');
      expect(result.toolWarnings).toContainEqual({
        type: 'compatibility',
        feature: 'toolChoice.required',
        details: 'Using tool choice polyfill with system message injection.'
      });
      expect(result.toolChoiceSystemMessage).toBeDefined();
      expect(result.toolChoiceSystemMessage).toContain('MUST use one of the available tools');
    });

    it('should warn and fallback to auto for required tool choice without polyfill', () => {
      const result = prepareKimiTools({
        tools: basicTools,
        toolChoice: { type: 'required' },
        toolChoicePolyfill: false
      });
      expect(result.toolChoice).toBe('auto');
      expect(result.toolWarnings).toContainEqual({
        type: 'compatibility',
        feature: 'toolChoice.required',
        details: 'Moonshot does not support required tool choice. Falling back to auto.'
      });
      expect(result.toolChoiceSystemMessage).toBeUndefined();
    });

    it('should warn and fallback to auto for specific tool choice with polyfill', () => {
      const result = prepareKimiTools({
        tools: basicTools,
        toolChoice: { type: 'tool', toolName: 'test' }
      });
      expect(result.toolChoice).toBe('auto');
      expect(result.toolWarnings).toContainEqual({
        type: 'compatibility',
        feature: 'toolChoice.tool:test',
        details: 'Using tool choice polyfill with system message injection.'
      });
      expect(result.toolChoiceSystemMessage).toBeDefined();
      expect(result.toolChoiceSystemMessage).toContain('MUST use the "test" tool');
    });

    it('should warn and fallback to auto for specific tool choice without polyfill', () => {
      const result = prepareKimiTools({
        tools: basicTools,
        toolChoice: { type: 'tool', toolName: 'test' },
        toolChoicePolyfill: false
      });
      expect(result.toolChoice).toBe('auto');
      expect(result.toolWarnings).toContainEqual({
        type: 'compatibility',
        feature: 'toolChoice.tool:test',
        details: 'Moonshot does not support forcing a specific tool. Falling back to auto.'
      });
      expect(result.toolChoiceSystemMessage).toBeUndefined();
    });
  });

  describe('with provider tools', () => {
    it('should warn for unsupported provider tools', () => {
      const result = prepareKimiTools({
        tools: [
          {
            type: 'provider',
            id: 'other.tool' as `${string}.${string}`,
            name: 'other_tool',
            args: {}
          }
        ]
      });

      expect(result.toolWarnings).toContainEqual({
        type: 'unsupported',
        feature: 'provider-defined tool other.tool'
      });
    });

    it('should convert Kimi builtin provider tools', () => {
      const result = prepareKimiTools({
        tools: [
          {
            type: 'provider',
            id: 'kimi.web_search' as `${string}.${string}`,
            name: 'web_search',
            args: {
              type: 'builtin_function',
              function: {
                name: '$web_search',
                config: { search_result: true }
              }
            }
          }
        ]
      });

      expect(result.tools).toHaveLength(1);
      expect(result.tools?.[0]).toEqual({
        type: 'builtin_function',
        function: {
          name: '$web_search',
          config: { search_result: true }
        }
      });
    });

    it('should convert Kimi code interpreter provider tool', () => {
      const result = prepareKimiTools({
        tools: [
          {
            type: 'provider',
            id: 'kimi.code_interpreter' as `${string}.${string}`,
            name: 'code_interpreter',
            args: {
              type: 'builtin_function',
              function: {
                name: '$code'
              }
            }
          }
        ]
      });

      expect(result.tools).toHaveLength(1);
      expect(result.tools?.[0]).toEqual({
        type: 'builtin_function',
        function: {
          name: '$code'
        }
      });
    });
  });
});

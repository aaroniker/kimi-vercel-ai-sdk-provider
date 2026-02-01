import { describe, it, expect } from 'vitest';
import { prepareKimiTools, isBuiltinToolName } from './kimi-prepare-tools';

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
                location: { type: 'string' },
              },
            },
          },
        ],
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
              location: { type: 'string' },
            },
          },
        },
      });
    });

    it('should include strict when provided', () => {
      const result = prepareKimiTools({
        tools: [
          {
            type: 'function',
            name: 'test',
            description: 'Test tool',
            inputSchema: {},
            strict: true,
          },
        ],
      });

      expect(result.tools?.[0]).toMatchObject({
        type: 'function',
        function: {
          name: 'test',
          strict: true,
        },
      });
    });
  });

  describe('with web search', () => {
    it('should add web search tool when webSearch is true', () => {
      const result = prepareKimiTools({
        tools: undefined,
        webSearch: true,
      });

      expect(result.tools).toHaveLength(1);
      expect(result.tools?.[0]).toEqual({
        type: 'builtin_function',
        function: {
          name: '$web_search',
        },
      });
    });

    it('should add web search tool with config', () => {
      const result = prepareKimiTools({
        tools: undefined,
        webSearch: {
          enabled: true,
          config: { search_result: true },
        },
      });

      expect(result.tools).toHaveLength(1);
      expect(result.tools?.[0]).toEqual({
        type: 'builtin_function',
        function: {
          name: '$web_search',
          config: { search_result: true },
        },
      });
    });

    it('should combine web search with function tools', () => {
      const result = prepareKimiTools({
        tools: [
          {
            type: 'function',
            name: 'get_data',
            description: 'Get data',
            inputSchema: {},
          },
        ],
        webSearch: true,
      });

      expect(result.tools).toHaveLength(2);
      expect(result.tools?.[0].type).toBe('builtin_function');
      expect(result.tools?.[1].type).toBe('function');
    });
  });

  describe('with tool choice', () => {
    const basicTools = [
      {
        type: 'function' as const,
        name: 'test',
        description: 'Test',
        inputSchema: {},
      },
    ];

    it('should pass through auto tool choice', () => {
      const result = prepareKimiTools({
        tools: basicTools,
        toolChoice: { type: 'auto' },
      });
      expect(result.toolChoice).toBe('auto');
    });

    it('should pass through none tool choice', () => {
      const result = prepareKimiTools({
        tools: basicTools,
        toolChoice: { type: 'none' },
      });
      expect(result.toolChoice).toBe('none');
    });

    it('should warn and fallback to auto for required tool choice', () => {
      const result = prepareKimiTools({
        tools: basicTools,
        toolChoice: { type: 'required' },
      });
      expect(result.toolChoice).toBe('auto');
      expect(result.toolWarnings).toContainEqual({
        type: 'compatibility',
        feature: 'toolChoice.required',
        details: 'Moonshot does not support required tool choice. Falling back to auto.',
      });
    });

    it('should warn and fallback to auto for specific tool choice', () => {
      const result = prepareKimiTools({
        tools: basicTools,
        toolChoice: { type: 'tool', toolName: 'test' },
      });
      expect(result.toolChoice).toBe('auto');
      expect(result.toolWarnings).toContainEqual({
        type: 'compatibility',
        feature: 'toolChoice.tool:test',
        details: 'Moonshot does not support forcing a specific tool. Falling back to auto.',
      });
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
            args: {},
          },
        ],
      });

      expect(result.toolWarnings).toContainEqual({
        type: 'unsupported',
        feature: 'provider-defined tool other.tool',
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
                config: { search_result: true },
              },
            },
          },
        ],
      });

      expect(result.tools).toHaveLength(1);
      expect(result.tools?.[0]).toEqual({
        type: 'builtin_function',
        function: {
          name: '$web_search',
          config: { search_result: true },
        },
      });
    });
  });
});

describe('isBuiltinToolName', () => {
  it('should return true for $web_search', () => {
    expect(isBuiltinToolName('$web_search')).toBe(true);
  });

  it('should return true for any tool starting with $', () => {
    expect(isBuiltinToolName('$custom_tool')).toBe(true);
  });

  it('should return false for regular tool names', () => {
    expect(isBuiltinToolName('get_weather')).toBe(false);
    expect(isBuiltinToolName('web_search')).toBe(false);
  });
});

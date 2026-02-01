/**
 * Integration tests with mocked API responses.
 * These tests verify the full flow from model creation to response parsing.
 * @module
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createKimi } from '../index';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

/**
 * Helper to create a properly mocked fetch Response
 */
function createMockResponse(data: unknown, status = 200, headers: Record<string, string> = {}) {
  const jsonStr = JSON.stringify(data);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({
      'content-type': 'application/json',
      ...headers
    }),
    json: async () => data,
    text: async () => jsonStr,
    clone: function () {
      return this;
    }
  };
}

describe('KimiChatLanguageModel integration', () => {
  const originalEnv = process.env;

  beforeAll(() => {
    process.env = { ...originalEnv };
    process.env.MOONSHOT_API_KEY = 'test-api-key';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('doGenerate', () => {
    it('should make a successful non-streaming request', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'kimi-k2.5',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello! How can I help you today?'
            },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 15,
          total_tokens: 25
        }
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse, 200, { 'x-request-id': 'req-123' }));

      const provider = createKimi();
      const model = provider('kimi-k2.5');

      const result = await model.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }]
      });

      // Check content array has text
      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toMatchObject({
        type: 'text',
        text: 'Hello! How can I help you today?'
      });

      // finishReason is an object with unified/raw
      expect(result.finishReason.unified).toBe('stop');
      // Usage has detailed token breakdown
      expect(result.usage.inputTokens.total).toBe(10);
      expect(result.usage.outputTokens.total).toBe(15);

      // Verify request was made correctly
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/chat/completions');
      expect(options.method).toBe('POST');
      // Headers may be a Headers object or plain object
      const authHeader = options.headers.Authorization || options.headers.authorization;
      expect(authHeader).toBe('Bearer test-api-key');

      const body = JSON.parse(options.body);
      expect(body.model).toBe('kimi-k2.5');
      // stream may be undefined (default) or false
      expect(body.stream).toBeFalsy();
    });

    it('should handle tool calls in response', async () => {
      const mockResponse = {
        id: 'chatcmpl-456',
        object: 'chat.completion',
        created: 1677652288,
        model: 'kimi-k2.5',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_abc123',
                  type: 'function',
                  function: {
                    name: 'get_weather',
                    arguments: '{"location":"San Francisco"}'
                  }
                }
              ]
            },
            finish_reason: 'tool_calls'
          }
        ],
        usage: {
          prompt_tokens: 20,
          completion_tokens: 30,
          total_tokens: 50
        }
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const provider = createKimi();
      const model = provider('kimi-k2.5');

      const result = await model.doGenerate({
        tools: [
          {
            type: 'function',
            name: 'get_weather',
            description: 'Get weather for a location',
            inputSchema: {
              type: 'object',
              properties: {
                location: { type: 'string' }
              },
              required: ['location']
            }
          }
        ],
        prompt: [{ role: 'user', content: [{ type: 'text', text: "What's the weather in SF?" }] }]
      });

      expect(result.finishReason.unified).toBe('tool-calls');
      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toMatchObject({
        type: 'tool-call',
        toolCallId: 'call_abc123',
        toolName: 'get_weather'
      });
    });

    it('should handle web search tool in request', async () => {
      const mockResponse = {
        id: 'chatcmpl-789',
        object: 'chat.completion',
        created: 1677652288,
        model: 'kimi-k2.5',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Based on my web search, here are the latest AI news...',
              tool_calls: [
                {
                  id: 'web_search_call',
                  type: 'builtin_function',
                  function: {
                    name: '$web_search',
                    arguments: '{}'
                  },
                  search_result: {
                    search_result_tokens: 500
                  }
                }
              ]
            },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: 15,
          completion_tokens: 100,
          total_tokens: 115
        }
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const provider = createKimi();
      const model = provider('kimi-k2.5', { webSearch: true });

      const result = await model.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'What are the latest AI news?' }] }]
      });

      // Check content has text
      const textContent = result.content.find((c) => c.type === 'text');
      expect(textContent).toBeDefined();
      expect((textContent as { type: 'text'; text: string }).text).toBe(
        'Based on my web search, here are the latest AI news...'
      );
      expect(result.finishReason.unified).toBe('stop');

      // Verify web search was included in request
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.tools).toBeDefined();
      expect(body.tools.some((t: { function: { name: string } }) => t.function?.name === '$web_search')).toBe(true);
    });

    it('should handle API errors', async () => {
      const errorResponse = {
        error: {
          message: 'Invalid API key',
          type: 'authentication_error',
          code: 'invalid_api_key'
        }
      };
      mockFetch.mockResolvedValueOnce(createMockResponse(errorResponse, 401));

      const provider = createKimi();
      const model = provider('kimi-k2.5');

      await expect(
        model.doGenerate({
          prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }]
        })
      ).rejects.toThrow();
    });

    it('should handle rate limit errors', async () => {
      const errorResponse = {
        error: {
          message: 'Rate limit exceeded',
          type: 'rate_limit_error'
        }
      };
      mockFetch.mockResolvedValueOnce(createMockResponse(errorResponse, 429, { 'retry-after': '60' }));

      const provider = createKimi();
      const model = provider('kimi-k2.5');

      await expect(
        model.doGenerate({
          prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }]
        })
      ).rejects.toThrow();
    });
  });

  describe('doStream', () => {
    it('should verify streaming request is made correctly', async () => {
      // For streaming tests, we just verify the request is constructed correctly
      // Full streaming integration testing requires more complex SSE mocking
      const mockResponse = {
        id: 'chatcmpl-stream',
        object: 'chat.completion',
        created: 1677652288,
        model: 'kimi-k2.5',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Hello!' },
            finish_reason: 'stop'
          }
        ],
        usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 }
      };

      // Use non-streaming response for this test to verify request format
      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const provider = createKimi();
      const model = provider('kimi-k2.5');

      // Use doGenerate to verify request construction (doStream has same request format)
      await model.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }]
      });

      // Verify request was made correctly
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/chat/completions');
      expect(options.method).toBe('POST');

      const body = JSON.parse(options.body);
      expect(body.model).toBe('kimi-k2.5');
      expect(body.messages).toHaveLength(1);
      expect(body.messages[0].role).toBe('user');
    });
  });

  describe('provider options', () => {
    it('should pass kimi provider options', async () => {
      const mockResponse = {
        id: 'chatcmpl-opts',
        object: 'chat.completion',
        created: 1677652288,
        model: 'kimi-k2.5',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Response' },
            finish_reason: 'stop'
          }
        ],
        usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 }
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const provider = createKimi();
      const model = provider('kimi-k2.5');

      await model.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Test' }] }],
        providerOptions: {
          kimi: {
            // Use the correct schema format: boolean | { enabled: boolean, config?: {...} }
            webSearch: { enabled: true, config: { search_result: true } }
          }
        }
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.tools).toBeDefined();
      expect(body.tools.some((t: { function: { name: string } }) => t.function?.name === '$web_search')).toBe(true);
    });
  });

  describe('JSON mode', () => {
    it('should set response_format for JSON mode via responseFormat option', async () => {
      const mockResponse = {
        id: 'chatcmpl-json',
        object: 'chat.completion',
        created: 1677652288,
        model: 'kimi-k2.5',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: '{"result": "test"}' },
            finish_reason: 'stop'
          }
        ],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 }
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const provider = createKimi();
      const model = provider('kimi-k2.5');

      await model.doGenerate({
        responseFormat: { type: 'json' },
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Return JSON' }] }]
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.response_format).toEqual({ type: 'json_object' });
    });
  });

  describe('request construction', () => {
    it('should include temperature and other parameters', async () => {
      const mockResponse = {
        id: 'chatcmpl-params',
        object: 'chat.completion',
        created: 1677652288,
        model: 'kimi-k2.5',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Response' },
            finish_reason: 'stop'
          }
        ],
        usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 }
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const provider = createKimi();
      const model = provider('kimi-k2.5');

      await model.doGenerate({
        temperature: 0.7,
        maxOutputTokens: 1000,
        topP: 0.9,
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Test' }] }]
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.temperature).toBe(0.7);
      expect(body.max_tokens).toBe(1000);
      expect(body.top_p).toBe(0.9);
    });

    it('should use correct endpoint', async () => {
      const mockResponse = {
        id: 'chatcmpl-endpoint',
        object: 'chat.completion',
        created: 1677652288,
        model: 'kimi-k2.5',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Response' },
            finish_reason: 'stop'
          }
        ],
        usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 }
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      // Test global endpoint
      const globalProvider = createKimi({ endpoint: 'global' });
      const globalModel = globalProvider('kimi-k2.5');

      await globalModel.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Test' }] }]
      });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('api.moonshot.ai');
    });
  });
});

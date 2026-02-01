import type { LanguageModelV3StreamPart } from '@ai-sdk/provider';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createKimiCode } from '../code';

// Mock fetch for API testing
const mockFetch = vi.fn();

async function readStreamParts<T>(stream: ReadableStream<T>) {
  const reader = stream.getReader();
  const parts: T[] = [];

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    if (value !== undefined) {
      parts.push(value);
    }
  }

  return parts;
}

describe('KimiCodeLanguageModel Integration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv };
    process.env.KIMI_CODE_API_KEY = 'sk-test-key';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('doGenerate', () => {
    it('should make correct API request', async () => {
      const mockResponse = {
        id: 'msg_123',
        type: 'message',
        model: 'kimi-for-coding',
        content: [{ type: 'text', text: 'Hello!' }],
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 10,
          output_tokens: 5
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'content-type': 'application/json',
          'x-request-id': 'req-123'
        }),
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse)
      });

      const provider = createKimiCode({
        apiKey: 'sk-test-key',
        fetch: mockFetch
      });
      const model = provider('kimi-for-coding');

      const result = await model.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }]
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];

      expect(url).toBe('https://api.kimi.com/coding/v1/messages');
      expect(options.method).toBe('POST');
      expect(options.headers['x-api-key']).toBe('sk-test-key');
      expect(options.headers['anthropic-version']).toBe('2023-06-01');

      const body = JSON.parse(options.body);
      expect(body.model).toBe('kimi-for-coding');
      expect(body.messages).toEqual([{ role: 'user', content: 'Hello' }]);

      expect(result.content).toEqual([{ type: 'text', text: 'Hello!' }]);
      expect(result.finishReason.unified).toBe('stop');
      expect(result.usage.inputTokens.total).toBe(10);
      expect(result.usage.outputTokens.total).toBe(5);
    });

    it('should handle thinking blocks in response', async () => {
      const mockResponse = {
        id: 'msg_123',
        type: 'message',
        model: 'kimi-k2-thinking',
        content: [
          { type: 'thinking', thinking: 'Let me think about this...' },
          { type: 'text', text: 'The answer is 42.' }
        ],
        stop_reason: 'end_turn',
        usage: { input_tokens: 20, output_tokens: 30 }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse)
      });

      const provider = createKimiCode({
        apiKey: 'sk-test-key',
        fetch: mockFetch
      });
      const model = provider('kimi-k2-thinking', {
        extendedThinking: { enabled: true, effort: 'medium' }
      });

      const result = await model.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'What is the meaning of life?' }] }]
      });

      expect(result.content).toHaveLength(2);
      expect(result.content[0]).toEqual({
        type: 'reasoning',
        text: 'Let me think about this...'
      });
      expect(result.content[1]).toEqual({
        type: 'text',
        text: 'The answer is 42.'
      });
    });

    it('should handle tool use in response', async () => {
      const mockResponse = {
        id: 'msg_123',
        type: 'message',
        model: 'kimi-for-coding',
        content: [
          {
            type: 'tool_use',
            id: 'tool_123',
            name: 'read_file',
            input: { path: '/src/index.ts' }
          }
        ],
        stop_reason: 'tool_use',
        usage: { input_tokens: 15, output_tokens: 25 }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse)
      });

      const provider = createKimiCode({
        apiKey: 'sk-test-key',
        fetch: mockFetch
      });
      const model = provider('kimi-for-coding');

      const result = await model.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Read the index file' }] }],

        tools: [
          {
            type: 'function',
            name: 'read_file',
            description: 'Read a file',
            inputSchema: {
              type: 'object',
              properties: { path: { type: 'string' } }
            }
          }
        ]
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toEqual({
        type: 'tool-call',
        toolCallId: 'tool_123',
        toolName: 'read_file',
        input: JSON.stringify({ path: '/src/index.ts' })
      });
      expect(result.finishReason.unified).toBe('tool-calls');
    });

    it('should send thinking parameter when enabled', async () => {
      const mockResponse = {
        id: 'msg_123',
        type: 'message',
        model: 'kimi-for-coding',
        content: [{ type: 'text', text: 'Done!' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 5 }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse)
      });

      const provider = createKimiCode({
        apiKey: 'sk-test-key',
        fetch: mockFetch
      });
      const model = provider('kimi-for-coding', {
        extendedThinking: { enabled: true, effort: 'high' }
      });

      await model.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Think hard' }] }]
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.thinking).toEqual({
        type: 'enabled',
        budget_tokens: 16384
      });
    });

    it('should handle cache token usage', async () => {
      const mockResponse = {
        id: 'msg_123',
        type: 'message',
        model: 'kimi-for-coding',
        content: [{ type: 'text', text: 'Cached response!' }],
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 100,
          output_tokens: 20,
          cache_read_input_tokens: 80,
          cache_creation_input_tokens: 10
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse)
      });

      const provider = createKimiCode({
        apiKey: 'sk-test-key',
        fetch: mockFetch
      });
      const model = provider('kimi-for-coding');

      const result = await model.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Test' }] }]
      });

      expect(result.usage.inputTokens.total).toBe(100);
      expect(result.usage.inputTokens.cacheRead).toBe(80);
      expect(result.usage.inputTokens.cacheWrite).toBe(10);
      expect(result.usage.inputTokens.noCache).toBe(20);
    });

    it('should handle API errors', async () => {
      const errorResponse = {
        error: {
          type: 'invalid_request_error',
          message: 'Invalid API key'
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => errorResponse,
        text: async () => JSON.stringify(errorResponse)
      });

      const provider = createKimiCode({
        apiKey: 'sk-invalid-key',
        fetch: mockFetch
      });
      const model = provider('kimi-for-coding');

      await expect(
        model.doGenerate({
          prompt: [{ role: 'user', content: [{ type: 'text', text: 'Test' }] }]
        })
      ).rejects.toThrow('Invalid API key');
    });

    it('should handle max_tokens stop reason', async () => {
      const mockResponse = {
        id: 'msg_123',
        type: 'message',
        model: 'kimi-for-coding',
        content: [{ type: 'text', text: 'Truncated...' }],
        stop_reason: 'max_tokens',
        usage: { input_tokens: 10, output_tokens: 100 }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse)
      });

      const provider = createKimiCode({
        apiKey: 'sk-test-key',
        fetch: mockFetch
      });
      const model = provider('kimi-for-coding');

      const result = await model.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Write a long story' }] }],

        maxOutputTokens: 100
      });

      expect(result.finishReason.unified).toBe('length');
    });
  });

  describe('doStream', () => {
    it('should handle streaming response', async () => {
      // Create a mock SSE stream
      const events = [
        'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_123","type":"message","model":"kimi-for-coding","content":[],"usage":{"input_tokens":10}}}\n\n',
        'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
        'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}\n\n',
        'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" World!"}}\n\n',
        'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n',
        'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":5}}\n\n',
        'event: message_stop\ndata: {"type":"message_stop"}\n\n'
      ];

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          for (const event of events) {
            controller.enqueue(encoder.encode(event));
          }
          controller.close();
        }
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        body: stream
      });

      const provider = createKimiCode({
        apiKey: 'sk-test-key',
        fetch: mockFetch
      });
      const model = provider('kimi-for-coding');

      const result = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Say hello' }] }]
      });

      const parts = await readStreamParts<LanguageModelV3StreamPart>(result.stream);

      // Verify streaming worked
      expect(parts.length).toBeGreaterThan(0);

      // Check for expected part types
      const partTypes = parts.map((p) => p.type);
      expect(partTypes).toContain('stream-start');
      expect(partTypes).toContain('response-metadata');
      expect(partTypes).toContain('text-start');
      expect(partTypes).toContain('text-delta');
      expect(partTypes).toContain('text-end');
      expect(partTypes).toContain('finish');
    });

    it('should handle thinking blocks in stream', async () => {
      const events = [
        'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_123","type":"message","model":"kimi-k2-thinking","content":[],"usage":{"input_tokens":10}}}\n\n',
        'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"thinking","thinking":""}}\n\n',
        'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"Thinking..."}}\n\n',
        'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n',
        'event: content_block_start\ndata: {"type":"content_block_start","index":1,"content_block":{"type":"text","text":""}}\n\n',
        'event: content_block_delta\ndata: {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"Answer!"}}\n\n',
        'event: content_block_stop\ndata: {"type":"content_block_stop","index":1}\n\n',
        'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":10}}\n\n',
        'event: message_stop\ndata: {"type":"message_stop"}\n\n'
      ];

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          for (const event of events) {
            controller.enqueue(encoder.encode(event));
          }
          controller.close();
        }
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        body: stream
      });

      const provider = createKimiCode({
        apiKey: 'sk-test-key',
        fetch: mockFetch
      });
      const model = provider('kimi-k2-thinking');

      const result = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Think about this' }] }]
      });

      const parts = await readStreamParts<LanguageModelV3StreamPart>(result.stream);

      const partTypes = parts.map((p) => p.type);
      expect(partTypes).toContain('reasoning-start');
      expect(partTypes).toContain('reasoning-delta');
      expect(partTypes).toContain('reasoning-end');
      expect(partTypes).toContain('text-start');
      expect(partTypes).toContain('text-delta');
      expect(partTypes).toContain('text-end');
    });

    it('should handle tool calls in stream', async () => {
      const events = [
        'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_123","type":"message","model":"kimi-for-coding","content":[],"usage":{"input_tokens":10}}}\n\n',
        'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"tool_123","name":"read_file"}}\n\n',
        'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"path\\":"}}\n\n',
        'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"\\"/src/index.ts\\"}"}}\n\n',
        'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n',
        'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":15}}\n\n',
        'event: message_stop\ndata: {"type":"message_stop"}\n\n'
      ];

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          for (const event of events) {
            controller.enqueue(encoder.encode(event));
          }
          controller.close();
        }
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        body: stream
      });

      const provider = createKimiCode({
        apiKey: 'sk-test-key',
        fetch: mockFetch
      });
      const model = provider('kimi-for-coding');

      const result = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Read the file' }] }],

        tools: [
          {
            type: 'function',
            name: 'read_file',
            description: 'Read a file',
            inputSchema: { type: 'object', properties: { path: { type: 'string' } } }
          }
        ]
      });

      const parts = await readStreamParts<LanguageModelV3StreamPart>(result.stream);

      const partTypes = parts.map((p) => p.type);
      expect(partTypes).toContain('tool-input-start');
      expect(partTypes).toContain('tool-input-delta');
      expect(partTypes).toContain('tool-input-end');
      expect(partTypes).toContain('tool-call');

      const toolCallPart = parts.find(
        (p): p is Extract<LanguageModelV3StreamPart, { type: 'tool-call' }> => p.type === 'tool-call'
      );
      expect(toolCallPart).toBeDefined();
      expect(toolCallPart?.toolName).toBe('read_file');
      expect(toolCallPart?.input).toContain('/src/index.ts');
    });
  });

  describe('request headers', () => {
    it('should include Anthropic version header', async () => {
      const mockResponse = {
        id: 'msg_123',
        type: 'message',
        model: 'kimi-for-coding',
        content: [{ type: 'text', text: 'OK' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 5, output_tokens: 2 }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse)
      });

      const provider = createKimiCode({
        apiKey: 'sk-test-key',
        fetch: mockFetch
      });
      const model = provider('kimi-for-coding');

      await model.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Test' }] }]
      });

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['anthropic-version']).toBe('2023-06-01');
    });

    it('should include custom headers', async () => {
      const mockResponse = {
        id: 'msg_123',
        type: 'message',
        model: 'kimi-for-coding',
        content: [{ type: 'text', text: 'OK' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 5, output_tokens: 2 }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse)
      });

      const provider = createKimiCode({
        apiKey: 'sk-test-key',
        headers: { 'x-custom-header': 'custom-value' },
        fetch: mockFetch
      });
      const model = provider('kimi-for-coding');

      await model.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Test' }] }]
      });

      const headers = mockFetch.mock.calls[0][1].headers;
      // Custom headers are passed through provider headers option
      expect(headers['x-custom-header']).toBe('custom-value');
    });
  });
});

import { describe, expect, it } from 'vitest';
import {
  convertKimiUsage,
  convertToKimiChatMessages,
  extractCodeInterpreterTokens,
  extractMessageContent,
  extractWebSearchTokens,
  getKimiRequestId,
  inferModelCapabilities,
  mapKimiFinishReason
} from '../chat';

describe('inferModelCapabilities', () => {
  it('should detect thinking model', () => {
    const caps = inferModelCapabilities('kimi-k2.5-thinking');
    expect(caps.thinking).toBe(true);
    expect(caps.alwaysThinking).toBe(true);
  });

  it('should detect K2.5 model video support', () => {
    const caps = inferModelCapabilities('kimi-k2.5');
    expect(caps.videoInput).toBe(true);
  });

  it('should not enable video for K2 models', () => {
    const caps = inferModelCapabilities('kimi-k2-turbo');
    expect(caps.videoInput).toBe(false);
  });

  it('should enable image input for all models', () => {
    expect(inferModelCapabilities('kimi-k2.5').imageInput).toBe(true);
    expect(inferModelCapabilities('kimi-k2-turbo').imageInput).toBe(true);
    expect(inferModelCapabilities('custom-model').imageInput).toBe(true);
  });

  it('should handle k2-5 variant', () => {
    const caps = inferModelCapabilities('kimi-k2-5-thinking');
    expect(caps.videoInput).toBe(true);
    expect(caps.thinking).toBe(true);
  });
});

describe('convertToKimiChatMessages', () => {
  it('should convert system message', () => {
    const result = convertToKimiChatMessages([{ role: 'system', content: 'You are a helpful assistant.' }]);

    expect(result).toEqual([{ role: 'system', content: 'You are a helpful assistant.' }]);
  });

  it('should convert simple user message', () => {
    const result = convertToKimiChatMessages([{ role: 'user', content: [{ type: 'text', text: 'Hello!' }] }]);

    expect(result).toEqual([{ role: 'user', content: 'Hello!' }]);
  });

  it('should convert user message with image URL', () => {
    const result = convertToKimiChatMessages([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'What is in this image?' },
          {
            type: 'file',
            mediaType: 'image/png',
            data: new URL('https://example.com/image.png')
          }
        ]
      }
    ]);

    expect(result).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'What is in this image?' },
          { type: 'image_url', image_url: { url: 'https://example.com/image.png' } }
        ]
      }
    ]);
  });

  it('should convert assistant message with text', () => {
    const result = convertToKimiChatMessages([
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello, how can I help?' }]
      }
    ]);

    expect(result).toEqual([
      {
        role: 'assistant',
        content: 'Hello, how can I help?'
      }
    ]);
  });

  it('should convert assistant message with reasoning', () => {
    const result = convertToKimiChatMessages([
      {
        role: 'assistant',
        content: [
          { type: 'reasoning', text: 'Let me think about this...' },
          { type: 'text', text: 'The answer is 42.' }
        ]
      }
    ]);

    expect(result).toEqual([
      {
        role: 'assistant',
        content: 'The answer is 42.',
        reasoning_content: 'Let me think about this...'
      }
    ]);
  });

  it('should convert assistant message with tool calls', () => {
    const result = convertToKimiChatMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call_123',
            toolName: 'get_weather',
            input: { location: 'Tokyo' }
          }
        ]
      }
    ]);

    expect(result).toEqual([
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'call_123',
            type: 'function',
            function: {
              name: 'get_weather',
              arguments: '{"location":"Tokyo"}'
            }
          }
        ]
      }
    ]);
  });

  it('should convert tool result message', () => {
    const result = convertToKimiChatMessages([
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call_123',
            toolName: 'get_weather',
            output: { type: 'text', value: 'Sunny, 25C' }
          }
        ]
      }
    ]);

    expect(result).toEqual([
      {
        role: 'tool',
        tool_call_id: 'call_123',
        content: 'Sunny, 25C'
      }
    ]);
  });
});

describe('mapKimiFinishReason', () => {
  it('should map stop', () => {
    expect(mapKimiFinishReason('stop')).toBe('stop');
  });

  it('should map length', () => {
    expect(mapKimiFinishReason('length')).toBe('length');
  });

  it('should map content_filter', () => {
    expect(mapKimiFinishReason('content_filter')).toBe('content-filter');
  });

  it('should map tool_calls', () => {
    expect(mapKimiFinishReason('tool_calls')).toBe('tool-calls');
  });

  it('should map function_call', () => {
    expect(mapKimiFinishReason('function_call')).toBe('tool-calls');
  });

  it('should map unknown to other', () => {
    expect(mapKimiFinishReason('unknown')).toBe('other');
    expect(mapKimiFinishReason(null)).toBe('other');
    expect(mapKimiFinishReason(undefined)).toBe('other');
  });
});

describe('convertKimiUsage', () => {
  it('should handle null usage', () => {
    const result = convertKimiUsage(null);
    expect(result.inputTokens.total).toBeUndefined();
    expect(result.outputTokens.total).toBeUndefined();
  });

  it('should convert basic usage', () => {
    const result = convertKimiUsage({
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150
    });

    expect(result.inputTokens.total).toBe(100);
    expect(result.outputTokens.total).toBe(50);
  });

  it('should handle cached tokens', () => {
    const result = convertKimiUsage({
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
      prompt_tokens_details: { cached_tokens: 30 }
    });

    expect(result.inputTokens.total).toBe(100);
    expect(result.inputTokens.cacheRead).toBe(30);
    expect(result.inputTokens.noCache).toBe(70);
  });

  it('should handle reasoning tokens', () => {
    const result = convertKimiUsage({
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
      completion_tokens_details: { reasoning_tokens: 20 }
    });

    expect(result.outputTokens.total).toBe(50);
    expect(result.outputTokens.reasoning).toBe(20);
    expect(result.outputTokens.text).toBe(30);
  });

  it('should include web search tokens when provided', () => {
    const result = convertKimiUsage({ prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }, 500);

    expect(result.webSearchTokens).toBe(500);
  });

  it('should include code interpreter tokens when provided', () => {
    const result = convertKimiUsage({ prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }, undefined, 300);

    expect(result.codeInterpreterTokens).toBe(300);
  });
});

describe('extractWebSearchTokens', () => {
  it('should return undefined for null tool calls', () => {
    expect(extractWebSearchTokens(null)).toBeUndefined();
  });

  it('should return undefined when no web search tool', () => {
    expect(extractWebSearchTokens([{ function: { name: 'other_tool', arguments: '{}' } }])).toBeUndefined();
  });

  it('should extract tokens from web search tool', () => {
    const result = extractWebSearchTokens([
      {
        function: {
          name: '$web_search',
          arguments: JSON.stringify({ total_tokens: 500 })
        }
      }
    ]);
    expect(result).toBe(500);
  });

  it('should sum tokens from multiple web search calls', () => {
    const result = extractWebSearchTokens([
      {
        function: {
          name: '$web_search',
          arguments: JSON.stringify({ total_tokens: 200 })
        }
      },
      {
        function: {
          name: '$web_search',
          arguments: JSON.stringify({ total_tokens: 300 })
        }
      }
    ]);
    expect(result).toBe(500);
  });
});

describe('extractCodeInterpreterTokens', () => {
  it('should return undefined for null tool calls', () => {
    expect(extractCodeInterpreterTokens(null)).toBeUndefined();
  });

  it('should return undefined when no code interpreter tool', () => {
    expect(extractCodeInterpreterTokens([{ function: { name: 'other_tool', arguments: '{}' } }])).toBeUndefined();
  });

  it('should extract tokens from code interpreter tool', () => {
    const result = extractCodeInterpreterTokens([
      {
        function: {
          name: '$code',
          arguments: JSON.stringify({ total_tokens: 300 })
        }
      }
    ]);
    expect(result).toBe(300);
  });
});

describe('getKimiRequestId', () => {
  it('should return undefined for undefined headers', () => {
    expect(getKimiRequestId(undefined)).toBeUndefined();
  });

  it('should extract x-request-id', () => {
    expect(getKimiRequestId({ 'x-request-id': 'req_123' })).toBe('req_123');
  });

  it('should extract X-Request-ID (case insensitive)', () => {
    expect(getKimiRequestId({ 'X-Request-ID': 'req_456' })).toBe('req_456');
  });

  it('should extract x-trace-id', () => {
    expect(getKimiRequestId({ 'x-trace-id': 'trace_789' })).toBe('trace_789');
  });

  it('should extract x-moonshot-request-id', () => {
    expect(getKimiRequestId({ 'x-moonshot-request-id': 'moonshot_abc' })).toBe('moonshot_abc');
  });
});

describe('extractMessageContent', () => {
  it('should extract string content', () => {
    const result = extractMessageContent({ content: 'Hello!' });
    expect(result.text).toBe('Hello!');
    expect(result.reasoning).toBe('');
  });

  it('should extract text from array content', () => {
    const result = extractMessageContent({
      content: [{ type: 'text', text: 'Hello!' }]
    });
    expect(result.text).toBe('Hello!');
  });

  it('should extract reasoning_content', () => {
    const result = extractMessageContent({
      content: 'Answer',
      reasoning_content: 'Thinking...'
    });
    expect(result.text).toBe('Answer');
    expect(result.reasoning).toBe('Thinking...');
  });

  it('should extract reasoning field', () => {
    const result = extractMessageContent({
      content: 'Answer',
      reasoning: 'Reasoning...'
    });
    expect(result.reasoning).toBe('Reasoning...');
  });

  it('should handle thinking type in array', () => {
    const result = extractMessageContent({
      content: [
        { type: 'thinking', thinking: 'Let me think...' },
        { type: 'text', text: 'The answer is 42.' }
      ]
    });
    expect(result.reasoning).toBe('Let me think...');
    expect(result.text).toBe('The answer is 42.');
  });
});

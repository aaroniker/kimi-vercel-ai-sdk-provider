import { describe, it, expect } from 'vitest';
import {
  mapKimiFinishReason,
  convertKimiUsage,
  getResponseMetadata,
  getKimiRequestId,
  extractWebSearchTokens,
} from './kimi-response';

describe('mapKimiFinishReason', () => {
  it('should map stop to stop', () => {
    expect(mapKimiFinishReason('stop')).toBe('stop');
  });

  it('should map length to length', () => {
    expect(mapKimiFinishReason('length')).toBe('length');
  });

  it('should map content_filter to content-filter', () => {
    expect(mapKimiFinishReason('content_filter')).toBe('content-filter');
  });

  it('should map tool_calls to tool-calls', () => {
    expect(mapKimiFinishReason('tool_calls')).toBe('tool-calls');
  });

  it('should map function_call to tool-calls', () => {
    expect(mapKimiFinishReason('function_call')).toBe('tool-calls');
  });

  it('should map unknown reasons to other', () => {
    expect(mapKimiFinishReason('unknown')).toBe('other');
  });

  it('should map null to other', () => {
    expect(mapKimiFinishReason(null)).toBe('other');
  });

  it('should map undefined to other', () => {
    expect(mapKimiFinishReason(undefined)).toBe('other');
  });
});

describe('convertKimiUsage', () => {
  it('should handle null usage', () => {
    const result = convertKimiUsage(null);

    expect(result.inputTokens.total).toBeUndefined();
    expect(result.outputTokens.total).toBeUndefined();
    expect(result.raw).toBeUndefined();
  });

  it('should handle undefined usage', () => {
    const result = convertKimiUsage(undefined);

    expect(result.inputTokens.total).toBeUndefined();
    expect(result.outputTokens.total).toBeUndefined();
  });

  it('should convert basic token counts', () => {
    const result = convertKimiUsage({
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
    });

    expect(result.inputTokens.total).toBe(100);
    expect(result.outputTokens.total).toBe(50);
  });

  it('should calculate noCache tokens', () => {
    const result = convertKimiUsage({
      prompt_tokens: 100,
      completion_tokens: 50,
      prompt_tokens_details: {
        cached_tokens: 30,
      },
    });

    expect(result.inputTokens.total).toBe(100);
    expect(result.inputTokens.cacheRead).toBe(30);
    expect(result.inputTokens.noCache).toBe(70);
  });

  it('should extract reasoning tokens', () => {
    const result = convertKimiUsage({
      prompt_tokens: 100,
      completion_tokens: 50,
      completion_tokens_details: {
        reasoning_tokens: 20,
      },
    });

    expect(result.outputTokens.total).toBe(50);
    expect(result.outputTokens.reasoning).toBe(20);
    expect(result.outputTokens.text).toBe(30);
  });

  it('should include web search tokens when provided', () => {
    const result = convertKimiUsage(
      {
        prompt_tokens: 100,
        completion_tokens: 50,
      },
      1500,
    );

    expect(result.webSearchTokens).toBe(1500);
  });

  it('should not include web search tokens when not provided', () => {
    const result = convertKimiUsage({
      prompt_tokens: 100,
      completion_tokens: 50,
    });

    expect(result.webSearchTokens).toBeUndefined();
  });

  it('should include raw usage data', () => {
    const usage = {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
    };

    const result = convertKimiUsage(usage);

    expect(result.raw).toEqual({
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
    });
  });
});

describe('getResponseMetadata', () => {
  it('should extract id', () => {
    const result = getResponseMetadata({ id: 'resp-123' });
    expect(result.id).toBe('resp-123');
  });

  it('should extract model', () => {
    const result = getResponseMetadata({ model: 'kimi-k2.5' });
    expect(result.modelId).toBe('kimi-k2.5');
  });

  it('should convert created timestamp to Date', () => {
    const timestamp = 1700000000;
    const result = getResponseMetadata({ created: timestamp });
    expect(result.timestamp).toEqual(new Date(timestamp * 1000));
  });

  it('should handle null values', () => {
    const result = getResponseMetadata({
      id: null,
      model: null,
      created: null,
    });

    expect(result.id).toBeUndefined();
    expect(result.modelId).toBeUndefined();
    expect(result.timestamp).toBeUndefined();
  });
});

describe('getKimiRequestId', () => {
  it('should return undefined for no headers', () => {
    expect(getKimiRequestId()).toBeUndefined();
    expect(getKimiRequestId(undefined)).toBeUndefined();
  });

  it('should extract x-request-id', () => {
    expect(getKimiRequestId({ 'x-request-id': 'req-123' })).toBe('req-123');
  });

  it('should extract X-Request-ID (case insensitive)', () => {
    expect(getKimiRequestId({ 'X-Request-ID': 'req-123' })).toBe('req-123');
  });

  it('should extract x-trace-id', () => {
    expect(getKimiRequestId({ 'x-trace-id': 'trace-456' })).toBe('trace-456');
  });

  it('should extract x-moonshot-request-id', () => {
    expect(getKimiRequestId({ 'x-moonshot-request-id': 'moon-789' })).toBe(
      'moon-789',
    );
  });

  it('should prefer x-request-id over others', () => {
    expect(
      getKimiRequestId({
        'x-request-id': 'req-123',
        'x-trace-id': 'trace-456',
      }),
    ).toBe('req-123');
  });
});

describe('extractWebSearchTokens', () => {
  it('should return undefined for null tool calls', () => {
    expect(extractWebSearchTokens(null)).toBeUndefined();
  });

  it('should return undefined for undefined tool calls', () => {
    expect(extractWebSearchTokens(undefined)).toBeUndefined();
  });

  it('should return undefined for empty tool calls', () => {
    expect(extractWebSearchTokens([])).toBeUndefined();
  });

  it('should return undefined when no $web_search tool', () => {
    const result = extractWebSearchTokens([
      {
        function: { name: 'get_weather', arguments: '{}' },
      },
    ]);
    expect(result).toBeUndefined();
  });

  it('should extract tokens from $web_search tool', () => {
    const result = extractWebSearchTokens([
      {
        function: {
          name: '$web_search',
          arguments: JSON.stringify({ total_tokens: 1500 }),
        },
      },
    ]);
    expect(result).toBe(1500);
  });

  it('should sum tokens from multiple $web_search calls', () => {
    const result = extractWebSearchTokens([
      {
        function: {
          name: '$web_search',
          arguments: JSON.stringify({ total_tokens: 1000 }),
        },
      },
      {
        function: {
          name: '$web_search',
          arguments: JSON.stringify({ total_tokens: 500 }),
        },
      },
    ]);
    expect(result).toBe(1500);
  });

  it('should return 0 for $web_search without total_tokens', () => {
    const result = extractWebSearchTokens([
      {
        function: {
          name: '$web_search',
          arguments: JSON.stringify({ query: 'test' }),
        },
      },
    ]);
    expect(result).toBe(0);
  });

  it('should handle invalid JSON gracefully', () => {
    const result = extractWebSearchTokens([
      {
        function: {
          name: '$web_search',
          arguments: 'not json',
        },
      },
    ]);
    expect(result).toBe(0);
  });

  it('should handle null arguments', () => {
    const result = extractWebSearchTokens([
      {
        function: {
          name: '$web_search',
          arguments: null,
        },
      },
    ]);
    expect(result).toBe(0);
  });
});

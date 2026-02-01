import { describe, expect, it } from 'vitest';
import {
  convertToKimiCodePrompt,
  inferKimiCodeCapabilities,
  normalizeExtendedThinkingConfig,
  effortToBudgetTokens,
  toAnthropicThinking,
  KIMI_CODE_BASE_URL,
  KIMI_CODE_DEFAULT_MODEL,
  KIMI_CODE_THINKING_MODEL,
  KIMI_CODE_MODELS,
  KIMI_CODE_OPENAI_BASE_URL,
  KIMI_CODE_DEFAULT_MAX_TOKENS,
  KIMI_CODE_DEFAULT_CONTEXT_WINDOW,
  KIMI_CODE_ANTHROPIC_VERSION
} from '../code';

describe('inferKimiCodeCapabilities', () => {
  it('should detect kimi-for-coding model capabilities', () => {
    const caps = inferKimiCodeCapabilities('kimi-for-coding');
    expect(caps.extendedThinking).toBe(false);
    expect(caps.maxOutputTokens).toBe(32768);
    expect(caps.streaming).toBe(true);
    expect(caps.toolCalling).toBe(true);
  });

  it('should detect kimi-k2-thinking model capabilities', () => {
    const caps = inferKimiCodeCapabilities('kimi-k2-thinking');
    expect(caps.extendedThinking).toBe(true);
    expect(caps.maxOutputTokens).toBe(32768);
  });

  it('should handle unknown model', () => {
    const caps = inferKimiCodeCapabilities('unknown-model');
    expect(caps.extendedThinking).toBe(false);
    expect(caps.maxOutputTokens).toBe(32768);
    expect(caps.maxContextSize).toBe(262144);
  });

  it('should detect thinking model by name pattern', () => {
    const caps = inferKimiCodeCapabilities('custom-thinking-model');
    expect(caps.extendedThinking).toBe(true);
  });
});

describe('normalizeExtendedThinkingConfig', () => {
  it('should return undefined for undefined input', () => {
    expect(normalizeExtendedThinkingConfig(undefined)).toBeUndefined();
  });

  it('should normalize boolean true to enabled config with default effort', () => {
    const result = normalizeExtendedThinkingConfig(true);
    expect(result).toEqual({ enabled: true, effort: 'medium' });
  });

  it('should normalize boolean false to disabled config', () => {
    const result = normalizeExtendedThinkingConfig(false);
    expect(result).toEqual({ enabled: false });
  });

  it('should pass through object config with defaults', () => {
    const config = { enabled: true, budgetTokens: 10000 };
    const result = normalizeExtendedThinkingConfig(config);
    expect(result?.enabled).toBe(true);
    expect(result?.budgetTokens).toBe(10000);
    expect(result?.effort).toBe('medium'); // default
  });

  it('should preserve custom effort', () => {
    const config = { enabled: true, effort: 'high' as const };
    const result = normalizeExtendedThinkingConfig(config);
    expect(result?.effort).toBe('high');
  });
});

describe('effortToBudgetTokens', () => {
  it('should return 2048 for low effort', () => {
    expect(effortToBudgetTokens('low')).toBe(2048);
  });

  it('should return 8192 for medium effort', () => {
    expect(effortToBudgetTokens('medium')).toBe(8192);
  });

  it('should return 16384 for high effort', () => {
    expect(effortToBudgetTokens('high')).toBe(16384);
  });
});

describe('Kimi Code Constants', () => {
  it('should have correct base URL', () => {
    expect(KIMI_CODE_BASE_URL).toBe('https://api.kimi.com/coding/v1');
  });

  it('should have correct OpenAI base URL', () => {
    expect(KIMI_CODE_OPENAI_BASE_URL).toBe('https://api.kimi.com/coding/v1');
  });

  it('should have correct default model', () => {
    expect(KIMI_CODE_DEFAULT_MODEL).toBe('kimi-for-coding');
  });

  it('should have correct thinking model', () => {
    expect(KIMI_CODE_THINKING_MODEL).toBe('kimi-k2-thinking');
  });

  it('should have correct model list', () => {
    expect(KIMI_CODE_MODELS).toContain('kimi-for-coding');
    expect(KIMI_CODE_MODELS).toContain('kimi-k2-thinking');
    expect(KIMI_CODE_MODELS).toHaveLength(2);
  });

  it('should have correct default max tokens (per Roo Code docs)', () => {
    expect(KIMI_CODE_DEFAULT_MAX_TOKENS).toBe(32768);
  });

  it('should have correct default context window (per Roo Code docs)', () => {
    expect(KIMI_CODE_DEFAULT_CONTEXT_WINDOW).toBe(262144);
  });

  it('should have correct Anthropic version', () => {
    expect(KIMI_CODE_ANTHROPIC_VERSION).toBe('2023-06-01');
  });
});

describe('toAnthropicThinking', () => {
  it('should return undefined for undefined input', () => {
    expect(toAnthropicThinking(undefined)).toBeUndefined();
  });

  it('should return enabled with default budget for boolean true', () => {
    const result = toAnthropicThinking(true);
    expect(result).toEqual({ type: 'enabled', budget_tokens: 8192 });
  });

  it('should return disabled for boolean false', () => {
    const result = toAnthropicThinking(false);
    expect(result).toEqual({ type: 'disabled' });
  });

  it('should return disabled for config with enabled: false', () => {
    const result = toAnthropicThinking({ enabled: false });
    expect(result).toEqual({ type: 'disabled' });
  });

  it('should use low effort budget tokens', () => {
    const result = toAnthropicThinking({ enabled: true, effort: 'low' });
    expect(result).toEqual({ type: 'enabled', budget_tokens: 2048 });
  });

  it('should use medium effort budget tokens', () => {
    const result = toAnthropicThinking({ enabled: true, effort: 'medium' });
    expect(result).toEqual({ type: 'enabled', budget_tokens: 8192 });
  });

  it('should use high effort budget tokens', () => {
    const result = toAnthropicThinking({ enabled: true, effort: 'high' });
    expect(result).toEqual({ type: 'enabled', budget_tokens: 16384 });
  });

  it('should prioritize explicit budgetTokens over effort', () => {
    const result = toAnthropicThinking({ enabled: true, effort: 'low', budgetTokens: 10000 });
    expect(result).toEqual({ type: 'enabled', budget_tokens: 10000 });
  });

  it('should use default medium effort when no effort specified', () => {
    const result = toAnthropicThinking({ enabled: true });
    expect(result).toEqual({ type: 'enabled', budget_tokens: 8192 });
  });
});

describe('convertToKimiCodePrompt', () => {
  it('should convert simple user message', async () => {
    const result = await convertToKimiCodePrompt([
      { role: 'user', content: [{ type: 'text', text: 'Hello!' }] }
    ]);

    expect(result.system).toBeUndefined();
    expect(result.messages).toEqual([{ role: 'user', content: 'Hello!' }]);
  });

  it('should extract system message', async () => {
    const result = await convertToKimiCodePrompt([
      { role: 'system', content: 'You are a coding assistant.' },
      { role: 'user', content: [{ type: 'text', text: 'Help me write code' }] }
    ]);

    expect(result.system).toBe('You are a coding assistant.');
    expect(result.messages).toEqual([{ role: 'user', content: 'Help me write code' }]);
  });

  it('should combine multiple system messages', async () => {
    const result = await convertToKimiCodePrompt([
      { role: 'system', content: 'First instruction' },
      { role: 'system', content: 'Second instruction' },
      { role: 'user', content: [{ type: 'text', text: 'Hello' }] }
    ]);

    expect(result.system).toBe('First instruction\n\nSecond instruction');
  });

  it('should convert assistant message with text', async () => {
    const result = await convertToKimiCodePrompt([
      { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'Hi there!' }] }
    ]);

    expect(result.messages).toHaveLength(2);
    expect(result.messages[1]).toEqual({ role: 'assistant', content: 'Hi there!' });
  });

  it('should convert assistant message with tool call', async () => {
    const result = await convertToKimiCodePrompt([
      { role: 'user', content: [{ type: 'text', text: 'Calculate 2+2' }] },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-123',
            toolName: 'calculator',
            input: { a: 2, b: 2 }
          }
        ]
      }
    ]);

    expect(result.messages).toHaveLength(2);
    expect(result.messages[1]).toEqual({
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: 'call-123',
          name: 'calculator',
          input: { a: 2, b: 2 }
        }
      ]
    });
  });

  it('should convert tool result as user message after assistant', async () => {
    const result = await convertToKimiCodePrompt([
      { role: 'user', content: [{ type: 'text', text: 'Calculate' }] },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-123',
            toolName: 'calculator',
            input: { a: 2, b: 2 }
          }
        ]
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-123',
            toolName: 'calculator',
            output: { type: 'text', value: '4' }
          }
        ]
      }
    ]);

    expect(result.messages).toHaveLength(3);
    expect(result.messages[2]).toEqual({
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'call-123',
          content: '4',
          is_error: undefined
        }
      ]
    });
  });

  it('should handle tool result with error', async () => {
    const result = await convertToKimiCodePrompt([
      { role: 'user', content: [{ type: 'text', text: 'Calculate' }] },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-123',
            toolName: 'calculator',
            input: { a: 2, b: 2 }
          }
        ]
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-123',
            toolName: 'calculator',
            output: { type: 'error-text', value: 'Error: Division by zero' }
          }
        ]
      }
    ]);

    expect(result.messages[2]).toEqual({
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'call-123',
          content: 'Error: Division by zero',
          is_error: true
        }
      ]
    });
  });

  it('should convert user message with image URL', async () => {
    const result = await convertToKimiCodePrompt([
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

    expect(result.messages).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'What is in this image?' },
          {
            type: 'image',
            source: { type: 'url', url: 'https://example.com/image.png' }
          }
        ]
      }
    ]);
  });

  it('should convert user message with base64 image', async () => {
    const result = await convertToKimiCodePrompt([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'What is this?' },
          {
            type: 'file',
            mediaType: 'image/jpeg',
            data: 'SGVsbG8gV29ybGQ=' // base64 of "Hello World"
          }
        ]
      }
    ]);

    expect(result.messages).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'What is this?' },
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: 'SGVsbG8gV29ybGQ='
            }
          }
        ]
      }
    ]);
  });

  it('should handle assistant message with reasoning', async () => {
    const result = await convertToKimiCodePrompt([
      { role: 'user', content: [{ type: 'text', text: 'Think about this' }] },
      {
        role: 'assistant',
        content: [
          { type: 'reasoning', text: 'Let me think...' },
          { type: 'text', text: 'Here is my answer' }
        ]
      }
    ]);

    expect(result.messages[1]).toEqual({
      role: 'assistant',
      content: [
        { type: 'text', text: '<thinking>Let me think...</thinking>' },
        { type: 'text', text: 'Here is my answer' }
      ]
    });
  });

  it('should handle multipart user message with text only', async () => {
    const result = await convertToKimiCodePrompt([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Part 1' },
          { type: 'text', text: 'Part 2' }
        ]
      }
    ]);

    expect(result.messages).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Part 1' },
          { type: 'text', text: 'Part 2' }
        ]
      }
    ]);
  });
});

import { describe, it, expect } from 'vitest';
import {
  inferModelCapabilities,
  createKimiWebSearchTool,
  KIMI_WEB_SEARCH_TOOL_NAME,
  kimiProviderOptionsSchema,
} from './kimi-chat-options';

describe('inferModelCapabilities', () => {
  it('should detect thinking model from -thinking suffix', () => {
    const caps = inferModelCapabilities('kimi-k2.5-thinking');
    expect(caps.thinking).toBe(true);
    expect(caps.alwaysThinking).toBe(true);
  });

  it('should not detect thinking for non-thinking models', () => {
    const caps = inferModelCapabilities('kimi-k2.5');
    expect(caps.thinking).toBe(false);
    expect(caps.alwaysThinking).toBe(false);
  });

  it('should detect video support for k2.5 models', () => {
    const caps = inferModelCapabilities('kimi-k2.5');
    expect(caps.videoInput).toBe(true);
  });

  it('should detect video support for k2.5-thinking models', () => {
    const caps = inferModelCapabilities('kimi-k2.5-thinking');
    expect(caps.videoInput).toBe(true);
  });

  it('should not detect video support for k2-turbo models', () => {
    const caps = inferModelCapabilities('kimi-k2-turbo');
    expect(caps.videoInput).toBe(false);
  });

  it('should always detect image support', () => {
    expect(inferModelCapabilities('kimi-k2.5').imageInput).toBe(true);
    expect(inferModelCapabilities('kimi-k2-turbo').imageInput).toBe(true);
    expect(inferModelCapabilities('kimi-k2-thinking').imageInput).toBe(true);
  });

  it('should set max context size to 256k', () => {
    const caps = inferModelCapabilities('kimi-k2.5');
    expect(caps.maxContextSize).toBe(256_000);
  });

  it('should handle custom model IDs', () => {
    const caps = inferModelCapabilities('custom-model-thinking');
    expect(caps.thinking).toBe(true);
    expect(caps.alwaysThinking).toBe(true);
    expect(caps.videoInput).toBe(false);
  });
});

describe('KIMI_WEB_SEARCH_TOOL_NAME', () => {
  it('should be $web_search', () => {
    expect(KIMI_WEB_SEARCH_TOOL_NAME).toBe('$web_search');
  });
});

describe('createKimiWebSearchTool', () => {
  it('should create a builtin_function tool with $web_search name', () => {
    const tool = createKimiWebSearchTool();
    expect(tool.type).toBe('builtin_function');
    expect(tool.function.name).toBe('$web_search');
  });

  it('should not include config when not provided', () => {
    const tool = createKimiWebSearchTool();
    expect(tool.function.config).toBeUndefined();
  });

  it('should include config when provided', () => {
    const tool = createKimiWebSearchTool({ search_result: true });
    expect(tool.function.config).toEqual({ search_result: true });
  });
});

describe('kimiProviderOptionsSchema', () => {
  it('should validate empty object', () => {
    const result = kimiProviderOptionsSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should validate user option', () => {
    const result = kimiProviderOptionsSchema.safeParse({ user: 'user-123' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.user).toBe('user-123');
    }
  });

  it('should validate webSearch as boolean', () => {
    const result = kimiProviderOptionsSchema.safeParse({ webSearch: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.webSearch).toBe(true);
    }
  });

  it('should validate webSearch as object', () => {
    const result = kimiProviderOptionsSchema.safeParse({
      webSearch: {
        enabled: true,
        config: { search_result: true },
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.webSearch).toEqual({
        enabled: true,
        config: { search_result: true },
      });
    }
  });

  it('should validate extraHeaders', () => {
    const result = kimiProviderOptionsSchema.safeParse({
      extraHeaders: { 'X-Custom': 'value' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.extraHeaders).toEqual({ 'X-Custom': 'value' });
    }
  });

  it('should reject invalid types', () => {
    const result = kimiProviderOptionsSchema.safeParse({ user: 123 });
    expect(result.success).toBe(false);
  });
});

import type { KimiChatLanguageModel } from '../chat';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createKimi, kimi, kimiTools } from '../index';

describe('createKimi', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.MOONSHOT_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should create a provider with default settings', () => {
    const provider = createKimi();
    expect(provider.specificationVersion).toBe('v3');
  });

  it('should create a chat model', () => {
    const provider = createKimi();
    const model = provider('kimi-k2.5');
    expect(model.modelId).toBe('kimi-k2.5');
    expect(model.specificationVersion).toBe('v3');
  });

  it('should create a chat model via languageModel method', () => {
    const provider = createKimi();
    const model = provider.languageModel('kimi-k2-turbo');
    expect(model.modelId).toBe('kimi-k2-turbo');
  });

  it('should create a chat model via chat method', () => {
    const provider = createKimi();
    const model = provider.chat('kimi-k2.5-thinking');
    expect(model.modelId).toBe('kimi-k2.5-thinking');
  });

  it('should throw when called with new', () => {
    const provider = createKimi();
    // The error can be either our custom message or the native constructor error
    // Test that the provider function throws when used as a constructor
    const ProviderAsConstructor = provider as unknown as new (modelId: string) => unknown;
    expect(() => new ProviderAsConstructor('kimi-k2.5')).toThrow();
  });

  it('should throw for unsupported model types', () => {
    const provider = createKimi();

    expect(() => provider.embeddingModel('some-model')).toThrow();
    expect(() => provider.imageModel('some-model')).toThrow();
    expect(() => provider.rerankingModel!('some-model')).toThrow();
  });

  it('should include tools object', () => {
    const provider = createKimi();
    expect(provider.tools).toBeDefined();
    expect(provider.tools.webSearch).toBeDefined();
    expect(provider.tools.codeInterpreter).toBeDefined();
  });

  it('should pass settings to model', () => {
    const provider = createKimi();
    const model = provider('kimi-k2.5', { webSearch: true });
    expect(model.modelId).toBe('kimi-k2.5');
  });
});

describe('default kimi provider', () => {
  beforeEach(() => {
    process.env.MOONSHOT_API_KEY = 'test-api-key';
  });

  it('should be a valid provider', () => {
    expect(kimi.specificationVersion).toBe('v3');
  });

  it('should create models', () => {
    const model = kimi('kimi-k2.5');
    expect(model.modelId).toBe('kimi-k2.5');
  });
});

describe('kimiTools', () => {
  it('should create web search tool', () => {
    const tool = kimiTools.webSearch();
    expect(tool.type).toBe('provider');
    expect(tool.id).toBe('kimi.webSearch');
  });

  it('should create code interpreter tool', () => {
    const tool = kimiTools.codeInterpreter();
    expect(tool.type).toBe('provider');
    expect(tool.id).toBe('kimi.codeInterpreter');
  });
});

describe('provider endpoints', () => {
  beforeEach(() => {
    process.env.MOONSHOT_API_KEY = 'test-api-key';
  });

  it('should use global endpoint by default', () => {
    const provider = createKimi();
    const model = provider('kimi-k2.5');
    // Can't directly test baseURL but the provider should work
    expect(model.provider).toBe('kimi.chat');
  });

  it('should allow cn endpoint selection', () => {
    const provider = createKimi({ endpoint: 'cn' });
    const model = provider('kimi-k2.5');
    expect(model.provider).toBe('kimi.chat');
  });

  it('should allow custom baseURL', () => {
    const provider = createKimi({ baseURL: 'https://custom.api.com/v1' });
    const model = provider('kimi-k2.5');
    expect(model.provider).toBe('kimi.chat');
  });
});

describe('model capabilities', () => {
  beforeEach(() => {
    process.env.MOONSHOT_API_KEY = 'test-api-key';
  });

  it('should detect thinking model capabilities', () => {
    const model = kimi('kimi-k2.5-thinking') as KimiChatLanguageModel;
    expect(model.capabilities.thinking).toBe(true);
    expect(model.capabilities.alwaysThinking).toBe(true);
  });

  it('should detect K2.5 video support', () => {
    const model = kimi('kimi-k2.5') as KimiChatLanguageModel;
    expect(model.capabilities.videoInput).toBe(true);
  });

  it('should not have video for K2 turbo', () => {
    const model = kimi('kimi-k2-turbo') as KimiChatLanguageModel;
    expect(model.capabilities.videoInput).toBe(false);
  });

  it('should allow capability overrides', () => {
    const model = kimi('kimi-k2-turbo', {
      capabilities: { videoInput: true }
    }) as KimiChatLanguageModel;
    expect(model.capabilities.videoInput).toBe(true);
  });
});

describe('supportedUrls', () => {
  beforeEach(() => {
    process.env.MOONSHOT_API_KEY = 'test-api-key';
  });

  it('should support image URLs for all models', async () => {
    const model = kimi('kimi-k2-turbo') as KimiChatLanguageModel;
    const supportedUrls = await Promise.resolve(model.supportedUrls);
    expect(supportedUrls['image/*']).toBeDefined();
    expect(supportedUrls['image/*'][0]).toBeInstanceOf(RegExp);
  });

  it('should support video URLs for K2.5 models', async () => {
    const model = kimi('kimi-k2.5') as KimiChatLanguageModel;
    const supportedUrls = await Promise.resolve(model.supportedUrls);
    expect(supportedUrls['video/*']).toBeDefined();
  });

  it('should not support video URLs for non-K2.5 models', async () => {
    const model = kimi('kimi-k2-turbo') as KimiChatLanguageModel;
    const supportedUrls = await Promise.resolve(model.supportedUrls);
    expect(supportedUrls['video/*']).toBeUndefined();
  });

  it('should allow custom supportedUrls override', async () => {
    const customUrls = {
      'image/*': [/^https:\/\/cdn\.example\.com/]
    };
    const model = kimi('kimi-k2.5', {
      supportedUrls: customUrls
    }) as KimiChatLanguageModel;
    const supportedUrls = await Promise.resolve(model.supportedUrls);
    expect(supportedUrls).toEqual(customUrls);
  });
});

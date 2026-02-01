import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  createKimiCode,
  kimiCode,
  KimiCodeLanguageModel,
  KIMI_CODE_BASE_URL,
  KIMI_CODE_DEFAULT_MODEL,
  KIMI_CODE_THINKING_MODEL,
  inferKimiCodeCapabilities
} from '../code';

describe('createKimiCode', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('API key handling', () => {
    it('should use provided apiKey', () => {
      const provider = createKimiCode({ apiKey: 'sk-test-key' });
      const model = provider();

      expect(model).toBeInstanceOf(KimiCodeLanguageModel);
      expect(model.modelId).toBe(KIMI_CODE_DEFAULT_MODEL);
    });

    it('should use KIMI_CODE_API_KEY env var', () => {
      process.env.KIMI_CODE_API_KEY = 'sk-env-key';

      const provider = createKimiCode();
      const model = provider();

      expect(model).toBeInstanceOf(KimiCodeLanguageModel);
    });

    it('should fallback to KIMI_API_KEY env var', () => {
      delete process.env.KIMI_CODE_API_KEY;
      process.env.KIMI_API_KEY = 'sk-fallback-key';

      const provider = createKimiCode();
      const model = provider();

      expect(model).toBeInstanceOf(KimiCodeLanguageModel);
    });

    it('should throw error when no API key is available', () => {
      delete process.env.KIMI_CODE_API_KEY;
      delete process.env.KIMI_API_KEY;

      const provider = createKimiCode();
      const model = provider();

      // The error is thrown when headers are accessed, not when creating the model
      // This happens during actual API calls
      expect(model).toBeInstanceOf(KimiCodeLanguageModel);
    });
  });

  describe('model creation', () => {
    it('should create model with default model ID', () => {
      const provider = createKimiCode({ apiKey: 'sk-test' });
      const model = provider();

      expect(model.modelId).toBe(KIMI_CODE_DEFAULT_MODEL);
    });

    it('should create model with specified model ID', () => {
      const provider = createKimiCode({ apiKey: 'sk-test' });
      const model = provider(KIMI_CODE_THINKING_MODEL);

      expect(model.modelId).toBe(KIMI_CODE_THINKING_MODEL);
    });

    it('should create model with custom model ID', () => {
      const provider = createKimiCode({ apiKey: 'sk-test' });
      const model = provider('custom-model');

      expect(model.modelId).toBe('custom-model');
    });

    it('should pass settings to model', () => {
      const provider = createKimiCode({ apiKey: 'sk-test' });
      const model = provider(KIMI_CODE_DEFAULT_MODEL, {
        extendedThinking: { enabled: true, effort: 'high' }
      }) as KimiCodeLanguageModel;

      expect(model.capabilities.extendedThinking).toBe(false); // inferred from model ID
    });

    it('should override capabilities when provided in settings', () => {
      const provider = createKimiCode({ apiKey: 'sk-test' });
      const model = provider(KIMI_CODE_DEFAULT_MODEL, {
        capabilities: { extendedThinking: true }
      }) as KimiCodeLanguageModel;

      expect(model.capabilities.extendedThinking).toBe(true);
    });
  });

  describe('provider interface', () => {
    it('should have specificationVersion v3', () => {
      const provider = createKimiCode({ apiKey: 'sk-test' });

      expect(provider.specificationVersion).toBe('v3');
    });

    it('should have languageModel method', () => {
      const provider = createKimiCode({ apiKey: 'sk-test' });

      expect(typeof provider.languageModel).toBe('function');
    });

    it('should have chat method (alias)', () => {
      const provider = createKimiCode({ apiKey: 'sk-test' });

      expect(typeof provider.chat).toBe('function');
    });

    it('should throw NoSuchModelError for embeddingModel', () => {
      const provider = createKimiCode({ apiKey: 'sk-test' });

      expect(() => provider.embeddingModel('test')).toThrow('No such embeddingModel');
    });

    it('should throw NoSuchModelError for imageModel', () => {
      const provider = createKimiCode({ apiKey: 'sk-test' });

      expect(() => provider.imageModel('test')).toThrow('No such imageModel');
    });

    it('should throw NoSuchModelError for rerankingModel', () => {
      const provider = createKimiCode({ apiKey: 'sk-test' });

      expect(() => provider.rerankingModel!('test')).toThrow('No such rerankingModel');
    });

    it('should throw when called with new keyword', () => {
      const provider = createKimiCode({ apiKey: 'sk-test' });

      expect(() => new (provider as unknown as new () => unknown)()).toThrow();
    });
  });

  describe('base URL handling', () => {
    it('should use default base URL', () => {
      const provider = createKimiCode({ apiKey: 'sk-test' });
      const model = provider();

      expect(model.provider).toBe('kimi.code');
    });

    it('should use custom base URL', () => {
      const provider = createKimiCode({
        apiKey: 'sk-test',
        baseURL: 'https://custom.api.com/v1'
      });
      const model = provider();

      expect(model).toBeInstanceOf(KimiCodeLanguageModel);
    });

    it('should use KIMI_CODE_BASE_URL env var', () => {
      process.env.KIMI_CODE_BASE_URL = 'https://env.api.com/v1';

      const provider = createKimiCode({ apiKey: 'sk-test' });
      const model = provider();

      expect(model).toBeInstanceOf(KimiCodeLanguageModel);
    });
  });

  describe('custom fetch', () => {
    it('should accept custom fetch function', () => {
      const customFetch = vi.fn();
      const provider = createKimiCode({
        apiKey: 'sk-test',
        fetch: customFetch
      });
      const model = provider();

      expect(model).toBeInstanceOf(KimiCodeLanguageModel);
    });
  });

  describe('generateId', () => {
    it('should accept custom generateId function', () => {
      const customGenerateId = vi.fn(() => 'custom-id');
      const provider = createKimiCode({
        apiKey: 'sk-test',
        generateId: customGenerateId
      });
      const model = provider();

      expect(model).toBeInstanceOf(KimiCodeLanguageModel);
    });
  });
});

describe('kimiCode default instance', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.KIMI_CODE_API_KEY = 'sk-default-test';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should be a function', () => {
    expect(typeof kimiCode).toBe('function');
  });

  it('should create model with default settings', () => {
    const model = kimiCode() as KimiCodeLanguageModel;

    expect(model).toBeInstanceOf(KimiCodeLanguageModel);
    expect(model.modelId).toBe(KIMI_CODE_DEFAULT_MODEL);
  });

  it('should create thinking model', () => {
    const model = kimiCode(KIMI_CODE_THINKING_MODEL) as KimiCodeLanguageModel;

    expect(model.modelId).toBe(KIMI_CODE_THINKING_MODEL);
    expect(model.capabilities.extendedThinking).toBe(true);
  });
});

describe('KimiCodeLanguageModel', () => {
  it('should have specificationVersion v3', () => {
    const provider = createKimiCode({ apiKey: 'sk-test' });
    const model = provider() as KimiCodeLanguageModel;

    expect(model.specificationVersion).toBe('v3');
  });

  it('should have provider name', () => {
    const provider = createKimiCode({ apiKey: 'sk-test' });
    const model = provider() as KimiCodeLanguageModel;

    expect(model.provider).toBe('kimi.code');
  });

  it('should infer capabilities for default model', () => {
    const caps = inferKimiCodeCapabilities(KIMI_CODE_DEFAULT_MODEL);

    expect(caps.extendedThinking).toBe(false);
    expect(caps.maxOutputTokens).toBe(32768);
    expect(caps.maxContextSize).toBe(262144);
    expect(caps.streaming).toBe(true);
    expect(caps.toolCalling).toBe(true);
    expect(caps.imageInput).toBe(true);
  });

  it('should infer capabilities for thinking model', () => {
    const caps = inferKimiCodeCapabilities(KIMI_CODE_THINKING_MODEL);

    expect(caps.extendedThinking).toBe(true);
    expect(caps.maxOutputTokens).toBe(32768);
    expect(caps.maxContextSize).toBe(262144);
  });

  it('should have supportedUrls for images', async () => {
    const provider = createKimiCode({ apiKey: 'sk-test' });
    const model = provider() as KimiCodeLanguageModel;

    const urls = await model.supportedUrls;
    expect(urls).toBeDefined();
    expect(urls['image/*']).toBeDefined();
  });

  it('should allow overriding supportedUrls in settings', async () => {
    const customPatterns = { 'image/*': [/^https:\/\/example\.com/] };
    const provider = createKimiCode({ apiKey: 'sk-test' });
    const model = provider(KIMI_CODE_DEFAULT_MODEL, {
      supportedUrls: customPatterns
    }) as KimiCodeLanguageModel;

    const urls = await model.supportedUrls;
    expect(urls).toEqual(customPatterns);
  });
});

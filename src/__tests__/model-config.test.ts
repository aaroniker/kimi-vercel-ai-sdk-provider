/**
 * Tests for model configuration features:
 * - Temperature locking for thinking models
 * - Default max_tokens
 * - Model capability inference
 */

import { describe, expect, it } from 'vitest';
import {
  STANDARD_MODEL_DEFAULT_MAX_TOKENS,
  THINKING_MODEL_DEFAULT_MAX_TOKENS,
  THINKING_MODEL_TEMPERATURE,
  inferModelCapabilities
} from '../core';

describe('Model Configuration', () => {
  describe('inferModelCapabilities', () => {
    it('should detect thinking models by suffix', () => {
      const caps = inferModelCapabilities('kimi-k2.5-thinking');

      expect(caps.thinking).toBe(true);
      expect(caps.alwaysThinking).toBe(true);
    });

    it('should detect non-thinking models', () => {
      const caps = inferModelCapabilities('kimi-k2.5');

      expect(caps.thinking).toBe(false);
      expect(caps.alwaysThinking).toBe(false);
    });

    it('should detect K2.5 models for video support', () => {
      const k25Caps = inferModelCapabilities('kimi-k2.5');
      const k2Caps = inferModelCapabilities('kimi-k2-turbo');

      expect(k25Caps.videoInput).toBe(true);
      expect(k2Caps.videoInput).toBe(false);
    });

    it('should support alternative K2.5 naming', () => {
      const caps = inferModelCapabilities('kimi-k2-5-thinking');

      expect(caps.videoInput).toBe(true);
      expect(caps.thinking).toBe(true);
    });
  });

  describe('Temperature Locking', () => {
    it('should set locked temperature for thinking models', () => {
      const caps = inferModelCapabilities('kimi-k2.5-thinking');

      expect(caps.temperatureLocked).toBe(true);
      expect(caps.defaultTemperature).toBe(THINKING_MODEL_TEMPERATURE);
      expect(caps.defaultTemperature).toBe(1.0);
    });

    it('should not lock temperature for standard models', () => {
      const caps = inferModelCapabilities('kimi-k2.5');

      expect(caps.temperatureLocked).toBe(false);
      expect(caps.defaultTemperature).toBeUndefined();
    });

    it('should use correct constant value', () => {
      expect(THINKING_MODEL_TEMPERATURE).toBe(1.0);
    });
  });

  describe('Default Max Tokens', () => {
    it('should set higher default for thinking models', () => {
      const caps = inferModelCapabilities('kimi-k2.5-thinking');

      expect(caps.defaultMaxOutputTokens).toBe(THINKING_MODEL_DEFAULT_MAX_TOKENS);
      expect(caps.defaultMaxOutputTokens).toBe(32768);
    });

    it('should set standard default for regular models', () => {
      const caps = inferModelCapabilities('kimi-k2.5');

      expect(caps.defaultMaxOutputTokens).toBe(STANDARD_MODEL_DEFAULT_MAX_TOKENS);
      expect(caps.defaultMaxOutputTokens).toBe(4096);
    });

    it('should use correct constant values', () => {
      expect(THINKING_MODEL_DEFAULT_MAX_TOKENS).toBe(32768);
      expect(STANDARD_MODEL_DEFAULT_MAX_TOKENS).toBe(4096);
    });
  });

  describe('All models have common capabilities', () => {
    const testModels = ['kimi-k2.5', 'kimi-k2.5-thinking', 'kimi-k2-turbo', 'kimi-k2-thinking'];

    for (const modelId of testModels) {
      it(`${modelId} should have imageInput support`, () => {
        const caps = inferModelCapabilities(modelId);
        expect(caps.imageInput).toBe(true);
      });

      it(`${modelId} should have 256k context`, () => {
        const caps = inferModelCapabilities(modelId);
        expect(caps.maxContextSize).toBe(256_000);
      });

      it(`${modelId} should support tool calling`, () => {
        const caps = inferModelCapabilities(modelId);
        expect(caps.toolCalling).toBe(true);
      });

      it(`${modelId} should support JSON mode`, () => {
        const caps = inferModelCapabilities(modelId);
        expect(caps.jsonMode).toBe(true);
      });

      it(`${modelId} should support structured outputs`, () => {
        const caps = inferModelCapabilities(modelId);
        expect(caps.structuredOutputs).toBe(true);
      });
    }
  });
});

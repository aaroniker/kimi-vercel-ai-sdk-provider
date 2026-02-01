/**
 * Tests for context caching configuration.
 */

import { describe, expect, it } from 'vitest';
import { kimiCachingConfigSchema, kimiProviderOptionsSchema } from '../chat/kimi-chat-settings';

describe('context caching', () => {
  describe('kimiCachingConfigSchema', () => {
    it('should validate minimal config', () => {
      const result = kimiCachingConfigSchema.safeParse({
        enabled: true
      });
      expect(result.success).toBe(true);
    });

    it('should validate full config', () => {
      const result = kimiCachingConfigSchema.safeParse({
        enabled: true,
        cacheKey: 'my-book-analysis',
        ttlSeconds: 7200,
        resetCache: false
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cacheKey).toBe('my-book-analysis');
        expect(result.data.ttlSeconds).toBe(7200);
        expect(result.data.resetCache).toBe(false);
      }
    });

    it('should reject config without enabled', () => {
      const result = kimiCachingConfigSchema.safeParse({
        cacheKey: 'test'
      });
      expect(result.success).toBe(false);
    });

    it('should allow disabled config', () => {
      const result = kimiCachingConfigSchema.safeParse({
        enabled: false
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.enabled).toBe(false);
      }
    });
  });

  describe('kimiProviderOptionsSchema with caching', () => {
    it('should accept boolean caching option', () => {
      const result = kimiProviderOptionsSchema.safeParse({
        caching: true
      });
      expect(result.success).toBe(true);
    });

    it('should accept caching config object', () => {
      const result = kimiProviderOptionsSchema.safeParse({
        caching: {
          enabled: true,
          cacheKey: 'conversation-1',
          ttlSeconds: 3600
        }
      });
      expect(result.success).toBe(true);
    });

    it('should accept caching with other options', () => {
      const result = kimiProviderOptionsSchema.safeParse({
        user: 'user-123',
        caching: {
          enabled: true,
          cacheKey: 'long-document'
        },
        webSearch: true
      });
      expect(result.success).toBe(true);
    });
  });

  describe('kimiProviderOptionsSchema with toolChoicePolyfill', () => {
    it('should accept toolChoicePolyfill boolean', () => {
      const result = kimiProviderOptionsSchema.safeParse({
        toolChoicePolyfill: true
      });
      expect(result.success).toBe(true);
    });

    it('should accept toolChoicePolyfill false', () => {
      const result = kimiProviderOptionsSchema.safeParse({
        toolChoicePolyfill: false
      });
      expect(result.success).toBe(true);
    });
  });
});

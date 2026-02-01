/**
 * Tests for file content caching.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FileCache,
  type FileCacheEntry,
  clearDefaultFileCache,
  generateCacheKey,
  generateContentHash,
  getDefaultFileCache,
  setDefaultFileCache
} from '../files';

describe('FileCache', () => {
  describe('basic operations', () => {
    it('should store and retrieve entries', () => {
      const cache = new FileCache();
      const entry: FileCacheEntry = {
        fileId: 'file_123',
        content: 'extracted text',
        createdAt: Date.now(),
        purpose: 'file-extract'
      };

      cache.set('hash123', entry);
      const retrieved = cache.get('hash123');

      expect(retrieved).toEqual(entry);
    });

    it('should return undefined for missing entries', () => {
      const cache = new FileCache();

      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should delete entries', () => {
      const cache = new FileCache();
      const entry: FileCacheEntry = {
        fileId: 'file_123',
        createdAt: Date.now(),
        purpose: 'file-extract'
      };

      cache.set('hash123', entry);
      expect(cache.has('hash123')).toBe(true);

      cache.delete('hash123');
      expect(cache.has('hash123')).toBe(false);
    });

    it('should clear all entries', () => {
      const cache = new FileCache();

      cache.set('hash1', { fileId: 'f1', createdAt: Date.now(), purpose: 'file-extract' });
      cache.set('hash2', { fileId: 'f2', createdAt: Date.now(), purpose: 'image' });
      cache.set('hash3', { fileId: 'f3', createdAt: Date.now(), purpose: 'video' });

      expect(cache.size).toBe(3);

      cache.clear();
      expect(cache.size).toBe(0);
    });

    it('should report correct size', () => {
      const cache = new FileCache();

      expect(cache.size).toBe(0);

      cache.set('hash1', { fileId: 'f1', createdAt: Date.now(), purpose: 'file-extract' });
      expect(cache.size).toBe(1);

      cache.set('hash2', { fileId: 'f2', createdAt: Date.now(), purpose: 'file-extract' });
      expect(cache.size).toBe(2);
    });
  });

  describe('LRU eviction', () => {
    it('should evict oldest entries when at capacity', () => {
      const cache = new FileCache({ maxSize: 3 });

      cache.set('hash1', { fileId: 'f1', createdAt: Date.now(), purpose: 'file-extract' });
      cache.set('hash2', { fileId: 'f2', createdAt: Date.now(), purpose: 'file-extract' });
      cache.set('hash3', { fileId: 'f3', createdAt: Date.now(), purpose: 'file-extract' });

      expect(cache.size).toBe(3);

      // Add a 4th entry, should evict hash1
      cache.set('hash4', { fileId: 'f4', createdAt: Date.now(), purpose: 'file-extract' });

      expect(cache.size).toBe(3);
      expect(cache.has('hash1')).toBe(false);
      expect(cache.has('hash2')).toBe(true);
      expect(cache.has('hash3')).toBe(true);
      expect(cache.has('hash4')).toBe(true);
    });

    it('should update LRU order on get', () => {
      const cache = new FileCache({ maxSize: 3 });

      cache.set('hash1', { fileId: 'f1', createdAt: Date.now(), purpose: 'file-extract' });
      cache.set('hash2', { fileId: 'f2', createdAt: Date.now(), purpose: 'file-extract' });
      cache.set('hash3', { fileId: 'f3', createdAt: Date.now(), purpose: 'file-extract' });

      // Access hash1 to make it recently used
      cache.get('hash1');

      // Add a 4th entry, should evict hash2 (not hash1)
      cache.set('hash4', { fileId: 'f4', createdAt: Date.now(), purpose: 'file-extract' });

      expect(cache.has('hash1')).toBe(true);
      expect(cache.has('hash2')).toBe(false);
      expect(cache.has('hash3')).toBe(true);
      expect(cache.has('hash4')).toBe(true);
    });

    it('should handle updating existing entries', () => {
      const cache = new FileCache({ maxSize: 3 });

      cache.set('hash1', { fileId: 'f1', createdAt: Date.now(), purpose: 'file-extract' });
      cache.set('hash2', { fileId: 'f2', createdAt: Date.now(), purpose: 'file-extract' });
      cache.set('hash3', { fileId: 'f3', createdAt: Date.now(), purpose: 'file-extract' });

      // Update hash1
      cache.set('hash1', { fileId: 'f1-updated', createdAt: Date.now(), purpose: 'file-extract' });

      expect(cache.size).toBe(3);
      expect(cache.get('hash1')?.fileId).toBe('f1-updated');
    });
  });

  describe('TTL expiration', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should expire entries after TTL', () => {
      const cache = new FileCache({ ttlMs: 1000 }); // 1 second TTL

      cache.set('hash1', { fileId: 'f1', createdAt: Date.now(), purpose: 'file-extract' });

      expect(cache.get('hash1')).toBeDefined();

      // Advance time past TTL
      vi.advanceTimersByTime(1500);

      expect(cache.get('hash1')).toBeUndefined();
    });

    it('should not expire entries before TTL', () => {
      const cache = new FileCache({ ttlMs: 1000 });

      cache.set('hash1', { fileId: 'f1', createdAt: Date.now(), purpose: 'file-extract' });

      // Advance time but not past TTL
      vi.advanceTimersByTime(500);

      expect(cache.get('hash1')).toBeDefined();
    });

    it('should prune expired entries', () => {
      const cache = new FileCache({ ttlMs: 1000 });

      cache.set('hash1', { fileId: 'f1', createdAt: Date.now(), purpose: 'file-extract' });
      cache.set('hash2', { fileId: 'f2', createdAt: Date.now(), purpose: 'file-extract' });

      vi.advanceTimersByTime(1500);

      cache.set('hash3', { fileId: 'f3', createdAt: Date.now(), purpose: 'file-extract' });

      const pruned = cache.prune();

      expect(pruned).toBe(2);
      expect(cache.size).toBe(1);
      expect(cache.has('hash3')).toBe(true);
    });
  });

  describe('default options', () => {
    it('should use default maxSize of 100', () => {
      const cache = new FileCache();

      // Add 100 entries
      for (let i = 0; i < 100; i++) {
        cache.set(`hash${i}`, { fileId: `f${i}`, createdAt: Date.now(), purpose: 'file-extract' });
      }

      expect(cache.size).toBe(100);

      // Add one more, should evict
      cache.set('hash100', { fileId: 'f100', createdAt: Date.now(), purpose: 'file-extract' });
      expect(cache.size).toBe(100);
    });

    it('should use default TTL of 1 hour', () => {
      vi.useFakeTimers();

      const cache = new FileCache();
      cache.set('hash1', { fileId: 'f1', createdAt: Date.now(), purpose: 'file-extract' });

      // 59 minutes - should still be valid
      vi.advanceTimersByTime(59 * 60 * 1000);
      expect(cache.get('hash1')).toBeDefined();

      // 61 minutes - should be expired
      vi.advanceTimersByTime(2 * 60 * 1000);
      expect(cache.get('hash1')).toBeUndefined();

      vi.useRealTimers();
    });
  });
});

describe('generateContentHash', () => {
  it('should generate consistent hashes for same content', () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);

    const hash1 = generateContentHash(data);
    const hash2 = generateContentHash(data);

    expect(hash1).toBe(hash2);
  });

  it('should generate different hashes for different content', () => {
    const data1 = new Uint8Array([1, 2, 3]);
    const data2 = new Uint8Array([4, 5, 6]);

    const hash1 = generateContentHash(data1);
    const hash2 = generateContentHash(data2);

    expect(hash1).not.toBe(hash2);
  });

  it('should work with string input', () => {
    const hash1 = generateContentHash('hello world');
    const hash2 = generateContentHash('hello world');
    const hash3 = generateContentHash('goodbye world');

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
  });

  it('should return 8-character hex string', () => {
    const hash = generateContentHash('test');

    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('generateCacheKey', () => {
  it('should include content hash, size, and filename', () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const key = generateCacheKey(data, 'document.pdf');

    expect(key).toContain('_5_'); // size
    expect(key).toContain('document.pdf');
  });

  it('should normalize filename', () => {
    const data = new Uint8Array([1, 2, 3]);
    const key = generateCacheKey(data, 'My Document (1).PDF');

    expect(key).toContain('my_document__1_.pdf');
  });

  it('should generate different keys for same content with different names', () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);

    const key1 = generateCacheKey(data, 'file1.pdf');
    const key2 = generateCacheKey(data, 'file2.pdf');

    expect(key1).not.toBe(key2);
  });
});

describe('Default Cache', () => {
  afterEach(() => {
    clearDefaultFileCache();
    setDefaultFileCache(null);
  });

  it('should create default cache on first access', () => {
    const cache1 = getDefaultFileCache();
    const cache2 = getDefaultFileCache();

    expect(cache1).toBe(cache2);
  });

  it('should allow setting custom default cache', () => {
    const customCache = new FileCache({ maxSize: 10 });
    setDefaultFileCache(customCache);

    expect(getDefaultFileCache()).toBe(customCache);
  });

  it('should clear default cache', () => {
    const cache = getDefaultFileCache();
    cache.set('test', { fileId: 'f1', createdAt: Date.now(), purpose: 'file-extract' });

    clearDefaultFileCache();

    expect(cache.size).toBe(0);
  });
});

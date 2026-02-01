/**
 * File content caching for efficient re-use of uploaded files.
 * @module
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Entry in the file cache.
 */
export interface FileCacheEntry {
  /** The Kimi file ID */
  fileId: string;
  /** Extracted text content (for documents) */
  content?: string;
  /** Unix timestamp of creation */
  createdAt: number;
  /** File purpose */
  purpose: 'file-extract' | 'image' | 'video';
}

/**
 * Options for configuring the file cache.
 */
export interface FileCacheOptions {
  /**
   * Maximum number of entries in the cache.
   * When exceeded, least recently used entries are evicted.
   * @default 100
   */
  maxSize?: number;

  /**
   * Time-to-live for cache entries in milliseconds.
   * Entries older than this are considered stale.
   * @default 3600000 (1 hour)
   */
  ttlMs?: number;
}

// ============================================================================
// LRU Cache Implementation
// ============================================================================

/**
 * A simple LRU (Least Recently Used) cache for file content.
 *
 * This cache helps avoid re-uploading the same files multiple times
 * by storing the mapping between content hashes and Kimi file IDs.
 *
 * @example
 * ```ts
 * const cache = new FileCache({ maxSize: 50, ttlMs: 30 * 60 * 1000 });
 *
 * // Check if we have this file cached
 * const cached = cache.get(contentHash);
 * if (cached) {
 *   console.log('Using cached file:', cached.fileId);
 * }
 *
 * // Store a new file
 * cache.set(contentHash, {
 *   fileId: 'file_abc123',
 *   content: 'extracted text...',
 *   purpose: 'file-extract',
 *   createdAt: Date.now()
 * });
 * ```
 */
export class FileCache {
  private readonly maxSize: number;
  private readonly ttlMs: number;
  private readonly cache: Map<string, FileCacheEntry>;

  constructor(options: FileCacheOptions = {}) {
    this.maxSize = options.maxSize ?? 100;
    this.ttlMs = options.ttlMs ?? 3600000; // 1 hour
    this.cache = new Map();
  }

  /**
   * Get a cached entry by content hash.
   * Returns undefined if not found or expired.
   * Moves the entry to the end (most recently used).
   */
  get(contentHash: string): FileCacheEntry | undefined {
    const entry = this.cache.get(contentHash);

    if (!entry) {
      return undefined;
    }

    // Check if entry has expired
    if (this.isExpired(entry)) {
      this.cache.delete(contentHash);
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(contentHash);
    this.cache.set(contentHash, entry);

    return entry;
  }

  /**
   * Set a cache entry.
   * Evicts the least recently used entry if cache is full.
   */
  set(contentHash: string, entry: FileCacheEntry): void {
    // Delete existing entry to update position
    this.cache.delete(contentHash);

    // Evict oldest entries if at capacity
    while (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      } else {
        break;
      }
    }

    this.cache.set(contentHash, entry);
  }

  /**
   * Check if an entry exists and is not expired.
   */
  has(contentHash: string): boolean {
    return this.get(contentHash) !== undefined;
  }

  /**
   * Delete a specific entry.
   */
  delete(contentHash: string): boolean {
    return this.cache.delete(contentHash);
  }

  /**
   * Clear all entries.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get the current cache size.
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Remove all expired entries.
   */
  prune(): number {
    let pruned = 0;
    for (const [key, entry] of this.cache) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        pruned++;
      }
    }
    return pruned;
  }

  /**
   * Check if an entry is expired.
   */
  private isExpired(entry: FileCacheEntry): boolean {
    return Date.now() - entry.createdAt > this.ttlMs;
  }
}

// ============================================================================
// Hash Utilities
// ============================================================================

/**
 * Generate a hash from file content for cache lookups.
 * Uses a simple but fast hash algorithm suitable for deduplication.
 *
 * @param data - The file content as Uint8Array or string
 * @returns A hex string hash
 */
export function generateContentHash(data: Uint8Array | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;

  // Simple FNV-1a hash (fast and good distribution for deduplication)
  let hash = 2166136261; // FNV offset basis

  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 16777619); // FNV prime
  }

  // Include length to differentiate files with same content hash but different lengths
  hash ^= bytes.length;

  // Convert to hex string
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Generate a more unique cache key that includes filename and size.
 * This helps differentiate files that might have similar beginnings.
 *
 * @param data - The file content
 * @param filename - The filename
 * @returns A cache key string
 */
export function generateCacheKey(data: Uint8Array | string, filename: string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const contentHash = generateContentHash(data);
  const normalizedFilename = filename.toLowerCase().replace(/[^a-z0-9.]/g, '_');

  return `${contentHash}_${bytes.length}_${normalizedFilename}`;
}

// ============================================================================
// Global Cache Instance
// ============================================================================

/**
 * Default global file cache instance.
 * This is used by the attachment processor when caching is enabled.
 */
let defaultCache: FileCache | null = null;

/**
 * Get the default global file cache.
 * Creates one if it doesn't exist.
 */
export function getDefaultFileCache(): FileCache {
  if (!defaultCache) {
    defaultCache = new FileCache();
  }
  return defaultCache;
}

/**
 * Set a custom default file cache.
 * Useful for testing or custom configurations.
 */
export function setDefaultFileCache(cache: FileCache | null): void {
  defaultCache = cache;
}

/**
 * Clear the default file cache.
 */
export function clearDefaultFileCache(): void {
  if (defaultCache) {
    defaultCache.clear();
  }
}

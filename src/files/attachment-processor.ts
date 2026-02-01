/**
 * Attachment processor for experimental_attachments support.
 * Automatically uploads files to Kimi and injects content into prompts.
 * @module
 */

import { type FileCache, type FileCacheEntry, generateCacheKey, getDefaultFileCache } from './file-cache';
import {
  getExtensionFromPath,
  getMediaTypeFromExtension,
  isDocumentMediaType,
  isFileExtractMediaType,
  isImageMediaType,
  isVideoMediaType
} from './file-utils';
import { KimiFileClient, type KimiFileClientConfig } from './kimi-file-client';

// ============================================================================
// Types
// ============================================================================

/**
 * An attachment from experimental_attachments.
 */
export interface Attachment {
  /** URL of the attachment */
  url?: string;
  /** Name of the attachment */
  name?: string;
  /** MIME type */
  contentType?: string;
  /** Raw content data */
  content?: Uint8Array | string;
}

/**
 * Processed attachment result.
 */
export interface ProcessedAttachment {
  /** Original attachment */
  original: Attachment;
  /** Processing type */
  type: 'text-inject' | 'image-url' | 'video-url' | 'skip';
  /** Extracted text content (for documents) */
  textContent?: string;
  /** URL to use in message (for images/videos) */
  mediaUrl?: string;
  /** Kimi file ID (if uploaded) */
  fileId?: string;
  /** Error if processing failed */
  error?: string;
}

/**
 * Options for processing attachments.
 */
export interface ProcessAttachmentsOptions {
  /** Attachments to process */
  attachments: Attachment[];
  /** File client configuration */
  clientConfig: KimiFileClientConfig;
  /** Whether to auto-upload documents for extraction */
  autoUploadDocuments?: boolean;
  /** Whether to upload images to Kimi's file API */
  uploadImages?: boolean;
  /** Whether to delete files after extraction (cleanup) */
  cleanupAfterExtract?: boolean;
  /**
   * Enable caching of uploaded files.
   * When true, uses the default global cache.
   * When a FileCache instance, uses that cache.
   * @default false
   */
  cache?: boolean | FileCache;
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Process experimental_attachments for Kimi.
 *
 * This function handles different attachment types:
 * - Documents (PDF, DOC, etc.): Uploads to Kimi, extracts content, returns text to inject
 * - Images: Returns URL for vision input
 * - Videos: Returns URL for video input
 *
 * @example
 * ```ts
 * const processed = await processAttachments({
 *   attachments: message.experimental_attachments ?? [],
 *   clientConfig: {
 *     baseURL: 'https://api.moonshot.ai/v1',
 *     headers: () => ({ Authorization: `Bearer ${apiKey}` }),
 *   },
 * });
 *
 * // Inject document content into system messages
 * const documentContent = processed
 *   .filter(p => p.type === 'text-inject' && p.textContent)
 *   .map(p => p.textContent)
 *   .join('\n');
 * ```
 */
export async function processAttachments(options: ProcessAttachmentsOptions): Promise<ProcessedAttachment[]> {
  const {
    attachments,
    clientConfig,
    autoUploadDocuments = true,
    uploadImages = false,
    cleanupAfterExtract = false,
    cache = false
  } = options;

  // Resolve cache instance
  const cacheInstance = cache === true ? getDefaultFileCache() : cache === false ? null : cache;

  const results: ProcessedAttachment[] = [];
  const client = new KimiFileClient(clientConfig);

  for (const attachment of attachments) {
    try {
      const processed = await processAttachment(attachment, client, {
        autoUploadDocuments,
        uploadImages,
        cleanupAfterExtract,
        cache: cacheInstance
      });
      results.push(processed);
    } catch (error) {
      results.push({
        original: attachment,
        type: 'skip',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return results;
}

// ============================================================================
// Helper Functions
// ============================================================================

async function processAttachment(
  attachment: Attachment,
  client: KimiFileClient,
  options: {
    autoUploadDocuments: boolean;
    uploadImages: boolean;
    cleanupAfterExtract: boolean;
    cache: FileCache | null;
  }
): Promise<ProcessedAttachment> {
  // Determine content type
  const contentType = resolveContentType(attachment);

  // Handle images - just return URL for vision
  if (isImageMediaType(contentType)) {
    if (options.uploadImages && attachment.content) {
      // Upload image if content is provided
      const result = await client.upload({
        data: attachment.content,
        filename: attachment.name ?? 'image.jpg',
        mediaType: contentType,
        purpose: 'image'
      });

      return {
        original: attachment,
        type: 'image-url',
        fileId: result.id,
        mediaUrl: attachment.url
      };
    }

    return {
      original: attachment,
      type: 'image-url',
      mediaUrl: attachment.url
    };
  }

  // Handle videos - just return URL for video understanding
  if (isVideoMediaType(contentType)) {
    return {
      original: attachment,
      type: 'video-url',
      mediaUrl: attachment.url
    };
  }

  // Handle documents that need extraction
  if (options.autoUploadDocuments && (isDocumentMediaType(contentType) || isFileExtractMediaType(contentType))) {
    // Need to fetch content if only URL is provided
    let data: Uint8Array | string;

    if (attachment.content) {
      data = attachment.content;
    } else if (attachment.url) {
      // Fetch the file from URL
      const response = await fetch(attachment.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch attachment: ${response.status}`);
      }
      data = new Uint8Array(await response.arrayBuffer());
    } else {
      return {
        original: attachment,
        type: 'skip',
        error: 'No content or URL provided for document attachment'
      };
    }

    const filename = attachment.name ?? guessFilename(attachment, contentType);

    // Check cache if enabled
    if (options.cache) {
      const cacheKey = generateCacheKey(data, filename);
      const cached = options.cache.get(cacheKey);

      if (cached) {
        return {
          original: attachment,
          type: 'text-inject',
          textContent: cached.content,
          fileId: cached.fileId
        };
      }
    }

    // Upload and extract content
    const result = await client.uploadAndExtract({
      data,
      filename,
      mediaType: contentType,
      purpose: 'file-extract'
    });

    // Store in cache if enabled (before cleanup)
    if (options.cache && result.content) {
      const cacheKey = generateCacheKey(data, filename);
      const cacheEntry: FileCacheEntry = {
        fileId: result.file.id,
        content: result.content,
        createdAt: Date.now(),
        purpose: 'file-extract'
      };
      options.cache.set(cacheKey, cacheEntry);
    }

    // Cleanup if requested
    if (options.cleanupAfterExtract && result.file.id) {
      try {
        await client.deleteFile(result.file.id);
      } catch {
        // Ignore cleanup errors
      }
    }

    return {
      original: attachment,
      type: 'text-inject',
      textContent: result.content,
      fileId: result.file.id
    };
  }

  // Skip unsupported types
  return {
    original: attachment,
    type: 'skip',
    error: `Unsupported content type: ${contentType}`
  };
}

function resolveContentType(attachment: Attachment): string {
  // Use explicit content type if provided
  if (attachment.contentType) {
    return attachment.contentType;
  }

  // Try to infer from filename or URL
  const path = attachment.name ?? attachment.url;
  if (path) {
    const ext = getExtensionFromPath(path);
    if (ext) {
      return getMediaTypeFromExtension(ext);
    }
  }

  // Default to octet-stream
  return 'application/octet-stream';
}

function guessFilename(attachment: Attachment, contentType: string): string {
  if (attachment.name) {
    return attachment.name;
  }

  if (attachment.url) {
    const urlPath = attachment.url.split('?')[0];
    const segments = urlPath.split('/');
    const lastSegment = segments[segments.length - 1];

    if (lastSegment.includes('.')) {
      return lastSegment;
    }
  }

  // Generate filename from content type
  const extensionMap: Record<string, string> = {
    'application/pdf': 'document.pdf',
    'text/plain': 'document.txt',
    'application/msword': 'document.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document.docx',
    'image/jpeg': 'image.jpg',
    'image/png': 'image.png'
  };

  return extensionMap[contentType] ?? 'file.bin';
}

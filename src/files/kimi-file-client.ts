/**
 * Kimi File API client for uploading and managing files.
 * @module
 */

import type { FetchFunction } from '@ai-sdk/provider-utils';
import { getExtensionFromPath, getMediaTypeFromExtension, getPurposeFromMediaType } from './file-utils';

// ============================================================================
// Types
// ============================================================================

/**
 * A file object returned by the Kimi File API.
 */
export interface KimiFile {
  /** Unique file identifier */
  id: string;
  /** File size in bytes */
  bytes: number;
  /** Unix timestamp of creation */
  created_at: number;
  /** Original filename */
  filename: string;
  /** Object type (always 'file') */
  object: 'file';
  /** File purpose (file-extract, image, video) */
  purpose: 'file-extract' | 'image' | 'video';
  /** Processing status */
  status: 'ok' | 'error' | 'processing';
  /** Status details if error */
  status_details?: string;
}

/**
 * Options for uploading a file.
 */
export interface FileUploadOptions {
  /** The file data as a Buffer, Uint8Array, or string (base64) */
  data: Uint8Array | string;
  /** The filename */
  filename: string;
  /** MIME type of the file */
  mediaType?: string;
  /** Purpose of the file (defaults based on mediaType) */
  purpose?: 'file-extract' | 'image' | 'video';
}

/**
 * Result of a file upload operation.
 */
export interface FileUploadResult {
  /** The uploaded file object */
  file: KimiFile;
  /** The extracted content (for file-extract purpose) */
  content?: string;
}

/**
 * Configuration for the file client.
 */
export interface KimiFileClientConfig {
  /** Base URL for the API */
  baseURL: string;
  /** Function to get authorization headers */
  headers: () => Record<string, string | undefined>;
  /** Custom fetch implementation */
  fetch?: FetchFunction;
}

// ============================================================================
// File Client
// ============================================================================

/**
 * Client for interacting with Kimi's File API.
 *
 * Supports uploading files for content extraction, image understanding,
 * and video understanding.
 *
 * @example
 * ```ts
 * const client = new KimiFileClient({
 *   baseURL: 'https://api.moonshot.ai/v1',
 *   headers: () => ({
 *     Authorization: `Bearer ${apiKey}`,
 *   }),
 * });
 *
 * // Upload a PDF and extract content
 * const result = await client.uploadAndExtract({
 *   data: pdfBuffer,
 *   filename: 'document.pdf',
 *   mediaType: 'application/pdf',
 * });
 *
 * console.log(result.content); // Extracted text content
 * ```
 */
export class KimiFileClient {
  private readonly config: KimiFileClientConfig;

  constructor(config: KimiFileClientConfig) {
    this.config = config;
  }

  /**
   * Upload a file to the Kimi API.
   */
  async upload(options: FileUploadOptions): Promise<KimiFile> {
    const { data, filename, mediaType, purpose } = options;

    // Determine MIME type
    const resolvedMediaType =
      mediaType ?? getMediaTypeFromExtension(getExtensionFromPath(filename) ?? '') ?? 'application/octet-stream';

    // Determine purpose
    const resolvedPurpose = purpose ?? getPurposeFromMediaType(resolvedMediaType);

    // Create form data
    const formData = new FormData();

    // Convert data to Blob
    const fileData = typeof data === 'string' ? base64ToUint8Array(data) : data;
    const blob = new Blob([new Uint8Array(fileData).buffer as ArrayBuffer], { type: resolvedMediaType });

    formData.append('file', blob, filename);
    formData.append('purpose', resolvedPurpose);

    const fetchFn = this.config.fetch ?? fetch;
    const headers = this.config.headers();

    const response = await fetchFn(`${this.config.baseURL}/files`, {
      method: 'POST',
      headers: {
        ...Object.fromEntries(
          Object.entries(headers).filter((entry): entry is [string, string] => entry[1] !== undefined)
        )
        // Don't set Content-Type - let the browser set it with boundary for FormData
      },
      body: formData
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Failed to upload file: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    return (await response.json()) as KimiFile;
  }

  /**
   * Get the content of an uploaded file (for file-extract purpose).
   */
  async getContent(fileId: string): Promise<string> {
    const fetchFn = this.config.fetch ?? fetch;
    const headers = this.config.headers();

    const response = await fetchFn(`${this.config.baseURL}/files/${fileId}/content`, {
      method: 'GET',
      headers: Object.fromEntries(
        Object.entries(headers).filter((entry): entry is [string, string] => entry[1] !== undefined)
      )
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Failed to get file content: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    return response.text();
  }

  /**
   * Upload a file and extract its content in one operation.
   * Only works for files with purpose="file-extract".
   */
  async uploadAndExtract(options: FileUploadOptions): Promise<FileUploadResult> {
    const file = await this.upload({
      ...options,
      purpose: options.purpose ?? 'file-extract'
    });

    // Wait for processing if needed
    let currentFile = file;
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds max wait
    const pollInterval = 1000; // 1 second

    while (currentFile.status === 'processing' && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      currentFile = await this.getFile(file.id);
      attempts++;
    }

    if (currentFile.status === 'error') {
      throw new Error(`File processing failed: ${currentFile.status_details ?? 'Unknown error'}`);
    }

    if (currentFile.status === 'processing') {
      throw new Error('File processing timed out');
    }

    // Get content for file-extract purpose
    let content: string | undefined;
    if (currentFile.purpose === 'file-extract') {
      content = await this.getContent(file.id);
    }

    return { file: currentFile, content };
  }

  /**
   * Get file information.
   */
  async getFile(fileId: string): Promise<KimiFile> {
    const fetchFn = this.config.fetch ?? fetch;
    const headers = this.config.headers();

    const response = await fetchFn(`${this.config.baseURL}/files/${fileId}`, {
      method: 'GET',
      headers: Object.fromEntries(
        Object.entries(headers).filter((entry): entry is [string, string] => entry[1] !== undefined)
      )
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Failed to get file: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    return (await response.json()) as KimiFile;
  }

  /**
   * List all uploaded files.
   */
  async listFiles(): Promise<KimiFile[]> {
    const fetchFn = this.config.fetch ?? fetch;
    const headers = this.config.headers();

    const response = await fetchFn(`${this.config.baseURL}/files`, {
      method: 'GET',
      headers: Object.fromEntries(
        Object.entries(headers).filter((entry): entry is [string, string] => entry[1] !== undefined)
      )
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Failed to list files: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    const result = (await response.json()) as { data: KimiFile[] };
    return result.data;
  }

  /**
   * Delete a file.
   */
  async deleteFile(fileId: string): Promise<void> {
    const fetchFn = this.config.fetch ?? fetch;
    const headers = this.config.headers();

    const response = await fetchFn(`${this.config.baseURL}/files/${fileId}`, {
      method: 'DELETE',
      headers: Object.fromEntries(
        Object.entries(headers).filter((entry): entry is [string, string] => entry[1] !== undefined)
      )
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Failed to delete file: ${response.status} ${response.statusText} - ${errorBody}`);
    }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function base64ToUint8Array(base64: string): Uint8Array {
  // Handle data URLs
  const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

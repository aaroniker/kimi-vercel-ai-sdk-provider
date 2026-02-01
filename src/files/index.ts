/**
 * File handling module for Kimi API.
 * Provides utilities for uploading and extracting content from files.
 * @module
 */

export { type Attachment, type ProcessedAttachment, processAttachments } from './attachment-processor';
export {
  SUPPORTED_FILE_EXTENSIONS,
  SUPPORTED_MIME_TYPES,
  getMediaTypeFromExtension,
  getPurposeFromMediaType,
  isDocumentMediaType,
  isFileExtractMediaType,
  isImageMediaType,
  isVideoMediaType
} from './file-utils';
export {
  type FileUploadOptions,
  type FileUploadResult,
  type KimiFile,
  KimiFileClient,
  type KimiFileClientConfig
} from './kimi-file-client';

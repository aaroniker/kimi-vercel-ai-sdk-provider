/**
 * File utility functions for Kimi API.
 * @module
 */

// ============================================================================
// Constants
// ============================================================================

/**
 * File extensions supported by Kimi's file upload API.
 */
export const SUPPORTED_FILE_EXTENSIONS = [
  // Documents
  '.pdf',
  '.txt',
  '.csv',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.md',
  '.epub',
  '.mobi',
  '.html',
  '.json',
  '.log',
  '.dot',
  '.ini',
  '.conf',
  '.yaml',
  '.yml',
  // Images
  '.jpeg',
  '.jpg',
  '.png',
  '.bmp',
  '.gif',
  '.svg',
  '.svgz',
  '.webp',
  '.ico',
  '.xbm',
  '.dib',
  '.pjp',
  '.tif',
  '.tiff',
  '.pjpeg',
  '.avif',
  '.apng',
  '.jfif',
  // Code files
  '.go',
  '.h',
  '.c',
  '.cpp',
  '.cxx',
  '.cc',
  '.cs',
  '.java',
  '.js',
  '.css',
  '.jsp',
  '.php',
  '.py',
  '.py3',
  '.asp',
  '.ts',
  '.tsx'
] as const;

/**
 * MIME types supported by Kimi's file upload API.
 */
export const SUPPORTED_MIME_TYPES = {
  // Documents
  'application/pdf': 'file-extract',
  'text/plain': 'file-extract',
  'text/csv': 'file-extract',
  'application/msword': 'file-extract',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'file-extract',
  'application/vnd.ms-excel': 'file-extract',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'file-extract',
  'application/vnd.ms-powerpoint': 'file-extract',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'file-extract',
  'text/markdown': 'file-extract',
  'text/html': 'file-extract',
  'application/json': 'file-extract',
  'application/epub+zip': 'file-extract',
  'text/yaml': 'file-extract',
  'application/x-yaml': 'file-extract',
  // Code files (treated as text)
  'text/javascript': 'file-extract',
  'text/typescript': 'file-extract',
  'text/x-python': 'file-extract',
  'text/x-java': 'file-extract',
  'text/x-c': 'file-extract',
  'text/x-c++': 'file-extract',
  'text/css': 'file-extract',
  // Images
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'image/svg+xml': 'image',
  'image/bmp': 'image',
  'image/tiff': 'image',
  'image/avif': 'image',
  'image/apng': 'image',
  'image/x-icon': 'image',
  // Videos
  'video/mp4': 'video',
  'video/webm': 'video',
  'video/ogg': 'video',
  'video/quicktime': 'video'
} as const;

export type SupportedMimeType = keyof typeof SUPPORTED_MIME_TYPES;
export type FilePurpose = 'file-extract' | 'image' | 'video';

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a media type is for image files.
 */
export function isImageMediaType(mediaType: string): boolean {
  return mediaType.startsWith('image/');
}

/**
 * Check if a media type is for video files.
 */
export function isVideoMediaType(mediaType: string): boolean {
  return mediaType.startsWith('video/');
}

/**
 * Check if a media type should use file-extract purpose.
 */
export function isFileExtractMediaType(mediaType: string): boolean {
  // Check explicit types
  if (mediaType in SUPPORTED_MIME_TYPES) {
    return SUPPORTED_MIME_TYPES[mediaType as SupportedMimeType] === 'file-extract';
  }
  // Check text/* and application/* prefixes
  if (mediaType.startsWith('text/') || mediaType === 'application/pdf') {
    return true;
  }
  return false;
}

/**
 * Check if a media type is for document files (PDFs, Word, etc.).
 */
export function isDocumentMediaType(mediaType: string): boolean {
  const documentTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/epub+zip'
  ];
  return documentTypes.includes(mediaType);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get the file purpose based on media type.
 */
export function getPurposeFromMediaType(mediaType: string): FilePurpose {
  if (isImageMediaType(mediaType)) {
    return 'image';
  }
  if (isVideoMediaType(mediaType)) {
    return 'video';
  }
  return 'file-extract';
}

/**
 * Get MIME type from file extension.
 */
export function getMediaTypeFromExtension(extension: string): string {
  const ext = extension.toLowerCase().startsWith('.') ? extension.toLowerCase() : `.${extension.toLowerCase()}`;

  const extensionToMime: Record<string, string> = {
    // Documents
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.md': 'text/markdown',
    '.html': 'text/html',
    '.json': 'application/json',
    '.epub': 'application/epub+zip',
    '.yaml': 'text/yaml',
    '.yml': 'text/yaml',
    '.log': 'text/plain',
    '.ini': 'text/plain',
    '.conf': 'text/plain',
    // Code
    '.js': 'text/javascript',
    '.ts': 'text/typescript',
    '.tsx': 'text/typescript',
    '.py': 'text/x-python',
    '.java': 'text/x-java',
    '.c': 'text/x-c',
    '.cpp': 'text/x-c++',
    '.h': 'text/x-c',
    '.css': 'text/css',
    '.go': 'text/plain',
    '.php': 'text/plain',
    // Images
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.bmp': 'image/bmp',
    '.tif': 'image/tiff',
    '.tiff': 'image/tiff',
    '.avif': 'image/avif',
    '.apng': 'image/apng',
    '.ico': 'image/x-icon',
    // Videos
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogg': 'video/ogg',
    '.mov': 'video/quicktime'
  };

  return extensionToMime[ext] ?? 'application/octet-stream';
}

/**
 * Extract file extension from URL or filename.
 */
export function getExtensionFromPath(path: string): string | null {
  const match = path.match(/\.([^./?#]+)(?:[?#]|$)/);
  return match ? `.${match[1].toLowerCase()}` : null;
}

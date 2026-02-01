/**
 * Tests for file handling utilities.
 */

import { describe, expect, it } from 'vitest';
import {
  SUPPORTED_FILE_EXTENSIONS,
  SUPPORTED_MIME_TYPES,
  getMediaTypeFromExtension,
  getPurposeFromMediaType,
  isDocumentMediaType,
  isFileExtractMediaType,
  isImageMediaType,
  isVideoMediaType
} from '../files/file-utils';

describe('file-utils', () => {
  describe('SUPPORTED_FILE_EXTENSIONS', () => {
    it('should include common document extensions', () => {
      expect(SUPPORTED_FILE_EXTENSIONS).toContain('.pdf');
      expect(SUPPORTED_FILE_EXTENSIONS).toContain('.doc');
      expect(SUPPORTED_FILE_EXTENSIONS).toContain('.docx');
      expect(SUPPORTED_FILE_EXTENSIONS).toContain('.txt');
      expect(SUPPORTED_FILE_EXTENSIONS).toContain('.md');
    });

    it('should include common image extensions', () => {
      expect(SUPPORTED_FILE_EXTENSIONS).toContain('.png');
      expect(SUPPORTED_FILE_EXTENSIONS).toContain('.jpg');
      expect(SUPPORTED_FILE_EXTENSIONS).toContain('.jpeg');
      expect(SUPPORTED_FILE_EXTENSIONS).toContain('.gif');
      expect(SUPPORTED_FILE_EXTENSIONS).toContain('.webp');
    });

    it('should include common code file extensions', () => {
      expect(SUPPORTED_FILE_EXTENSIONS).toContain('.py');
      expect(SUPPORTED_FILE_EXTENSIONS).toContain('.js');
      expect(SUPPORTED_FILE_EXTENSIONS).toContain('.ts');
      expect(SUPPORTED_FILE_EXTENSIONS).toContain('.tsx');
      expect(SUPPORTED_FILE_EXTENSIONS).toContain('.java');
    });
  });

  describe('SUPPORTED_MIME_TYPES', () => {
    it('should map PDF to file-extract', () => {
      expect(SUPPORTED_MIME_TYPES['application/pdf']).toBe('file-extract');
    });

    it('should map images to image purpose', () => {
      expect(SUPPORTED_MIME_TYPES['image/jpeg']).toBe('image');
      expect(SUPPORTED_MIME_TYPES['image/png']).toBe('image');
      expect(SUPPORTED_MIME_TYPES['image/gif']).toBe('image');
    });

    it('should map videos to video purpose', () => {
      expect(SUPPORTED_MIME_TYPES['video/mp4']).toBe('video');
      expect(SUPPORTED_MIME_TYPES['video/webm']).toBe('video');
    });
  });

  describe('isImageMediaType', () => {
    it('should return true for image MIME types', () => {
      expect(isImageMediaType('image/jpeg')).toBe(true);
      expect(isImageMediaType('image/png')).toBe(true);
      expect(isImageMediaType('image/gif')).toBe(true);
      expect(isImageMediaType('image/webp')).toBe(true);
      expect(isImageMediaType('image/svg+xml')).toBe(true);
    });

    it('should return false for non-image MIME types', () => {
      expect(isImageMediaType('application/pdf')).toBe(false);
      expect(isImageMediaType('video/mp4')).toBe(false);
      expect(isImageMediaType('text/plain')).toBe(false);
    });
  });

  describe('isVideoMediaType', () => {
    it('should return true for video MIME types', () => {
      expect(isVideoMediaType('video/mp4')).toBe(true);
      expect(isVideoMediaType('video/webm')).toBe(true);
      expect(isVideoMediaType('video/ogg')).toBe(true);
    });

    it('should return false for non-video MIME types', () => {
      expect(isVideoMediaType('image/jpeg')).toBe(false);
      expect(isVideoMediaType('application/pdf')).toBe(false);
    });
  });

  describe('isFileExtractMediaType', () => {
    it('should return true for text MIME types', () => {
      expect(isFileExtractMediaType('text/plain')).toBe(true);
      expect(isFileExtractMediaType('text/html')).toBe(true);
      expect(isFileExtractMediaType('text/markdown')).toBe(true);
    });

    it('should return true for PDF', () => {
      expect(isFileExtractMediaType('application/pdf')).toBe(true);
    });

    it('should return false for images', () => {
      expect(isFileExtractMediaType('image/jpeg')).toBe(false);
      expect(isFileExtractMediaType('image/png')).toBe(false);
    });

    it('should return false for videos', () => {
      expect(isFileExtractMediaType('video/mp4')).toBe(false);
    });
  });

  describe('isDocumentMediaType', () => {
    it('should return true for document MIME types', () => {
      expect(isDocumentMediaType('application/pdf')).toBe(true);
      expect(isDocumentMediaType('application/msword')).toBe(true);
      expect(isDocumentMediaType('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(true);
      expect(isDocumentMediaType('application/vnd.ms-excel')).toBe(true);
    });

    it('should return false for non-document types', () => {
      expect(isDocumentMediaType('text/plain')).toBe(false);
      expect(isDocumentMediaType('image/jpeg')).toBe(false);
    });
  });

  describe('getPurposeFromMediaType', () => {
    it('should return image for image MIME types', () => {
      expect(getPurposeFromMediaType('image/jpeg')).toBe('image');
      expect(getPurposeFromMediaType('image/png')).toBe('image');
    });

    it('should return video for video MIME types', () => {
      expect(getPurposeFromMediaType('video/mp4')).toBe('video');
      expect(getPurposeFromMediaType('video/webm')).toBe('video');
    });

    it('should return file-extract for other types', () => {
      expect(getPurposeFromMediaType('application/pdf')).toBe('file-extract');
      expect(getPurposeFromMediaType('text/plain')).toBe('file-extract');
      expect(getPurposeFromMediaType('application/json')).toBe('file-extract');
    });
  });

  describe('getMediaTypeFromExtension', () => {
    it('should return correct MIME type for document extensions', () => {
      expect(getMediaTypeFromExtension('.pdf')).toBe('application/pdf');
      expect(getMediaTypeFromExtension('.txt')).toBe('text/plain');
      expect(getMediaTypeFromExtension('.md')).toBe('text/markdown');
      expect(getMediaTypeFromExtension('.json')).toBe('application/json');
    });

    it('should return correct MIME type for image extensions', () => {
      expect(getMediaTypeFromExtension('.jpg')).toBe('image/jpeg');
      expect(getMediaTypeFromExtension('.jpeg')).toBe('image/jpeg');
      expect(getMediaTypeFromExtension('.png')).toBe('image/png');
      expect(getMediaTypeFromExtension('.gif')).toBe('image/gif');
      expect(getMediaTypeFromExtension('.webp')).toBe('image/webp');
    });

    it('should return correct MIME type for video extensions', () => {
      expect(getMediaTypeFromExtension('.mp4')).toBe('video/mp4');
      expect(getMediaTypeFromExtension('.webm')).toBe('video/webm');
    });

    it('should return correct MIME type for code extensions', () => {
      expect(getMediaTypeFromExtension('.js')).toBe('text/javascript');
      expect(getMediaTypeFromExtension('.ts')).toBe('text/typescript');
      expect(getMediaTypeFromExtension('.py')).toBe('text/x-python');
    });

    it('should handle extensions without leading dot', () => {
      expect(getMediaTypeFromExtension('pdf')).toBe('application/pdf');
      expect(getMediaTypeFromExtension('jpg')).toBe('image/jpeg');
    });

    it('should handle uppercase extensions', () => {
      expect(getMediaTypeFromExtension('.PDF')).toBe('application/pdf');
      expect(getMediaTypeFromExtension('.JPG')).toBe('image/jpeg');
    });

    it('should return octet-stream for unknown extensions', () => {
      expect(getMediaTypeFromExtension('.xyz')).toBe('application/octet-stream');
      expect(getMediaTypeFromExtension('.unknown')).toBe('application/octet-stream');
    });
  });
});

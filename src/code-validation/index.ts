/**
 * Code validation module exports.
 * @module
 */

export type {
  CodeBlock,
  CodeExtractionResult,
  CodeValidationConfig,
  FixAttempt,
  LanguageDetectionResult,
  SupportedLanguage,
  ValidationError,
  ValidationErrorType,
  ValidationResult,
  ValidationSeverity,
  ValidationStrictness
} from './types';
export type { CodeValidatorOptions, GenerateTextFunction } from './validator';
export {
  containsCode,
  detectLanguage,
  extractCodeBlocks,
  extractPrimaryCode,
  getFileExtension
} from './detector';
export {
  CodeValidator,
  createFailedValidationResult,
  createPassedValidationResult
} from './validator';
